import { useEffect, useRef, useState } from "react";
import { api, type ScanResponse } from "../api";

// AR global olarak index.html'deki /vendor/aruco.js tarafindan tanimlanir.

/// Backend'deki dictionary degeri ile ayni olmali.
const DICTIONARY = "ARUCO_MIP_36h12";

/// Ayni markeri saniyede defalarca sunucuya gondermemek icin istemci tarafi
/// kilit suresi. Sunucudaki debounce'un tamamlayicisi, yerine gecmez.
const CLIENT_LOCK_MS = 3000;

export default function Kiosk() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastSentRef = useRef<{ markerId: number; at: number } | null>(null);

  const [result, setResult] = useState<ScanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    const detector = new AR.Detector({ dictionaryName: DICTIONARY });
    let frameHandle = 0;
    let stream: MediaStream | null = null;
    let cancelled = false;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        setCameraReady(true);
        frameHandle = requestAnimationFrame(tick);
      } catch (e) {
        setError(`Kamera acilamadi: ${(e as Error).message}`);
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

      try {
        setError(null);
        setResult(await api.scan(markerId));
      } catch (e) {
        setResult(null);
        setError(`ArUco ${markerId}: ${(e as Error).message}`);
      }
    }

    void start();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameHandle);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <section className="kiosk">
      <h1>Gecis Kiosku</h1>
      <p className="hint">Personel kartinizi kameraya gosterin.</p>

      <div className="kiosk-view">
        <video ref={videoRef} playsInline muted className="hidden-video" />
        <canvas ref={canvasRef} className="kiosk-canvas" />
        {!cameraReady && !error && <p className="hint">Kamera baslatiliyor...</p>}
      </div>

      {result && (
        <div className={`scan-result ${result.direction}`}>
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
