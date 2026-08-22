import { useEffect, useState } from "react";

import { api, type Company } from "../api";

export default function Companies() {
  const [rows, setRows] = useState<Company[]>([]);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    try {
      setRows(await api.listCompanies());
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setError(null);
      await api.createCompany(code, name);
      setCode("");
      setName("");
      await reload();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove(id: string) {
    try {
      setError(null);
      await api.deactivateCompany(id);
      await reload();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section>
      <h1>Firmalar</h1>
      <p className="hint">
        Personel ve gecis noktalari bir firmaya baglanir. Kod kisa ve
        degismeyen bir isim olmali; raporlarda bu kod kullanilir.
      </p>

      <form className="card" onSubmit={submit}>
        <div className="card-title">Yeni firma</div>
        <div className="form-row">
          <input
            placeholder="Kod (INSAAT)"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            required
          />
          <input
            placeholder="Ad (ERN Insaat)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{ minWidth: "16rem" }}
          />
          <button type="submit">Ekle</button>
        </div>
      </form>

      {error && <p className="error-text">{error}</p>}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Kod</th>
              <th>Ad</th>
              <th>Personel</th>
              <th></th>
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
                  <span className={r.employee_count ? "badge" : "badge muted"}>
                    {r.employee_count}
                  </span>
                </td>
                <td>
                  <button
                    className="ghost"
                    onClick={() => void remove(r.id)}
                    title={
                      r.employee_count
                        ? "Once bagli personeli baska firmaya tasiyin"
                        : "Firmayi pasife cek"
                    }
                  >
                    Pasife al
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="hint">
                  Henuz firma yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
