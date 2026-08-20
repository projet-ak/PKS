import { useMemo, useState } from "react";

// AR global olarak index.html'deki /vendor/aruco.js tarafindan tanimlanir.

/// Kiosk ve backend ile ayni sozluk kullanilmali.
const DICTIONARY = "ARUCO_MIP_36h12";

export default function Cards() {
  const [markerId, setMarkerId] = useState("1");
  const [label, setLabel] = useState("");

  const dictionary = useMemo(() => new AR.Dictionary(DICTIONARY), []);

  const { svg, error } = useMemo(() => {
    const id = Number(markerId);
    if (markerId === "" || Number.isNaN(id) || !Number.isInteger(id) || id < 0) {
      return { svg: null, error: "Gecerli bir tam sayi girin." };
    }
    try {
      // Marker cizimini kutuphanenin kendisi uretir; bit sirasini biz
      // yorumlamayiz, boylece kiosk okumasiyla birebir uyumlu olur.
      return { svg: dictionary.generateSVG(id), error: null };
    } catch (e) {
      return { svg: null, error: (e as Error).message ?? String(e) };
    }
  }, [dictionary, markerId]);

  const maxId = dictionary.codeList.length - 1;

  return (
    <section>
      <h1 className="no-print">ArUco Kart Uret</h1>

      <div className="card form-row no-print">
        <input
          type="number"
          min={0}
          max={maxId}
          value={markerId}
          onChange={(e) => setMarkerId(e.target.value)}
          placeholder="ArUco ID"
        />
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Kart uzerine yazilacak ad (istege bagli)"
          style={{ minWidth: "18rem" }}
        />
        <button onClick={() => window.print()} disabled={!svg}>
          Yazdir
        </button>
      </div>

      <p className="hint no-print">
        {DICTIONARY} sozlugu, gecerli ID araligi 0 - {maxId}. Kartin panelde
        personele tanimladigin ID ile ayni olmasi gerekir.
      </p>

      {error && <p className="error-text no-print">{error}</p>}

      {svg && (
        <div className="card-sheet">
          <div
            className="marker"
            // Icerik kutuphanenin urettigi sabit SVG; disaridan veri gelmiyor.
            dangerouslySetInnerHTML={{ __html: svg }}
          />
          <div className="card-label">
            {label && <strong>{label}</strong>}
            <span className="hint">ArUco ID: {markerId}</span>
          </div>
        </div>
      )}
    </section>
  );
}
