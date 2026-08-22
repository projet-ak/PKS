import { useEffect, useState } from "react";

import { api, type Checkpoint } from "../api";
import { useAuth } from "../auth";
import { useI18n } from "../i18n";
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
  const { t } = useI18n();

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
        <h1>{t("kiosk.setup")}</h1>
        <div className="card" style={{ maxWidth: "38rem" }}>
          <div className="card-title">{t("kiosk.deviceKey")}</div>
          <p className="hint">
            {t("kiosk.setupInfo")}
          </p>

          {points.length > 0 && (
            <div style={{ marginTop: "1rem" }}>
              <p className="hint">{t("kiosk.definedPoints")}</p>
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
              placeholder={t("kiosk.pasteKey")}
              style={{ minWidth: "20rem" }}
            />
            <button
              onClick={() => void verifyAndStore(keyDraft)}
              disabled={!keyDraft.trim() || checking}
            >
              {checking ? t("kiosk.verifying") : t("kiosk.verify")}
            </button>
          </div>

          {error && <p className="error-text">{error}</p>}

          {points.length === 0 && user?.role === "admin" && (
            <p className="hint" style={{ marginTop: "0.8rem" }}>
              {t("kiosk.noPoints")}
            </p>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="kiosk">
      <h1>{t("kiosk.title")}</h1>

      <div className="card form-row">
        <span className="badge">{t("kiosk.point")}: {checkpointCode}</span>
        <label className="hint">
          <input
            type="checkbox"
            checked={dual}
            onChange={(e) => toggleDual(e.target.checked)}
            style={{ minWidth: "auto" }}
          />{" "}
          {t("kiosk.dual")}
        </label>
        <span className="hint">{t("kiosk.dualHint")}</span>
        <button className="ghost" onClick={reset}>
          {t("kiosk.changeKey")}
        </button>
      </div>

      <div className={dual ? "kiosk-panes dual" : "kiosk-panes"}>
        <KioskCamera
          paneId={dual ? "in" : "single"}
          title={dual ? t("kiosk.entry") : t("kiosk.title")}
          defaultMode={dual ? "in" : "auto"}
          checkpointKey={checkpointKey}
        />
        {dual && (
          <KioskCamera
            paneId="out"
            title={t("kiosk.exit")}
            defaultMode="out"
            checkpointKey={checkpointKey}
          />
        )}
      </div>
    </section>
  );
}
