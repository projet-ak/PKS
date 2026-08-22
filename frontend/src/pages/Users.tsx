import { useEffect, useState } from "react";

import { api, type AppUser } from "../api";
import { useAuth } from "../auth";

/// Backend'deki ROLES ile ayni olmali.
const ROLES: { value: string; label: string; note: string }[] = [
  { value: "admin", label: "Yonetici", note: "Her seyi yapar, kullanici tanimlar" },
  { value: "hr", label: "Insan Kaynaklari", note: "Personel ve kart islemleri" },
  { value: "manager", label: "Sef", note: "Personel ve kart islemleri" },
  { value: "viewer", label: "Izleyici", note: "Yalnizca goruntuler, degistiremez" },
];

function roleLabel(role: string) {
  return ROLES.find((r) => r.value === role)?.label ?? role;
}

export default function Users() {
  const { user: me } = useAuth();
  const [rows, setRows] = useState<AppUser[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("viewer");
  const [password, setPassword] = useState("");

  /// Duzenlenen satir; parola bos birakilirsa degismez.
  const [editing, setEditing] = useState<{
    id: string;
    full_name: string;
    role: string;
    is_active: boolean;
    password: string;
  } | null>(null);

  async function reload() {
    try {
      setRows(await api.listUsers());
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
      await api.createUser({
        username,
        full_name: fullName.trim() || null,
        role,
        password,
      });
      setUsername("");
      setFullName("");
      setPassword("");
      setRole("viewer");
      await reload();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function save() {
    if (!editing) return;
    try {
      setError(null);
      await api.updateUser(editing.id, {
        full_name: editing.full_name.trim() || null,
        role: editing.role,
        is_active: editing.is_active,
        password: editing.password.trim() || undefined,
      });
      setEditing(null);
      await reload();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove(id: string) {
    try {
      setError(null);
      await api.deactivateUser(id);
      await reload();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section>
      <h1>Kullanicilar</h1>
      <p className="hint">
        Yetkiler role bagli: <strong>Izleyici</strong> yalnizca goruntuler,
        veri degistiremez. <strong>Yonetici</strong> ayrica kullanici, firma ve
        gecis noktasi tanimlar.
      </p>

      <form className="card" onSubmit={submit}>
        <div className="card-title">Yeni kullanici</div>
        <div className="form-row">
          <input
            placeholder="Kullanici adi"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <input
            placeholder="Ad Soyad"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            style={{ minWidth: "12rem" }}
          />
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <input
            type="password"
            placeholder="Parola (en az 8)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
          <button type="submit">Ekle</button>
        </div>
        <p className="hint" style={{ marginTop: "0.5rem" }}>
          {ROLES.find((r) => r.value === role)?.note}
        </p>
      </form>

      {error && <p className="error-text">{error}</p>}

      <div className="card table-scroll">
        <table>
          <thead>
            <tr>
              <th>Kullanici</th>
              <th>Ad Soyad</th>
              <th>Rol</th>
              <th>Durum</th>
              <th>Son giris</th>
              <th>Islem</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) =>
              editing?.id === r.id ? (
                <tr key={r.id}>
                  <td>
                    <strong>{r.username}</strong>
                  </td>
                  <td>
                    <input
                      value={editing.full_name}
                      onChange={(e) =>
                        setEditing({ ...editing, full_name: e.target.value })
                      }
                    />
                  </td>
                  <td>
                    <select
                      value={editing.role}
                      onChange={(e) => setEditing({ ...editing, role: e.target.value })}
                    >
                      {ROLES.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <label className="hint">
                      <input
                        type="checkbox"
                        checked={editing.is_active}
                        onChange={(e) =>
                          setEditing({ ...editing, is_active: e.target.checked })
                        }
                        style={{ minWidth: "auto" }}
                      />{" "}
                      aktif
                    </label>
                  </td>
                  <td>
                    <input
                      type="password"
                      placeholder="Yeni parola (bos: degisme)"
                      value={editing.password}
                      onChange={(e) =>
                        setEditing({ ...editing, password: e.target.value })
                      }
                      style={{ minWidth: "12rem" }}
                    />
                  </td>
                  <td>
                    <div className="cell-actions">
                      <button onClick={() => void save()}>Kaydet</button>
                      <button className="ghost" onClick={() => setEditing(null)}>
                        Vazgec
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={r.id}>
                  <td>
                    <strong>{r.username}</strong>
                    {me?.id === r.id && <span className="badge">siz</span>}
                  </td>
                  <td>{r.full_name ?? "-"}</td>
                  <td>
                    <span className="badge">{roleLabel(r.role)}</span>
                  </td>
                  <td>
                    <span className={r.is_active ? "badge ok" : "badge muted"}>
                      {r.is_active ? "aktif" : "pasif"}
                    </span>
                  </td>
                  <td className="hint">
                    {r.last_login
                      ? new Date(r.last_login).toLocaleString("tr-TR")
                      : "hic"}
                  </td>
                  <td>
                    <div className="cell-actions">
                      <button
                        className="ghost"
                        onClick={() =>
                          setEditing({
                            id: r.id,
                            full_name: r.full_name ?? "",
                            role: r.role,
                            is_active: r.is_active,
                            password: "",
                          })
                        }
                      >
                        Duzenle
                      </button>
                      <button
                        className="ghost"
                        disabled={me?.id === r.id || !r.is_active}
                        title={
                          me?.id === r.id
                            ? "Kendi hesabinizi pasife alamazsiniz"
                            : "Hesabi pasife cek"
                        }
                        onClick={() => void remove(r.id)}
                      >
                        Pasife al
                      </button>
                    </div>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
