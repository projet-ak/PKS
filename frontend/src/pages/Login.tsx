import { useState } from "react";

import { useAuth } from "../auth";
import { DEVELOPER, LOGOS } from "../logos";

/// Sol paneldeki yuzen sekiller. Konum ve sure sabit tutuldu; rastgele
/// uretilseydi her renderda yerleri degisir, animasyon sicrardi.
const HEXES = [
  { size: 80, bottom: "20%", left: "8%", duration: "12s", delay: "0s" },
  { size: 50, bottom: "35%", left: "20%", duration: "9s", delay: "-3s" },
  { size: 110, top: "15%", right: "12%", duration: "15s", delay: "-5s" },
  { size: 40, top: "40%", left: "5%", duration: "8s", delay: "-2s" },
];

const FEATURES = [
  { icon: "◉", title: "ArUco kart", text: "Kamerayla temassiz gecis" },
  { icon: "▤", title: "Puantaj", text: "Gunluk giris-cikis ve sure" },
  { icon: "⚿", title: "Cok noktali", text: "Giris ve cikis kiosklari" },
  { icon: "☰", title: "Izin", text: "Talep ve onay akisi", soon: true },
];

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      setError(null);
      await login(username, password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <div className="login-left">
        {HEXES.map((h, i) => (
          <span
            key={i}
            className="hex"
            style={{
              width: h.size,
              height: h.size,
              top: h.top,
              right: h.right,
              bottom: h.bottom,
              left: h.left,
              animationDuration: h.duration,
              animationDelay: h.delay,
            }}
          />
        ))}

        <div className="waves">
          <svg viewBox="0 0 150 80" preserveAspectRatio="none">
            <defs>
              <path
                id="wv"
                d="M-160 16c30 0 58-12 88-12s 58 12 88 12 58-12 88-12 58 12 88 12 v90h-352z"
              />
            </defs>
            <g className="wave-parallax">
              <use href="#wv" x="48" y="6" fill="rgba(0,201,177,.12)" />
              <use href="#wv" x="48" y="20" fill="rgba(255,255,255,.07)" />
              <use href="#wv" x="48" y="34" fill="rgba(0,201,177,.10)" />
              <use href="#wv" x="48" y="48" fill="rgba(0,61,53,.34)" />
            </g>
          </svg>
        </div>

        <div className="login-left-content">
          <div className="logo-lockup">
            <img src={LOGOS.taahhutWhite} alt="ERN Taahhüt" />
            <span className="logo-sep" />
            <img src={LOGOS.holdingWhite} alt="ERN Holding" />
          </div>

          <div className="brand-tagline">
            Personel Takip <span>Sistemi</span>
          </div>
          <p className="brand-sub">
            Santiyeden ofise tek platform — ArUco kartla temassiz gecis,
            gunluk puantaj, vardiya ve izin yonetimi.
          </p>

          <div className="feature-pills">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className={f.soon ? "feature-pill soon" : "feature-pill"}
              >
                <span className="feature-pill-icon">{f.icon}</span>
                <span className="feature-pill-text">
                  <strong>{f.title}</strong>
                  {f.text}
                  {f.soon && <span className="pill-soon-badge">Yakinda</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="login-right">
        <div className="login-right-logo">
          <span className="login-right-logo-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.42 0-8 2.24-8 5v1a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1c0-2.76-3.58-5-8-5Z" />
            </svg>
          </span>
          <span className="login-right-logo-text">
            <strong>PTS</strong>
            <span>Personel Takip Sistemi</span>
          </span>
        </div>

        <h1 className="login-title">Giris yap</h1>
        <p className="login-sub">Panel hesabinizla oturum acin.</p>

        {error && (
          <div className="login-alert error" key={error}>
            <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor">
              <path d="M12 2 1 21h22L12 2Zm0 6a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0V9a1 1 0 0 1 1-1Zm0 9.5a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4Z" />
            </svg>
            {error}
          </div>
        )}

        <form onSubmit={submit} className="login-form">
          <div>
            <label className="lbl" htmlFor="username">
              Kullanici adi
            </label>
            <div className="input-wrap">
              <span className="input-wrap-icon">
                <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor">
                  <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.42 0-8 2.24-8 5v1a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1c0-2.76-3.58-5-8-5Z" />
                </svg>
              </span>
              <input
                id="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="kullanici"
                required
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="lbl" htmlFor="password">
              Parola
            </label>
            <div className="input-wrap">
              <span className="input-wrap-icon">
                <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor">
                  <path d="M17 9V7a5 5 0 0 0-10 0v2a3 3 0 0 0-3 3v6a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-6a3 3 0 0 0-3-3ZM9 7a3 3 0 0 1 6 0v2H9V7Z" />
                </svg>
              </span>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                className="input-wrap-btn"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Parolayi gizle" : "Parolayi goster"}
              >
                {showPassword ? "gizle" : "goster"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className={busy ? "btn-login loading" : "btn-login"}
            disabled={busy}
          >
            <span className="btn-text">
              Giris <span aria-hidden="true">→</span>
            </span>
          </button>
        </form>

        <p className="login-footer">
          ERN Holding &middot; ERN Taahhüt
          <br />
          Gelistirici: {DEVELOPER}
        </p>
      </div>
    </div>
  );
}
