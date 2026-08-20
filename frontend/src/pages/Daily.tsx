import { useEffect, useState } from "react";

import { api, type DailySummary } from "../api";

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h} sa ${m} dk`;
}

function formatTime(iso: string | null) {
  return iso ? new Date(iso).toLocaleTimeString("tr-TR") : "-";
}

export default function Daily() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<DailySummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .daily(date)
      .then((r) => {
        setRows(r);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, [date]);

  return (
    <section>
      <h1>Gunluk Puantaj</h1>

      <div className="form-row">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      {error && <p className="error-text">{error}</p>}

      <table className="card">
        <thead>
          <tr>
            <th>Personel</th>
            <th>Ilk giris</th>
            <th>Son cikis</th>
            <th>Calisilan</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.employee_id}>
              <td>{r.full_name}</td>
              <td>{formatTime(r.first_in)}</td>
              <td>{formatTime(r.last_out)}</td>
              <td>{formatDuration(r.worked_minutes)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="hint">
                Bu tarihte hareket yok.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
