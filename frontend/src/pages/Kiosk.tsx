import { useState } from "react";

import KioskCamera from "./KioskCamera";

/// Cift kamera secimi de cihazda saklanir: giris kapisindaki tablet tek
/// kamerayla, test makinesi iki kamerayla calisabilir.
const STORAGE_DUAL = "pts.kiosk.dual";

export default function Kiosk() {
  const [dual, setDual] = useState<boolean>(
    () => localStorage.getItem(STORAGE_DUAL) === "1",
  );

  function toggleDual(next: boolean) {
    setDual(next);
    localStorage.setItem(STORAGE_DUAL, next ? "1" : "0");
  }

  return (
    <section className="kiosk">
      <h1>Gecis Kiosku</h1>

      <div className="card form-row">
        <label className="hint">
          <input
            type="checkbox"
            checked={dual}
            onChange={(e) => toggleDual(e.target.checked)}
          />{" "}
          Iki kamerayi ayni anda calistir
        </label>
        <span className="hint">
          Her panel kendi kamerasini ve yonunu hatirlar.
        </span>
      </div>

      <div className={dual ? "kiosk-panes dual" : "kiosk-panes"}>
        <KioskCamera
          paneId={dual ? "in" : "single"}
          title={dual ? "Giris" : "Kiosk"}
          defaultMode={dual ? "in" : "auto"}
        />
        {dual && <KioskCamera paneId="out" title="Cikis" defaultMode="out" />}
      </div>
    </section>
  );
}
