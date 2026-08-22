import { useEffect, useState } from "react";

import { api, type Checkpoint, type Company } from "../api";

export default function Checkpoints() {
  const [rows, setRows] = useState<Checkpoint[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState<Record<string, boolean>>({});

  async function reload() {
    try {
      setRows(await api.listCheckpoints());
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    void reload();
    api.listCompanies().then(setCompanies).catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setError(null);
      await api.createCheckpoint(code, name, companyId || undefined);
      setCode("");
      setName("");
      await reload();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section>
      <h1>Gecis Noktalari</h1>
      <p className="hint">
        Her kiosk cihazi bir gecis noktasina baglanir. Anahtari kiosk sayfasina
        bir kez girersiniz; cihaz o noktanin adina kayit acar.
      </p>

      <form className="card" onSubmit={submit}>
        <div className="card-title">Yeni nokta</div>
        <div className="form-row">
          <input
            placeholder="Kod (ANA-GIRIS)"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            required
          />
          <input
            placeholder="Ad (Ana Giris Turnikesi)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{ minWidth: "14rem" }}
          />
          <select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
            <option value="">Firma sec (istege bagli)</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button type="submit">Olustur</button>
        </div>
      </form>

      {error && <p className="error-text">{error}</p>}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Kod</th>
              <th>Ad</th>
              <th>Cihaz anahtari</th>
              <th>Son goruldu</th>
              <th>Durum</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <strong>{r.code}</strong>
                </td>
                <td>{r.name}</td>
                <td>
                  {shown[r.id] ? (
                    <code style={{ fontSize: "0.78rem" }}>{r.api_key}</code>
                  ) : (
                    <span className="hint">••••••••</span>
                  )}{" "}
                  <button
                    className="ghost"
                    onClick={() => setShown({ ...shown, [r.id]: !shown[r.id] })}
                  >
                    {shown[r.id] ? "Gizle" : "Goster"}
                  </button>
                  {shown[r.id] && (
                    <button
                      className="ghost"
                      onClick={() => void navigator.clipboard.writeText(r.api_key)}
                    >
                      Kopyala
                    </button>
                  )}
                </td>
                <td className="hint">
                  {r.last_seen_at
                    ? new Date(r.last_seen_at).toLocaleString("tr-TR")
                    : "hic"}
                </td>
                <td>
                  <span className={r.is_active ? "badge" : "badge muted"}>
                    {r.is_active ? "aktif" : "pasif"}
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="hint">
                  Henuz gecis noktasi yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
