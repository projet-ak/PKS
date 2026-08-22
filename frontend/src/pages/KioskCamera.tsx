import { useCallback, useEffect, useRef, useState } from "react";

import { api, type ScanResponse } from "../api";

// AR global olarak index.html'deki /vendor/aruco.js tarafindan tanimlanir.

/// Backend'deki dictionary degeri ile ayni olmali.
const DICTIONARY = "ARUCO_MIP_36h12";

/// Ayni markeri saniyede defalarca sunucuya gondermemek icin istemci tarafi
/// kilit suresi. Sunucudaki debounce'un tamamlayicisi, yerine gecmez.
const CLIENT_LOCK_MS = 3000;

/// Kaydedilen karenin kalitesi. Kanit amacli oldugu icin yuksek cozunurluk
/// gerekmiyor; 0.6 JPEG 640x480'de ~40 KB tutar.
const PHOTO_QUALITY = 0.6;

export type Mode = "auto" | "in" | "out";

const MODE_LABELS: Record<Mode, string> = {
  auto: "Otomatik",
  in: "Sadece GIRIS",
  out: "Sadece CIKIS",
};

interface Props {
  /// Ayarlar bu ada gore saklanir; her panel kendi kamerasini hatirlar.
  paneId: string;
  title: string;
  defaultMode: Mode;
  /// Cihazi tanitan gecis noktasi anahtari. Sunucu bunsuz kayit acmaz.
  checkpointKey: string;
}

/// Tek bir kamerayi surekli tarayan panel. Sayfada birden fazlasi ayni anda
/// calisabilir; her biri ayri MediaStream ve ayri tarama dongusu kullanir.
export default function KioskCamera({
  paneId,
  title,
  defaultMode,
  checkpointKey,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastSentRef = useRef<{ markerId: number; at: number } | null>(null);

  const cameraKey = `pts.kiosk.${paneId}.cameraId`;
  const modeKey = `pts.kiosk.${paneId}.mode`;

  const [result, setResult] = useState<ScanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);

  const [cameraId, setCameraId] = useState<string>(
    () => localStorage.getItem(cameraKey) ?? "",
  );
  const [mode, setMode] = useState<Mode>(
    () => (localStorage.getItem(modeKey) as Mode | null) ?? defaultMode,
  );

  // Tarama dongusu efekt icinde kuruldugu icin guncel yonu ref uzerinden
  // okur; aksi halde kapanis eski degeri gorurdu.
  const modeRef = useRef<Mode>(mode);
  modeRef.current = mode;

  const chooseCamera = useCallback(
    (id: string) => {
      setCameraId(id);
      localStorage.setItem(cameraKey, id);
    },
    [cameraKey],
  );

  const chooseMode = useCallback(
    (next: Mode) => {
      setMode(next);
      localStorage.setItem(modeKey, next);
      setResult(null);
    },
    [modeKey],
  );

  useEffect(() => {
    const detector = new AR.Detector({ dictionaryName: DICTIONARY });
    let frameHandle = 0;
    let stream: MediaStream | null = null;
    let cancelled = false;

    async function start() {
      // Tarayicilar kameraya yalnizca guvenli baglamda izin verir: HTTPS ya
      // da localhost. Aksi halde navigator.mediaDevices hic tanimlanmaz.
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setError(
          "Kamera yalnizca HTTPS uzerinden kullanilabilir. Adres su an " +
            window.location.protocol +
            "//" +
            window.location.host,
        );
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: cameraId
            ? { deviceId: { exact: cameraId }, width: 640, height: 480 }
            : { width: 640, height: 480 },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        // Cihaz etiketleri ancak izin verildikten sonra dolu gelir, o yuzden
        // listeyi akis basladiktan sonra okuyoruz.
        const devices = await navigator.mediaDevices.enumerateDevices();
        setCameras(devices.filter((d) => d.kind === "videoinput"));

        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        setCameraReady(true);
        setError(null);
        frameHandle = requestAnimationFrame(tick);
      } catch (e) {
        setCameraReady(false);
        setError("Kamera acilamadi: " + (e as Error).message);
      }
    }

    function tick() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const markers = detector.detect(
          ctx.getImageData(0, 0, canvas.width, canvas.height),
        );

        for (const marker of markers) {
          drawOutline(ctx, marker.corners);
        }
        if (markers.length > 0) {
          void handleMarker(markers[0].id);
        }
      }
      frameHandle = requestAnimationFrame(tick);
    }

    /// Okuma anindaki kareyi JPEG'e cevirir. Kanit fotografi kaydin bir
    /// parcasi ama zorunlu degil; uretilemezse gecis yine kaydedilir.
    function capture(): string | undefined {
      const canvas = canvasRef.current;
      if (!canvas) return undefined;
      try {
        return canvas.toDataURL("image/jpeg", PHOTO_QUALITY);
      } catch {
        return undefined;
      }
    }

    async function handleMarker(markerId: number) {
      const last = lastSentRef.current;
      const now = Date.now();
      // Ayni marker hala kilitliyse sunucuya gitme.
      if (last && last.markerId === markerId && now - last.at < CLIENT_LOCK_MS) {
        return;
      }
      lastSentRef.current = { markerId, at: now };

      const current = modeRef.current;
      try {
        setError(null);
        setResult(
          await api.scan(markerId, {
            direction: current === "auto" ? undefined : current,
            checkpointKey,
            photo: capture(),
          }),
        );
      } catch (e) {
        setResult(null);
        setError("ArUco " + markerId + ": " + (e as Error).message);
      }
    }

    void start();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameHandle);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [cameraId, checkpointKey]);

  return (
    <div className={"kiosk-pane mode-" + mode}>
      <h2>{title}</h2>

      <div className="form-row">
        <select value={cameraId} onChange={(e) => chooseCamera(e.target.value)}>
          <option value="">Kamera: varsayilan</option>
          {cameras.map((c, i) => (
            <option key={c.deviceId} value={c.deviceId}>
              {c.label || "Kamera " + (i + 1)}
            </option>
          ))}
        </select>

        <select value={mode} onChange={(e) => chooseMode(e.target.value as Mode)}>
          {(Object.keys(MODE_LABELS) as Mode[]).map((m) => (
            <option key={m} value={m}>
              {MODE_LABELS[m]}
            </option>
          ))}
        </select>
      </div>

      <video ref={videoRef} playsInline muted className="hidden-video" />
      <canvas ref={canvasRef} className="kiosk-canvas" />
      {!cameraReady && !error && <p className="hint">Kamera baslatiliyor...</p>}

      {result && (
        <div className={"scan-result " + result.direction}>
          <div className="scan-head">
            <strong>{result.full_name}</strong>
            <span className="sicil">{result.employee_no}</span>
            <span className="direction">
              {result.direction === "in" ? "GIRIS" : "CIKIS"}
            </span>
            <span className="time">
              {new Date(result.occurred_at).toLocaleTimeString("tr-TR")}
            </span>
          </div>
          <div className="scan-meta">
            {result.company_name && (
              <span className="badge">{result.company_name}</span>
            )}
            {result.title && <span className="scan-title">{result.title}</span>}
          </div>
          {result.duplicate_ignored && (
            <span className="hint">Zaten kaydedilmisti, tekrarlanmadi.</span>
          )}
        </div>
      )}

      {error && <div className="scan-result error">{error}</div>}
    </div>
  );
}

function drawOutline(
  ctx: CanvasRenderingContext2D,
  corners: { x: number; y: number }[],
) {
  ctx.strokeStyle = "#22c55e";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (const c of corners.slice(1)) ctx.lineTo(c.x, c.y);
  ctx.closePath();
  ctx.stroke();
}
