// Backend ile konusan ince katman. Tum cagrilar /api altina gider; uretimde
// frontend ile API ayni alan adindan servis edildigi icin CORS yoktur.

export interface Company {
  id: string;
  code: string;
  name: string;
  logo_path: string | null;
}

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
  company_id: string | null;
  company_name: string | null;
  /// Aktif ArUco kartinin marker ID'si; kart tanimli degilse null.
  marker_id: number | null;
}

export interface UserInfo {
  id: string;
  username: string;
  full_name: string | null;
  role: string;
  company_id: string | null;
}

export interface LoginResponse {
  token: string;
  user: UserInfo;
}

export interface Checkpoint {
  id: string;
  code: string;
  name: string;
  api_key: string;
  company_id: string | null;
  is_active: boolean;
  last_seen_at: string | null;
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

/// Oturum tokeni bellekte tutulur; sayfa yuklenirken AuthProvider doldurur.
let authToken: string | null = null;

export function setToken(token: string | null) {
  authToken = token;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init.headers as Record<string, string>) ?? {}),
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const res = await fetch(`/api${path}`, { ...init, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? "istek basarisiz");
  }

  // 204 gibi govdesiz cevaplarda json() patlar.
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export const api = {
  login: (username: string, password: string) =>
    request<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  me: () => request<UserInfo>("/auth/me"),

  listCompanies: () => request<Company[]>("/companies/"),

  listEmployees: (companyId?: string) =>
    request<Employee[]>(
      companyId ? `/employees?company_id=${companyId}` : "/employees",
    ),

  createEmployee: (body: Record<string, unknown>) =>
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

  listCheckpoints: () => request<Checkpoint[]>("/checkpoints/"),

  /// Kiosk kurulumunda anahtarin gecerli olup olmadigini aninda sinar.
  /// Yanlis yapistirilan anahtar, kart okutulana kadar fark edilmesin diye.
  validateCheckpointKey: (key: string) =>
    request<{ code: string }>("/checkpoints/whoami", {
      method: "POST",
      headers: { "X-Checkpoint-Key": key },
    }),

  createCheckpoint: (code: string, name: string, companyId?: string) =>
    request<Checkpoint>("/checkpoints/", {
      method: "POST",
      body: JSON.stringify({ code, name, company_id: companyId ?? null }),
    }),

  /// Kiosk cihazi kullanici oturumu yerine kendi anahtarini gonderir.
  scan: (
    markerId: number,
    opts: { direction?: "in" | "out"; checkpointKey?: string } = {},
  ) =>
    request<ScanResponse>("/attendance/scan", {
      method: "POST",
      headers: opts.checkpointKey ? { "X-Checkpoint-Key": opts.checkpointKey } : {},
      body: JSON.stringify({
        marker_id: markerId,
        direction: opts.direction,
      }),
    }),

  daily: (date?: string) =>
    request<DailySummary[]>(`/attendance/daily${date ? `?date=${date}` : ""}`),
};
