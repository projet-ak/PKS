import { useState } from "react";

import { useAuth } from "../auth";
import { DEVELOPER, LOGOS } from "../logos";

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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
        <div className="login-logos">
          <img src={LOGOS.holdingWhite} alt="ERN Holding" />
          <img src={LOGOS.taahhutWhite} alt="ERN Taahhüt" />
        </div>
        <div>
          <h2>Personel Takip Sistemi</h2>
          <p>
            ArUco kartlariyla santiye giris-cikis takibi, puantaj ve izin
            yonetimi.
          </p>
        </div>
      </div>

      <div className="login-right">
        <form className="login-form" onSubmit={submit}>
          <h1>Giris yap</h1>
          <p className="hint">Panel hesabinizla oturum acin.</p>

          <input
            placeholder="Kullanici adi"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus
          />
          <input
            type="password"
            placeholder="Parola"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && <p className="error-text">{error}</p>}

          <button type="submit" disabled={busy}>
            {busy ? "Kontrol ediliyor..." : "Giris"}
          </button>

          <p className="login-foot">
            ERN Holding &middot; ERN Taahhüt
            <br />
            Gelistirici: {DEVELOPER}
          </p>
        </form>
      </div>
    </div>
  );
}
