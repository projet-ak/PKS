import { useState } from "react";

import KioskCamera from "./KioskCamera";

/// Kiosk cihazi kullanici oturumu acmaz; kendisini bu anahtarla tanitir.
/// Anahtar panelin "Gecis Noktalari" sayfasindan alinir ve cihazda kalir.
const STORAGE_KEY = "pts.kiosk.checkpointKey";

/// Cift kamera secimi de cihazda saklanir: giris kapisindaki tablet tek
/// kamerayla, test makinesi iki kamerayla calisabilir.
const STORAGE_DUAL = "pts.kiosk.dual";

export default function Kiosk() {
  const [checkpointKey, setCheckpointKey] = useState<string>(
    () => localStorage.getItem(STORAGE_KEY) ?? "",
  );
  const [keyDraft, setKeyDraft] = useState("");
  const [dual, setDual] = useState<boolean>(
    () => localStorage.getItem(STORAGE_DUAL) === "1",
  );

  function toggleDual(next: boolean) {
    setDual(next);
    localStorage.setItem(STORAGE_DUAL, next ? "1" : "0");
  }

  function saveKey(value: string) {
    const trimmed = value.trim();
    localStorage.setItem(STORAGE_KEY, trimmed);
    setCheckpointKey(trimmed);
  }

  if (!checkpointKey) {
    return (
      <section>
        <h1>Kiosk Kurulumu</h1>
        <div className="card" style={{ maxWidth: "34rem" }}>
          <div className="card-title">Cihaz anahtari</div>
          <p className="hint">
            Bu cihazi bir gecis noktasina baglayin. Anahtari panelde "Gecis
            Noktalari" sayfasindan kopyalayabilirsiniz. Bir kez girilir, cihazda
            saklanir.
          </p>
          <div className="form-row" style={{ marginTop: "0.8rem" }}>
            <input
              value={keyDraft}
              onChange={(e) => setKeyDraft(e.target.value)}
              placeholder="Cihaz anahtari"
              style={{ minWidth: "20rem" }}
            />
            <button onClick={() => saveKey(keyDraft)} disabled={!keyDraft.trim()}>
              Kaydet
            </button>
          </div>
        </div>
      </section>
    );
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
            style={{ minWidth: "auto" }}
          />{" "}
          Iki kamerayi ayni anda calistir
        </label>
        <span className="hint">Her panel kendi kamerasini ve yonunu hatirlar.</span>
        <button className="ghost" onClick={() => saveKey("")}>
          Cihaz anahtarini degistir
        </button>
      </div>

      <div className={dual ? "kiosk-panes dual" : "kiosk-panes"}>
        <KioskCamera
          paneId={dual ? "in" : "single"}
          title={dual ? "Giris" : "Kiosk"}
          defaultMode={dual ? "in" : "auto"}
          checkpointKey={checkpointKey}
        />
        {dual && (
          <KioskCamera
            paneId="out"
            title="Cikis"
            defaultMode="out"
            checkpointKey={checkpointKey}
          />
        )}
      </div>
    </section>
  );
}
