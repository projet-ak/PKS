import { useEffect, useMemo, useState } from "react";

import { api, type Employee } from "../api";
import MarkerCard, { DICTIONARY, markerRange } from "../MarkerCard";

export default function Cards() {
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
      <h1 className="no-print">ArUco Kart Uret</h1>

      <div className="card no-print">
        <div className="card-title">Kart bilgileri</div>
        <div className="form-row">
          <select value={selected} onChange={(e) => pickEmployee(e.target.value)}>
            <option value="">Personel sec...</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.employee_no} - {e.first_name} {e.last_name}
                {e.marker_id === null ? " (kart yok)" : ` (ID ${e.marker_id})`}
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
            placeholder="Kart uzerine yazilacak ad"
            style={{ minWidth: "16rem" }}
          />
          <button onClick={() => window.print()}>Yazdir</button>
        </div>
      </div>

      <p className="hint no-print">
        {DICTIONARY} sozlugu, gecerli ID araligi 0 - {maxId}. Kart, personele
        tanimli ID ile ayni olmali; tanimlamayi Personel sayfasindan yaparsin.
      </p>

      {loadError && <p className="error-text no-print">{loadError}</p>}

      {cardless && (
        <p className="error-text no-print">
          Bu personele henuz kart tanimli degil. Personel sayfasindan "Sicilden"
          ile tanimla, yoksa kiosk bu karti tanimaz.
        </p>
      )}

      {mismatch && (
        <p className="error-text no-print">
          Gosterilen ID, personele tanimli ID ({selectedEmployee?.marker_id}) ile
          ayni degil. Bu kart kiosk tarafindan bu personel olarak okunmaz.
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
