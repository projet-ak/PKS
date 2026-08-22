import { useEffect, useState } from "react";

import { api, type Company, type Employee } from "../api";
import MarkerCard from "../MarkerCard";

/// Form alanlari; hem ekleme hem duzenleme icin ayni sekil kullanilir.
interface Form {
  employee_no: string;
  first_name: string;
  last_name: string;
  title: string;
  hired_on: string;
  company_id: string;
}

const EMPTY_FORM: Form = {
  employee_no: "",
  first_name: "",
  last_name: "",
  title: "",
  hired_on: new Date().toISOString().slice(0, 10),
  company_id: "",
};

function toForm(e: Employee): Form {
  return {
    employee_no: e.employee_no,
    first_name: e.first_name,
    last_name: e.last_name,
    title: e.title ?? "",
    hired_on: e.hired_on,
    company_id: e.company_id ?? "",
  };
}

export default function Employees() {
  const [rows, setRows] = useState<Employee[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [filter, setFilter] = useState("");
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [markerInput, setMarkerInput] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  /// Duzenlenen satirin kimligi ve uzerinde calisilan kopya.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Form>(EMPTY_FORM);

  /// Karti onizlenen personel; yazdirma bu kayit uzerinden yapilir.
  const [printing, setPrinting] = useState<Employee | null>(null);

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
      await api.createEmployee({ ...form, company_id: form.company_id || null });
      setForm({ ...EMPTY_FORM, company_id: form.company_id });
      await reload();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function saveEdit(id: string) {
    try {
      setError(null);
      await api.updateEmployee(id, {
        ...editForm,
        company_id: editForm.company_id || null,
      });
      setEditingId(null);
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
      <h1 className="no-print">Personel</h1>

      <form className="card no-print" onSubmit={submit}>
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

      <div className="form-row no-print" style={{ marginBottom: "0.9rem" }}>
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

      {error && <p className="error-text no-print">{error}</p>}

      <div className="card no-print">
        <table>
          <thead>
            <tr>
              <th>Sicil</th>
              <th>Ad Soyad</th>
              <th>Firma</th>
              <th>Unvan</th>
              <th>Ise giris</th>
              <th>Kart</th>
              <th>Islem</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) =>
              editingId === r.id ? (
                <tr key={r.id}>
                  <td>
                    <input
                      value={editForm.employee_no}
                      onChange={(e) =>
                        setEditForm({ ...editForm, employee_no: e.target.value })
                      }
                      style={{ minWidth: "6rem" }}
                    />
                  </td>
                  <td className="form-row">
                    <input
                      value={editForm.first_name}
                      onChange={(e) =>
                        setEditForm({ ...editForm, first_name: e.target.value })
                      }
                      style={{ minWidth: "7rem" }}
                    />
                    <input
                      value={editForm.last_name}
                      onChange={(e) =>
                        setEditForm({ ...editForm, last_name: e.target.value })
                      }
                      style={{ minWidth: "7rem" }}
                    />
                  </td>
                  <td>
                    <select
                      value={editForm.company_id}
                      onChange={(e) =>
                        setEditForm({ ...editForm, company_id: e.target.value })
                      }
                    >
                      <option value="">-</option>
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      value={editForm.title}
                      onChange={(e) =>
                        setEditForm({ ...editForm, title: e.target.value })
                      }
                      style={{ minWidth: "7rem" }}
                    />
                  </td>
                  <td>
                    <input
                      type="date"
                      value={editForm.hired_on}
                      onChange={(e) =>
                        setEditForm({ ...editForm, hired_on: e.target.value })
                      }
                    />
                  </td>
                  <td className="hint">{r.marker_id ?? "yok"}</td>
                  <td className="form-row">
                    <button onClick={() => void saveEdit(r.id)}>Kaydet</button>
                    <button className="ghost" onClick={() => setEditingId(null)}>
                      Vazgec
                    </button>
                  </td>
                </tr>
              ) : (
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
                  <td className="form-row">
                    {r.marker_id === null ? (
                      <span className="hint">yok</span>
                    ) : (
                      <span className="badge">{r.marker_id}</span>
                    )}
                    <button className="ghost" onClick={() => void assignFromNo(r.id)}>
                      Sicilden
                    </button>
                    <input
                      placeholder="Elle"
                      style={{ minWidth: "5rem" }}
                      value={markerInput[r.id] ?? ""}
                      onChange={(e) =>
                        setMarkerInput({ ...markerInput, [r.id]: e.target.value })
                      }
                    />
                    <button className="ghost" onClick={() => void assign(r.id)}>
                      Tanimla
                    </button>
                  </td>
                  <td className="form-row">
                    <button
                      className="ghost"
                      onClick={() => {
                        setEditingId(r.id);
                        setEditForm(toForm(r));
                      }}
                    >
                      Duzenle
                    </button>
                    <button
                      className="ghost"
                      disabled={r.marker_id === null}
                      title={
                        r.marker_id === null
                          ? "Once ArUco kart tanimlayin"
                          : "Karti onizle ve yazdir"
                      }
                      onClick={() => setPrinting(r)}
                    >
                      Kart
                    </button>
                    {r.marker_id !== null && (
                      <button className="ghost" onClick={() => void revoke(r.id)}>
                        Kart iptal
                      </button>
                    )}
                  </td>
                </tr>
              ),
            )}
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

      {printing && printing.marker_id !== null && (
        <div className="modal-backdrop" onClick={() => setPrinting(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="card-title no-print">
              {printing.employee_no} — {printing.first_name} {printing.last_name}
            </div>

            <MarkerCard
              markerId={printing.marker_id}
              label={`${printing.first_name} ${printing.last_name}`}
              sublabel={printing.company_name ?? undefined}
            />

            <div className="form-row no-print" style={{ marginTop: "1rem" }}>
              <button onClick={() => window.print()}>Yazdir</button>
              <button className="ghost" onClick={() => setPrinting(null)}>
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
