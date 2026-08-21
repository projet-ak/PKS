import { useCallback, useEffect, useRef, useState } from "react";

import { api, type ScanResponse } from "../api";

// AR global olarak index.html'deki /vendor/aruco.js tarafindan tanimlanir.

/// Backend'deki dictionary degeri ile ayni olmali.
const DICTIONARY = "ARUCO_MIP_36h12";

/// Ayni markeri saniyede defalarca sunucuya gondermemek icin istemci tarafi
/// kilit suresi. Sunucudaki debounce'un tamamlayicisi, yerine gecmez.
const CLIENT_LOCK_MS = 3000;

/// Kiosk ayarlari cihaza ozeldir: giris kapisindaki tablet ile cikistaki
/// tablet ayni sayfayi acar, farkli ayarla calisir.
const STORAGE_CAMERA = "pts.kiosk.cameraId";
const STORAGE_MODE = "pts.kiosk.mode";

type Mode = "auto" | "in" | "out";

const MODE_LABELS: Record<Mode, string> = {
  auto: "Otomatik (giris/cikis sirayla)",
  in: "Sadece GIRIS",
  out: "Sadece CIKIS",
};

export default function Kiosk() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastSentRef = useRef<{ markerId: number; at: number } | null>(null);

  const [result, setResult] = useState<ScanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);

  const [cameraId, setCameraId] = useState<string>(
    () => localStorage.getItem(STORAGE_CAMERA) ?? "",
  );
  const [mode, setMode] = useState<Mode>(
    () => (localStorage.getItem(STORAGE_MODE) as Mode | null) ?? "auto",
  );

  // Yon secimi ref ile de tutulur: tarama dongusu efekt icinde kuruluyor ve
  // kapanis uzerinden eski degeri gormemeli.
  const modeRef = useRef<Mode>(mode);
  modeRef.current = mode;

  const chooseCamera = useCallback((id: string) => {
    setCameraId(id);
    localStorage.setItem(STORAGE_CAMERA, id);
  }, []);

  const chooseMode = useCallback((next: Mode) => {
    setMode(next);
    localStorage.setItem(STORAGE_MODE, next);
    setResult(null);
  }, []);

  useEffect(() => {
    const detector = new AR.Detector({ dictionaryName: DICTIONARY });
    let frameHandle = 0;
    let stream: MediaStream | null = null;
    let cancelled = false;

    async function start() {
      // Tarayicilar kameraya yalnizca guvenli baglamda izin verir: HTTPS ya
      // da localhost. Aksi halde navigator.mediaDevices hic tanimlanmaz ve
      // ham hata mesaji ("Cannot read properties of undefined") sebebi
      // anlatmaz.
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setError(
          "Kamera yalnizca HTTPS uzerinden kullanilabilir. Sayfa su an " +
            window.location.protocol +
            "//" +
            window.location.host +
            " adresinden acik. https://" +
            window.location.host +
            "/kiosk adresini kullanin.",
        );
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: cameraId
            ? { deviceId: { exact: cameraId }, width: 640, height: 480 }
            : { width: 640, height: 480, facingMode: "environment" },
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
  }, [cameraId]);

  return (
    <section className="kiosk">
      <h1>Gecis Kiosku</h1>

      <div className="card form-row">
        <label className="hint">Kamera</label>
        <select value={cameraId} onChange={(e) => chooseCamera(e.target.value)}>
          <option value="">Varsayilan (arka kamera)</option>
          {cameras.map((c, i) => (
            <option key={c.deviceId} value={c.deviceId}>
              {c.label || "Kamera " + (i + 1)}
            </option>
          ))}
        </select>

        <label className="hint">Yon</label>
        <select value={mode} onChange={(e) => chooseMode(e.target.value as Mode)}>
          {(Object.keys(MODE_LABELS) as Mode[]).map((m) => (
            <option key={m} value={m}>
              {MODE_LABELS[m]}
            </option>
          ))}
        </select>
      </div>

      <p className="hint">
        Personel kartinizi kameraya gosterin. Secimler bu cihazda saklanir;
        cikis kapisindaki cihazi "Sadece CIKIS" olarak ayarlayin.
      </p>

      <div className={"kiosk-view mode-" + mode}>
        <video ref={videoRef} playsInline muted className="hidden-video" />
        <canvas ref={canvasRef} className="kiosk-canvas" />
        {!cameraReady && !error && <p className="hint">Kamera baslatiliyor...</p>}
      </div>

      {result && (
        <div className={"scan-result " + result.direction}>
          <strong>{result.full_name}</strong>
          <span className="sicil">{result.employee_no}</span>
          <span className="direction">
            {result.direction === "in" ? "GIRIS" : "CIKIS"}
          </span>
          <span className="time">
            {new Date(result.occurred_at).toLocaleTimeString("tr-TR")}
          </span>
          {result.duplicate_ignored && (
            <span className="hint">Zaten kaydedilmisti, tekrarlanmadi.</span>
          )}
        </div>
      )}

      {error && <div className="scan-result error">{error}</div>}
    </section>
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
