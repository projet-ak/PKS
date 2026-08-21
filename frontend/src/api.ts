// Backend ile konusan ince katman. Tum cagrilar Vite proxy'si uzerinden /api'ye gider.

export interface Employee {
  id: string;
  employee_no: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  department_id: string | null;
  hired_on: string;
  is_active: boolean;
  /// Aktif ArUco kartinin marker ID'si; kart tanimli degilse null.
  marker_id: number | null;
}

export interface ScanResponse {
  employee_id: string;
  employee_no: string;
  full_name: string;
  direction: "in" | "out";
  occurred_at: string;
  duplicate_ignored: boolean;
}

export interface DailySummary {
  employee_id: string;
  full_name: string;
  work_date: string;
  first_in: string | null;
  last_out: string | null;
  worked_minutes: number;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? "istek basarisiz");
  }
  return res.json() as Promise<T>;
}

export const api = {
  listEmployees: () => request<Employee[]>("/employees"),

  createEmployee: (body: Partial<Employee>) =>
    request<Employee>("/employees", { method: "POST", body: JSON.stringify(body) }),

  assignCard: (employeeId: string, markerId: number) =>
    request(`/cards/employee/${employeeId}`, {
      method: "POST",
      body: JSON.stringify({ marker_id: markerId }),
    }),

  /// ArUco ID'yi personelin sicil numarasindan turetir. Kural sunucuda tek
  /// yerde durur, boylece panel ile kart sayfasi ayrisamaz.
  assignCardFromEmployeeNo: (employeeId: string) =>
    request(`/cards/employee/${employeeId}/auto`, { method: "POST" }),

  revokeCard: (employeeId: string) =>
    request(`/cards/employee/${employeeId}`, { method: "DELETE" }),

  scan: (markerId: number, checkpointCode?: string) =>
    request<ScanResponse>("/attendance/scan", {
      method: "POST",
      body: JSON.stringify({ marker_id: markerId, checkpoint_code: checkpointCode }),
    }),

  daily: (date?: string) =>
    request<DailySummary[]>(`/attendance/daily${date ? `?date=${date}` : ""}`),
};
