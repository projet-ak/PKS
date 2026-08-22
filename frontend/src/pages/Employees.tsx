import { useEffect, useState } from "react";

import { api, type Company, type Employee } from "../api";

const EMPTY_FORM = {
  employee_no: "",
  first_name: "",
  last_name: "",
  title: "",
  hired_on: new Date().toISOString().slice(0, 10),
  company_id: "",
};

export default function Employees() {
  const [rows, setRows] = useState<Employee[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [filter, setFilter] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [markerInput, setMarkerInput] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function reload(companyId = filter) {
    try {
      setRows(await api.listEmployees(companyId || undefined));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    api
      .listCompanies()
      .then((list) => {
        setCompanies(list);
        // Ilk firmayi forma varsayilan yap; her personel bir firmaya ait olmali.
        setForm((f) => (f.company_id ? f : { ...f, company_id: list[0]?.id ?? "" }));
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    void reload(filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setError(null);
      await api.createEmployee({
        ...form,
        company_id: form.company_id || null,
      });
      setForm({ ...EMPTY_FORM, company_id: form.company_id });
      await reload();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  /// ArUco ID'yi sicilden turetmeyi sunucuya birakir.
  async function assignFromNo(employeeId: string) {
    try {
      setError(null);
      await api.assignCardFromEmployeeNo(employeeId);
      await reload();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function assign(employeeId: string) {
    const raw = markerInput[employeeId];
    const markerId = Number(raw);
    if (!raw || Number.isNaN(markerId)) {
      setError("Gecerli bir ArUco ID girin");
      return;
    }
    try {
      setError(null);
      await api.assignCard(employeeId, markerId);
      setMarkerInput({ ...markerInput, [employeeId]: "" });
      await reload();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function revoke(employeeId: string) {
    try {
      setError(null);
      await api.revokeCard(employeeId);
      await reload();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section>
      <h1>Personel</h1>

      <form className="card" onSubmit={submit}>
        <div className="card-title">Yeni personel</div>
        <div className="form-row">
          <input
            placeholder="Sicil no"
            value={form.employee_no}
            onChange={(e) => setForm({ ...form, employee_no: e.target.value })}
            required
          />
          <input
            placeholder="Ad"
            value={form.first_name}
            onChange={(e) => setForm({ ...form, first_name: e.target.value })}
            required
          />
          <input
            placeholder="Soyad"
            value={form.last_name}
            onChange={(e) => setForm({ ...form, last_name: e.target.value })}
            required
          />
          <input
            placeholder="Unvan"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <select
            value={form.company_id}
            onChange={(e) => setForm({ ...form, company_id: e.target.value })}
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={form.hired_on}
            onChange={(e) => setForm({ ...form, hired_on: e.target.value })}
            required
          />
          <button type="submit">Ekle</button>
        </div>
      </form>

      <div className="form-row" style={{ marginBottom: "0.9rem" }}>
        <span className="hint">Firma</span>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">Tumu</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <span className="hint">{rows.length} kayit</span>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Sicil</th>
              <th>Ad Soyad</th>
              <th>Firma</th>
              <th>Unvan</th>
              <th>Ise giris</th>
              <th>Kart</th>
              <th>ArUco tanimla</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <strong>{r.employee_no}</strong>
                </td>
                <td>
                  {r.first_name} {r.last_name}
                </td>
                <td>
                  {r.company_name ? (
                    <span className="badge">{r.company_name}</span>
                  ) : (
                    <span className="hint">-</span>
                  )}
                </td>
                <td>{r.title ?? "-"}</td>
                <td className="hint">{r.hired_on}</td>
                <td>
                  {r.marker_id === null ? (
                    <span className="hint">yok</span>
                  ) : (
                    <span className="badge">{r.marker_id}</span>
                  )}
                </td>
                <td className="form-row">
                  <button className="ghost" onClick={() => void assignFromNo(r.id)}>
                    Sicilden
                  </button>
                  <input
                    placeholder="Elle ID"
                    style={{ minWidth: "6rem" }}
                    value={markerInput[r.id] ?? ""}
                    onChange={(e) =>
                      setMarkerInput({ ...markerInput, [r.id]: e.target.value })
                    }
                  />
                  <button className="ghost" onClick={() => void assign(r.id)}>
                    Tanimla
                  </button>
                  {r.marker_id !== null && (
                    <button className="ghost" onClick={() => void revoke(r.id)}>
                      Iptal
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="hint">
                  Henuz personel yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
