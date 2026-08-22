import { useEffect, useState } from "react";

import { api, type Checkpoint, type Company } from "../api";
import { locale, useI18n } from "../i18n";

export default function Checkpoints() {
  const { t, lang } = useI18n();
  const [rows, setRows] = useState<Checkpoint[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);

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
      const created = await api.createCheckpoint(code, name, companyId || undefined);
      setCode("");
      setName("");
      // Yeni anahtari hemen gosteriyoruz: nokta zaten kiosku baglamak icin
      // olusturuluyor, kullanicinin ayrica "Goster"e basmasi gereksiz.
      setShown((prev) => ({ ...prev, [created.id]: true }));
      await reload();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section>
      <h1>{t("cp.title")}</h1>
      <p className="hint">
        {t("cp.info")}
      </p>

      <form className="card" onSubmit={submit}>
        <div className="card-title">{t("cp.new")}</div>
        <div className="form-row">
          <input
            placeholder={`${t("cp.code")} (ANA-GIRIS)`}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            required
          />
          <input
            placeholder={t("cp.name")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{ minWidth: "14rem" }}
          />
          <select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
            <option value="">{t("cp.optionalCompany")}</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button type="submit">{t("cp.create")}</button>
        </div>
      </form>

      {error && <p className="error-text">{error}</p>}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>{t("cp.code")}</th>
              <th>{t("cp.name")}</th>
              <th>{t("cp.key")}</th>
              <th>{t("cp.lastSeen")}</th>
              <th>{t("common.status")}</th>
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
                    {shown[r.id] ? t("common.hide") : t("common.show")}
                  </button>
                  {shown[r.id] && (
                    <button
                      className="ghost"
                      onClick={() => {
                        void navigator.clipboard.writeText(r.api_key);
                        setCopied(r.id);
                      }}
                    >
                      {copied === r.id ? t("common.copied") : t("common.copy")}
                    </button>
                  )}
                </td>
                <td className="hint">
                  {r.last_seen_at
                    ? new Date(r.last_seen_at).toLocaleString(locale(lang))
                    : t("common.never")}
                </td>
                <td>
                  <span className={r.is_active ? "badge" : "badge muted"}>
                    {r.is_active ? t("common.active") : t("common.passive")}
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="hint">
                  {t("cp.empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
