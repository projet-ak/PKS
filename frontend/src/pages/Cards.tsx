import { useEffect, useMemo, useState } from "react";

import { api, type Employee } from "../api";
import { useI18n } from "../i18n";
import MarkerCard, { DICTIONARY, markerRange } from "../MarkerCard";

export default function Cards() {
  const { t } = useI18n();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [markerId, setMarkerId] = useState("1");
  const [label, setLabel] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);

  const maxId = useMemo(() => markerRange().max, []);

  useEffect(() => {
    api
      .listEmployees()
      .then(setEmployees)
      .catch((e: Error) => setLoadError(e.message));
  }, []);

  /// Personel secilince ID ve etiket, sunucudaki tanimli karttan doldurulur;
  /// boylece basilan kart ile kioskun bekledigi ID kesinlikle ayni olur.
  function pickEmployee(id: string) {
    setSelected(id);
    const employee = employees.find((e) => e.id === id);
    if (!employee) return;
    setLabel(`${employee.first_name} ${employee.last_name}`);
    if (employee.marker_id !== null) {
      setMarkerId(String(employee.marker_id));
    }
  }

  const selectedEmployee = employees.find((e) => e.id === selected);
  const cardless = selectedEmployee && selectedEmployee.marker_id === null;
  const mismatch =
    selectedEmployee &&
    selectedEmployee.marker_id !== null &&
    String(selectedEmployee.marker_id) !== markerId;

  return (
    <section>
      <h1 className="no-print">{t("cards.title")}</h1>

      <div className="card no-print">
        <div className="card-title">{t("cards.info")}</div>
        <div className="form-row">
          <select value={selected} onChange={(e) => pickEmployee(e.target.value)}>
            <option value="">{t("cards.pickEmployee")}</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.employee_no} - {e.first_name} {e.last_name}
                {e.marker_id === null ? ` (${t("cards.noCard")})` : ` (ID ${e.marker_id})`}
              </option>
            ))}
          </select>

          <input
            type="number"
            min={0}
            max={maxId}
            value={markerId}
            onChange={(e) => setMarkerId(e.target.value)}
            placeholder="ArUco ID"
          />
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t("cards.labelPlaceholder")}
            style={{ minWidth: "16rem" }}
          />
          <button onClick={() => window.print()}>{t("common.print")}</button>
        </div>
      </div>

      <p className="hint no-print">
        {DICTIONARY} {t("cards.range", { max: maxId })}
      </p>

      {loadError && <p className="error-text no-print">{loadError}</p>}

      {cardless && (
        <p className="error-text no-print">
          {t("cards.cardless")}
        </p>
      )}

      {mismatch && (
        <p className="error-text no-print">
          {t("cards.mismatch", { id: selectedEmployee?.marker_id ?? "" })}
        </p>
      )}

      <MarkerCard
        markerId={markerId}
        label={label}
        sublabel={selectedEmployee?.company_name ?? undefined}
      />
    </section>
  );
}
