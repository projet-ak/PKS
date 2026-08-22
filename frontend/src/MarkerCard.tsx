import { useMemo } from "react";

// AR global olarak index.html'deki /vendor/aruco.js tarafindan tanimlanir.

/// Kiosk ve backend ile ayni sozluk kullanilmali.
export const DICTIONARY = "ARUCO_MIP_36h12";

/// Sozlukteki kod sayisi ID ust sinirini belirler; backend'deki
/// MAX_MARKER_ID ile ayni olmali.
export function markerRange(): { max: number } {
  const dictionary = new AR.Dictionary(DICTIONARY);
  return { max: dictionary.codeList.length - 1 };
}

interface Props {
  markerId: number | string;
  /// Kartin altina basilacak isim; bos birakilabilir.
  label?: string;
  /// Ikinci satir, ornegin firma veya unvan.
  sublabel?: string;
}

/// Yazdirmaya hazir ArUco kart gorseli.
///
/// Cizimi js-aruco2'nin generateSVG'si uretir; bit sirasini kendimiz
/// yorumlamadigimiz icin kioskun okudugu ile birebir ayni olur.
export default function MarkerCard({ markerId, label, sublabel }: Props) {
  const { svg, error } = useMemo(() => {
    const id = Number(markerId);
    if (markerId === "" || !Number.isInteger(id) || id < 0) {
      return { svg: null, error: "Gecerli bir tam sayi girin." };
    }
    try {
      return { svg: new AR.Dictionary(DICTIONARY).generateSVG(id), error: null };
    } catch (e) {
      return { svg: null, error: (e as Error).message ?? String(e) };
    }
  }, [markerId]);

  if (error) return <p className="error-text no-print">{error}</p>;
  if (!svg) return null;

  return (
    <div className="card-sheet">
      <div
        className="marker"
        // Icerik kutuphanenin urettigi sabit SVG; disaridan veri gelmiyor.
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <div className="card-label">
        {label && <strong>{label}</strong>}
        {sublabel && <span className="hint">{sublabel}</span>}
        <span className="hint">ArUco ID: {markerId}</span>
      </div>
    </div>
  );
}
