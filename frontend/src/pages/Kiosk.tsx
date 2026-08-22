import { useEffect, useState } from "react";

import { api, type Checkpoint } from "../api";
import { useAuth } from "../auth";
import KioskCamera from "./KioskCamera";

/// Kiosk cihazi kullanici oturumu acmaz; kendisini bu anahtarla tanitir.
/// Anahtar panelin "Gecis Noktalari" sayfasindan alinir ve cihazda kalir.
const STORAGE_KEY = "pts.kiosk.checkpointKey";
/// Bagli oldugu noktanin kodu; ekranda gostermek icin saklanir.
const STORAGE_CODE = "pts.kiosk.checkpointCode";

/// Cift kamera secimi de cihazda saklanir: giris kapisindaki tablet tek
/// kamerayla, test makinesi iki kamerayla calisabilir.
const STORAGE_DUAL = "pts.kiosk.dual";

export default function Kiosk() {
  const { user } = useAuth();

  const [checkpointKey, setCheckpointKey] = useState<string>(
    () => localStorage.getItem(STORAGE_KEY) ?? "",
  );
  const [checkpointCode, setCheckpointCode] = useState<string>(
    () => localStorage.getItem(STORAGE_CODE) ?? "",
  );
  const [keyDraft, setKeyDraft] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /// Panelde oturum acikken anahtari elle kopyalamaya gerek yok: noktalari
  /// listeleyip secmek yeterli. Kiosk tabletinde oturum olmadigi icin orada
  /// bu liste gelmez ve anahtar elle girilir.
  const [points, setPoints] = useState<Checkpoint[]>([]);

  const [dual, setDual] = useState<boolean>(
    () => localStorage.getItem(STORAGE_DUAL) === "1",
  );

  useEffect(() => {
    if (!user || user.role !== "admin" || checkpointKey) return;
    api
      .listCheckpoints()
      .then((list) => setPoints(list.filter((p) => p.is_active)))
      .catch(() => setPoints([]));
  }, [user, checkpointKey]);

  function toggleDual(next: boolean) {
    setDual(next);
    localStorage.setItem(STORAGE_DUAL, next ? "1" : "0");
  }

  function store(key: string, code: string) {
    localStorage.setItem(STORAGE_KEY, key);
    localStorage.setItem(STORAGE_CODE, code);
    setCheckpointKey(key);
    setCheckpointCode(code);
  }

  /// Anahtari kaydetmeden once sunucuya sorar; yanlis anahtar kart okutulana
  /// kadar gizli kalmasin.
  async function verifyAndStore(key: string) {
    const trimmed = key.trim();
    if (!trimmed) return;
    setChecking(true);
    try {
      setError(null);
      const identity = await api.validateCheckpointKey(trimmed);
      store(trimmed, identity.code);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setChecking(false);
    }
  }

  function reset() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_CODE);
    setCheckpointKey("");
    setCheckpointCode("");
    setKeyDraft("");
    setError(null);
  }

  if (!checkpointKey) {
    return (
      <section>
        <h1>Kiosk Kurulumu</h1>
        <div className="card" style={{ maxWidth: "38rem" }}>
          <div className="card-title">Cihaz anahtari</div>
          <p className="hint">
            Bu cihazi bir gecis noktasina baglayin. Anahtar dogrulanmadan
            kaydedilmez, boylece yanlis yapistirma aninda anlasilir.
          </p>

          {points.length > 0 && (
            <div style={{ marginTop: "1rem" }}>
              <p className="hint">Panelde tanimli noktalar:</p>
              <div className="form-row">
                {points.map((p) => (
                  <button
                    key={p.id}
                    className="ghost"
                    disabled={checking}
                    onClick={() => void verifyAndStore(p.api_key)}
                  >
                    {p.code} — {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="form-row" style={{ marginTop: "1rem" }}>
            <input
              value={keyDraft}
              onChange={(e) => setKeyDraft(e.target.value)}
              placeholder="Cihaz anahtarini yapistirin"
              style={{ minWidth: "20rem" }}
            />
            <button
              onClick={() => void verifyAndStore(keyDraft)}
              disabled={!keyDraft.trim() || checking}
            >
              {checking ? "Dogrulaniyor..." : "Dogrula ve kaydet"}
            </button>
          </div>

          {error && <p className="error-text">{error}</p>}

          {points.length === 0 && user?.role === "admin" && (
            <p className="hint" style={{ marginTop: "0.8rem" }}>
              Henuz gecis noktasi tanimli degil. "Gecis Noktalari" sayfasindan
              olusturun.
            </p>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="kiosk">
      <h1>Gecis Kiosku</h1>

      <div className="card form-row">
        <span className="badge">Nokta: {checkpointCode || "bagli"}</span>
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
        <button className="ghost" onClick={reset}>
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
