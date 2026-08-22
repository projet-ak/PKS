import { useEffect, useState } from "react";

import { api, type AppUser } from "../api";
import { useAuth } from "../auth";
import { locale, useI18n } from "../i18n";

/// Backend'deki ROLES ile ayni olmali; etiketler sozlukten gelir.
const ROLES = ["admin", "hr", "manager", "viewer"] as const;

export default function Users() {
  const { user: me } = useAuth();
  const { t, lang } = useI18n();

  const roleLabel = (role: string) =>
    ROLES.includes(role as (typeof ROLES)[number])
      ? t(`usr.role.${role}` as "usr.role.admin")
      : role;
  const roleNote = (role: string) => t(`usr.note.${role}` as "usr.note.admin");
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
      <h1>{t("usr.title")}</h1>
      <p className="hint">
{t("usr.info")}
      </p>

      <form className="card" onSubmit={submit}>
        <div className="card-title">{t("usr.new")}</div>
        <div className="form-row">
          <input
            placeholder={t("login.username")}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <input
            placeholder={t("emp.fullName")}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            style={{ minWidth: "12rem" }}
          />
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {roleLabel(r)}
              </option>
            ))}
          </select>
          <input
            type="password"
            placeholder={t("usr.passwordPlaceholder")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
          <button type="submit">{t("common.add")}</button>
        </div>
        <p className="hint" style={{ marginTop: "0.5rem" }}>
          {roleNote(role)}
        </p>
      </form>

      {error && <p className="error-text">{error}</p>}

      <div className="card table-scroll">
        <table>
          <thead>
            <tr>
              <th>{t("usr.username")}</th>
              <th>{t("emp.fullName")}</th>
              <th>{t("usr.role")}</th>
              <th>{t("common.status")}</th>
              <th>{t("usr.lastLogin")}</th>
              <th>{t("common.actions")}</th>
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
                        <option key={o} value={o}>
                          {roleLabel(o)}
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
                      {t("common.active")}
                    </label>
                  </td>
                  <td>
                    <input
                      type="password"
                      placeholder={t("usr.newPassword")}
                      value={editing.password}
                      onChange={(e) =>
                        setEditing({ ...editing, password: e.target.value })
                      }
                      style={{ minWidth: "12rem" }}
                    />
                  </td>
                  <td>
                    <div className="cell-actions">
                      <button onClick={() => void save()}>{t("common.save")}</button>
                      <button className="ghost" onClick={() => setEditing(null)}>
                        {t("common.cancel")}
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={r.id}>
                  <td>
                    <strong>{r.username}</strong>
                    {me?.id === r.id && <span className="badge">{t("usr.you")}</span>}
                  </td>
                  <td>{r.full_name ?? "-"}</td>
                  <td>
                    <span className="badge">{roleLabel(r.role)}</span>
                  </td>
                  <td>
                    <span className={r.is_active ? "badge ok" : "badge muted"}>
                      {r.is_active ? t("common.active") : t("common.passive")}
                    </span>
                  </td>
                  <td className="hint">
                    {r.last_login
                      ? new Date(r.last_login).toLocaleString(locale(lang))
                      : t("common.never")}
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
                        {t("common.edit")}
                      </button>
                      <button
                        className="ghost"
                        disabled={me?.id === r.id || !r.is_active}
                        title={
                          me?.id === r.id
                            ? t("usr.cannotSelf")
                            : t("common.deactivate")
                        }
                        onClick={() => void remove(r.id)}
                      >
                        {t("common.deactivate")}
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
