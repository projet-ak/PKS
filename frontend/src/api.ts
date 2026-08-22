// Backend ile konusan ince katman. Tum cagrilar /api altina gider; uretimde
// frontend ile API ayni alan adindan servis edildigi icin CORS yoktur.

export interface Company {
  id: string;
  code: string;
  name: string;
  logo_path: string | null;
  is_active: boolean;
  /// Firmaya bagli aktif personel sayisi.
  employee_count: number;
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
  company_name: string | null;
  title: string | null;
  direction: "in" | "out";
  occurred_at: string;
  duplicate_ignored: boolean;
}

export interface DailySummary {
  employee_id: string;
  employee_no: string;
  full_name: string;
  company_name: string | null;
  title: string | null;
  work_date: string;
  first_in: string | null;
  last_out: string | null;
  worked_minutes: number;
  /// Cikisi eslesmeyen giris sayisi; sure eksik hesaplanmis demektir.
  unmatched: number;
}

export interface AttendanceEvent {
  id: number;
  employee_id: string;
  employee_no: string;
  full_name: string;
  direction: "in" | "out";
  occurred_at: string;
  marker_id: number | null;
  is_manual: boolean;
  checkpoint_code: string | null;
  has_photo: boolean;
}

export interface AppUser {
  id: string;
  username: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  last_login: string | null;
}

export interface DayPoint {
  work_date: string;
  people: number;
  hours: number;
}

export interface Dashboard {
  employee_count: number;
  with_card: number;
  present_today: number;
  inside_now: number;
  today_minutes: number;
  checkpoints_active: number;
  last_days: DayPoint[];
  recent: {
    id: number;
    full_name: string;
    direction: "in" | "out";
    occurred_at: string;
    has_photo: boolean;
  }[];
}

export interface TimesheetFilter {
  from?: string;
  to?: string;
  companyId?: string;
  employeeId?: string;
}

function filterQuery(f: TimesheetFilter): string {
  const params = new URLSearchParams();
  if (f.from) params.set("from", f.from);
  if (f.to) params.set("to", f.to);
  if (f.companyId) params.set("company_id", f.companyId);
  if (f.employeeId) params.set("employee_id", f.employeeId);
  const q = params.toString();
  return q ? `?${q}` : "";
}

/// Oturum tokeni bellekte tutulur; sayfa yuklenirken AuthProvider doldurur.
let authToken: string | null = null;

export function setToken(token: string | null) {
  authToken = token;
}

/// axum'da nest("/api/x") altina kayitli "/" rotasi yalnizca /api/x yolunu
/// karsilar; /api/x/ 404 doner. Sondaki egik cizgiyi burada tek yerde
/// temizliyoruz ki her cagri noktasinda ayni hataya dusmeyelim.
function normalize(path: string): string {
  const [route, query] = path.split("?");
  const trimmed = route.length > 1 ? route.replace(/\/+$/, "") : route;
  return query ? `${trimmed}?${query}` : trimmed;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init.headers as Record<string, string>) ?? {}),
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const res = await fetch(`/api${normalize(path)}`, { ...init, headers });

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

  listCompanies: () => request<Company[]>("/companies"),

  createCompany: (code: string, name: string) =>
    request<Company>("/companies", {
      method: "POST",
      body: JSON.stringify({ code, name }),
    }),

  deactivateCompany: (id: string) =>
    request<Company>(`/companies/${id}`, { method: "DELETE" }),

  listEmployees: (companyId?: string) =>
    request<Employee[]>(
      companyId ? `/employees?company_id=${companyId}` : "/employees",
    ),

  createEmployee: (body: Record<string, unknown>) =>
    request<Employee>("/employees", { method: "POST", body: JSON.stringify(body) }),

  updateEmployee: (id: string, body: Record<string, unknown>) =>
    request<Employee>(`/employees/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

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

  listCheckpoints: () => request<Checkpoint[]>("/checkpoints"),

  /// Kiosk kurulumunda anahtarin gecerli olup olmadigini aninda sinar.
  /// Yanlis yapistirilan anahtar, kart okutulana kadar fark edilmesin diye.
  validateCheckpointKey: (key: string) =>
    request<{ code: string }>("/checkpoints/whoami", {
      method: "POST",
      headers: { "X-Checkpoint-Key": key },
    }),

  createCheckpoint: (code: string, name: string, companyId?: string) =>
    request<Checkpoint>("/checkpoints", {
      method: "POST",
      body: JSON.stringify({ code, name, company_id: companyId ?? null }),
    }),

  /// Kiosk cihazi kullanici oturumu yerine kendi anahtarini gonderir.
  scan: (
    markerId: number,
    opts: {
      direction?: "in" | "out";
      checkpointKey?: string;
      /// Okuma anindaki kare (data URL). Sunucu diske yazar.
      photo?: string;
    } = {},
  ) =>
    request<ScanResponse>("/attendance/scan", {
      method: "POST",
      headers: opts.checkpointKey ? { "X-Checkpoint-Key": opts.checkpointKey } : {},
      body: JSON.stringify({
        marker_id: markerId,
        direction: opts.direction,
        photo: opts.photo,
      }),
    }),

  daily: (f: TimesheetFilter = {}) =>
    request<DailySummary[]>(`/attendance/daily${filterQuery(f)}`),

  events: (f: TimesheetFilter & { limit?: number } = {}) => {
    const base = filterQuery(f);
    const sep = base ? "&" : "?";
    return request<AttendanceEvent[]>(
      `/attendance/events${base}${f.limit ? `${sep}limit=${f.limit}` : ""}`,
    );
  },

  dashboard: (companyId?: string) =>
    request<Dashboard>(
      `/dashboard${companyId ? `?company_id=${companyId}` : ""}`,
    ),

  listUsers: () => request<AppUser[]>("/users"),

  createUser: (body: {
    username: string;
    full_name: string | null;
    role: string;
    password: string;
  }) => request<AppUser>("/users", { method: "POST", body: JSON.stringify(body) }),

  updateUser: (
    id: string,
    body: {
      full_name: string | null;
      role: string;
      is_active: boolean;
      password?: string;
    },
  ) => request<AppUser>(`/users/${id}`, { method: "PUT", body: JSON.stringify(body) }),

  deactivateUser: (id: string) =>
    request<AppUser>(`/users/${id}`, { method: "DELETE" }),

  /// Korumali uclardan gelen ikili icerikler fetch ile alinip blob URL'ine
  /// cevrilir; <img src> ve <a download> Authorization basligi gonderemez.
  blobUrl: async (path: string): Promise<string> => {
    const res = await fetch(`/api${path}`, {
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    });
    if (!res.ok) throw new Error("dosya alinamadi");
    return URL.createObjectURL(await res.blob());
  },

  photoUrl: (eventId: number) => api.blobUrl(`/attendance/photo/${eventId}`),

  downloadTimesheet: async (f: TimesheetFilter = {}) => {
    const url = await api.blobUrl(`/reports/timesheet.xlsx${filterQuery(f)}`);
    const a = document.createElement("a");
    a.href = url;
    a.download = `puantaj_${f.from ?? ""}_${f.to ?? ""}.xlsx`;
    a.click();
    // Blob'u serbest birak; yoksa sekme kapanana kadar bellekte kalir.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  },
};
