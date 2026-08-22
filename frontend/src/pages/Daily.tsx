import { useCallback, useEffect, useState } from "react";

import {
  api,
  type AttendanceEvent,
  type Company,
  type DailySummary,
  type Employee,
} from "../api";

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function formatDuration(minutes: number) {
  return `${Math.floor(minutes / 60)} sa ${minutes % 60} dk`;
}

function formatTime(iso: string | null) {
  return iso ? new Date(iso).toLocaleTimeString("tr-TR", { timeStyle: "short" }) : "-";
}

export default function Daily() {
  const today = isoDate(new Date());

  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [companyId, setCompanyId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [search, setSearch] = useState("");

  const [companies, setCompanies] = useState<Company[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [rows, setRows] = useState<DailySummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /// Aktivitesi acilan personel ve hareketleri.
  const [activity, setActivity] = useState<{
    name: string;
    events: AttendanceEvent[];
  } | null>(null);

  useEffect(() => {
    api.listCompanies().then(setCompanies).catch(() => {});
    api.listEmployees().then(setEmployees).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      setError(null);
      setRows(
        await api.daily({
          from,
          to,
          companyId: companyId || undefined,
          employeeId: employeeId || undefined,
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [from, to, companyId, employeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openActivity(row: DailySummary) {
    try {
      setError(null);
      const events = await api.events({
        employeeId: row.employee_id,
        from,
        to,
        limit: 500,
      });
      setActivity({ name: row.full_name, events });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function exportExcel() {
    try {
      setError(null);
      await api.downloadTimesheet({
        from,
        to,
        companyId: companyId || undefined,
        employeeId: employeeId || undefined,
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function quickRange(days: number) {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days + 1);
    setFrom(isoDate(start));
    setTo(isoDate(end));
  }

  // Ad/sicil aramasi istemci tarafinda: liste zaten ekranda ve sunucuya
  // her tusa basista gitmek gereksiz yuk olurdu.
  const visible = rows.filter((r) => {
    const q = search.trim().toLocaleLowerCase("tr");
    if (!q) return true;
    return (
      r.full_name.toLocaleLowerCase("tr").includes(q) ||
      r.employee_no.toLocaleLowerCase("tr").includes(q)
    );
  });

  const totalMinutes = visible.reduce((sum, r) => sum + r.worked_minutes, 0);
  const people = new Set(visible.map((r) => r.employee_id)).size;
  const unmatched = visible.reduce((sum, r) => sum + r.unmatched, 0);

  return (
    <section>
      <h1>Puantaj</h1>

      <div className="card">
        <div className="card-title">Filtre</div>
        <div className="form-row">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <span className="hint">—</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />

          <button className="ghost" onClick={() => quickRange(1)}>
            Bugun
          </button>
          <button className="ghost" onClick={() => quickRange(7)}>
            Son 7 gun
          </button>
          <button className="ghost" onClick={() => quickRange(30)}>
            Son 30 gun
          </button>

          <select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
            <option value="">Tum firmalar</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">Tum personel</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.employee_no} - {e.first_name} {e.last_name}
              </option>
            ))}
          </select>

          <input
            placeholder="Ad veya sicil ara"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <button onClick={() => void exportExcel()}>Excel'e aktar</button>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat">
          <span className="stat-label">Personel</span>
          <strong>{people}</strong>
        </div>
        <div className="stat">
          <span className="stat-label">Kayit</span>
          <strong>{visible.length}</strong>
        </div>
        <div className="stat">
          <span className="stat-label">Toplam calisma</span>
          <strong>{formatDuration(totalMinutes)}</strong>
        </div>
        <div className={unmatched > 0 ? "stat warn" : "stat"}>
          <span className="stat-label">Eslesmeyen hareket</span>
          <strong>{unmatched}</strong>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="card table-scroll">
        <table>
          <thead>
            <tr>
              <th>Tarih</th>
              <th>Sicil</th>
              <th>Personel</th>
              <th>Firma</th>
              <th>Unvan</th>
              <th>Ilk giris</th>
              <th>Son cikis</th>
              <th>Calisilan</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={`${r.employee_id}-${r.work_date}`}>
                <td className="hint">
                  {new Date(r.work_date).toLocaleDateString("tr-TR")}
                </td>
                <td>
                  <strong>{r.employee_no}</strong>
                </td>
                <td>{r.full_name}</td>
                <td>
                  {r.company_name ? (
                    <span className="badge">{r.company_name}</span>
                  ) : (
                    <span className="hint">-</span>
                  )}
                </td>
                <td className="hint">{r.title ?? "-"}</td>
                <td>{formatTime(r.first_in)}</td>
                <td>{formatTime(r.last_out)}</td>
                <td>
                  {formatDuration(r.worked_minutes)}
                  {r.unmatched > 0 && (
                    <span
                      className="badge warn"
                      title="Cikisi eslesmeyen giris var; sure eksik hesaplandi"
                    >
                      eksik
                    </span>
                  )}
                </td>
                <td>
                  <button className="ghost" onClick={() => void openActivity(r)}>
                    Aktivite
                  </button>
                </td>
              </tr>
            ))}
            {visible.length === 0 && !busy && (
              <tr>
                <td colSpan={9} className="hint">
                  Bu aralikta hareket yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {activity && (
        <ActivityModal
          name={activity.name}
          events={activity.events}
          onClose={() => setActivity(null)}
        />
      )}
    </section>
  );
}

/// Bir personelin secili aralikaki tum hareketleri, varsa kamera goruntusuyle.
function ActivityModal({
  name,
  events,
  onClose,
}: {
  name: string;
  events: AttendanceEvent[];
  onClose: () => void;
}) {
  const [photos, setPhotos] = useState<Record<number, string>>({});

  useEffect(() => {
    let cancelled = false;
    const created: string[] = [];

    // Fotograflar korumali uctan geliyor; blob URL'e cevirip gosteriyoruz.
    void Promise.all(
      events
        .filter((e) => e.has_photo)
        .map(async (e) => {
          try {
            const url = await api.photoUrl(e.id);
            created.push(url);
            if (!cancelled) setPhotos((prev) => ({ ...prev, [e.id]: url }));
          } catch {
            // Fotograf okunamadiysa satir fotografsiz gosterilir.
          }
        }),
    );

    return () => {
      cancelled = true;
      created.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [events]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <strong>{name}</strong>
          <span className="hint">{events.length} hareket</span>
          <button className="ghost" onClick={onClose}>
            Kapat
          </button>
        </div>

        <div className="activity-list">
          {events.map((e) => (
            <div key={e.id} className={`activity ${e.direction}`}>
              {photos[e.id] ? (
                <img src={photos[e.id]} alt="" className="activity-photo" />
              ) : (
                <div className="activity-photo empty">
                  {e.has_photo ? "..." : "foto yok"}
                </div>
              )}
              <div className="activity-body">
                <span className="direction">
                  {e.direction === "in" ? "GIRIS" : "CIKIS"}
                </span>
                <strong>
                  {new Date(e.occurred_at).toLocaleString("tr-TR", {
                    dateStyle: "short",
                    timeStyle: "medium",
                  })}
                </strong>
                <span className="hint">
                  {e.checkpoint_code ?? "nokta yok"}
                  {e.marker_id !== null && ` · ArUco ${e.marker_id}`}
                  {e.is_manual && " · elle"}
                </span>
              </div>
            </div>
          ))}
          {events.length === 0 && <p className="hint">Hareket yok.</p>}
        </div>
      </div>
    </div>
  );
}
