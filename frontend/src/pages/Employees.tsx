import { useEffect, useState } from "react";

import { api, type Employee } from "../api";

const EMPTY_FORM = {
  employee_no: "",
  first_name: "",
  last_name: "",
  title: "",
  hired_on: new Date().toISOString().slice(0, 10),
};

export default function Employees() {
  const [rows, setRows] = useState<Employee[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [markerInput, setMarkerInput] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    try {
      setRows(await api.listEmployees());
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
      await api.createEmployee(form);
      setForm(EMPTY_FORM);
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

  async function revoke(employeeId: string) {
    try {
      setError(null);
      await api.revokeCard(employeeId);
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

  return (
    <section>
      <h1>Personel</h1>

      <form className="card form-row" onSubmit={submit}>
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
        <input
          type="date"
          value={form.hired_on}
          onChange={(e) => setForm({ ...form, hired_on: e.target.value })}
          required
        />
        <button type="submit">Ekle</button>
      </form>

      {error && <p className="error-text">{error}</p>}

      <table className="card">
        <thead>
          <tr>
            <th>Sicil</th>
            <th>Ad Soyad</th>
            <th>Unvan</th>
            <th>Ise giris</th>
            <th>Kart</th>
            <th>ArUco tanimla</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.employee_no}</td>
              <td>
                {r.first_name} {r.last_name}
              </td>
              <td>{r.title ?? "-"}</td>
              <td>{r.hired_on}</td>
              <td>
                {r.marker_id === null ? (
                  <span className="hint">yok</span>
                ) : (
                  <strong>{r.marker_id}</strong>
                )}
              </td>
              <td className="form-row">
                <button onClick={() => void assignFromNo(r.id)}>Sicilden</button>
                <input
                  placeholder="Elle ID"
                  style={{ minWidth: "6rem" }}
                  value={markerInput[r.id] ?? ""}
                  onChange={(e) =>
                    setMarkerInput({ ...markerInput, [r.id]: e.target.value })
                  }
                />
                <button onClick={() => void assign(r.id)}>Tanimla</button>
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
              <td colSpan={6} className="hint">
                Henuz personel yok.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
