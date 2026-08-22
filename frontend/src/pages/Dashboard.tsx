import { useEffect, useState } from "react";

import { api, type Company, type Dashboard as Data } from "../api";
import { locale, useI18n } from "../i18n";

export default function Dashboard() {
  const { t, lang } = useI18n();
  const hours = (minutes: number) =>
    lang === "tr"
      ? `${Math.floor(minutes / 60)} sa ${minutes % 60} dk`
      : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;

  const [companyId, setCompanyId] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listCompanies().then(setCompanies).catch(() => {});
  }, []);

  useEffect(() => {
    api
      .dashboard(companyId || undefined)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, [companyId]);

  if (error) return <p className="error-text">{error}</p>;
  if (!data) return <p className="hint">{t("app.loading")}</p>;

  // Sutunlari en yuksek gune gore olcekliyoruz; sabit bir tavan kullanmak
  // az hareketli gunlerde grafigi bombos gosterirdi.
  const peak = Math.max(1, ...data.last_days.map((d) => d.hours));

  return (
    <section>
      <div className="page-head">
        <h1>{t("dash.title")}</h1>
        <select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
          <option value="">{t("common.allCompanies")}</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="stat-row">
        <div className="stat">
          <span className="stat-label">{t("dash.employees")}</span>
          <strong>{data.employee_count}</strong>
          <span className="hint">
            {data.with_card} {t("dash.withCard")}
          </span>
        </div>
        <div className="stat ok">
          <span className="stat-label">{t("dash.inside")}</span>
          <strong>{data.inside_now}</strong>
        </div>
        <div className="stat">
          <span className="stat-label">{t("dash.presentToday")}</span>
          <strong>{data.present_today}</strong>
        </div>
        <div className="stat">
          <span className="stat-label">{t("dash.workedToday")}</span>
          <strong>{hours(data.today_minutes)}</strong>
        </div>
        <div className="stat">
          <span className="stat-label">{t("dash.checkpoints")}</span>
          <strong>{data.checkpoints_active}</strong>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-title">{t("dash.chart")}</div>
          <div className="chart">
            {data.last_days.map((d) => (
              <div className="chart-col" key={d.work_date}>
                <span className="chart-value">{d.hours.toFixed(1)}</span>
                <div
                  className="chart-bar"
                  style={{ height: `${Math.round((d.hours / peak) * 100)}%` }}
                  title={`${d.people} · ${d.hours.toFixed(1)}`}
                />
                <span className="chart-label">
                  {new Date(d.work_date).toLocaleDateString(locale(lang), {
                    day: "2-digit",
                    month: "2-digit",
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-title">{t("dash.recent")}</div>
          <table>
            <tbody>
              {data.recent.map((r) => (
                <tr key={r.id}>
                  <td>{r.full_name}</td>
                  <td>
                    <span className={`direction ${r.direction}`}>
                      {r.direction === "in" ? t("common.in") : t("common.out")}
                    </span>
                  </td>
                  <td className="hint">
                    {new Date(r.occurred_at).toLocaleString(locale(lang), {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </td>
                </tr>
              ))}
              {data.recent.length === 0 && (
                <tr>
                  <td className="hint">{t("dash.noEvents")}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
