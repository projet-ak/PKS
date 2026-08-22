use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Department {
    pub id: Uuid,
    pub name: String,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Employee {
    pub id: Uuid,
    pub employee_no: String,
    pub first_name: String,
    pub last_name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub title: Option<String>,
    pub department_id: Option<Uuid>,
    pub hired_on: NaiveDate,
    pub is_active: bool,
    pub company_id: Option<Uuid>,
    pub company_name: Option<String>,
    /// Personelin aktif ArUco kartinin marker ID'si; kart yoksa None.
    pub marker_id: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct NewEmployee {
    pub employee_no: String,
    pub first_name: String,
    pub last_name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub title: Option<String>,
    pub department_id: Option<Uuid>,
    pub hired_on: NaiveDate,
    pub company_id: Option<Uuid>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ArucoCard {
    pub id: Uuid,
    pub marker_id: i32,
    pub dictionary: String,
    pub employee_id: Uuid,
    pub issued_at: DateTime<Utc>,
    pub revoked_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct AssignCard {
    pub marker_id: i32,
    #[serde(default = "default_dictionary")]
    pub dictionary: String,
}

fn default_dictionary() -> String {
    "ARUCO_MIP_36h12".to_string()
}

/// Kioskun okudugu ArUco markeri sunucuya bildirmesi.
#[derive(Debug, Deserialize)]
pub struct ScanRequest {
    pub marker_id: i32,
    #[serde(default = "default_dictionary")]
    pub dictionary: String,
    /// "in" veya "out" verilirse yon zorlanir. Giris ve cikis icin ayri
    /// kamera kuruldugunda her cihaz kendi yonunu bildirir. Bos birakilirsa
    /// yon personelin son hareketine gore kendiliginden belirlenir.
    pub direction: Option<String>,
}

/// Kioska donen cevap: kimin, hangi yonde kaydi acildi.
#[derive(Debug, Serialize)]
pub struct ScanResponse {
    pub employee_id: Uuid,
    pub employee_no: String,
    pub full_name: String,
    /// Kiosk ekraninda kimin gectigi kadar hangi firmadan ve hangi gorevde
    /// oldugu da gorunsun; kapidaki gorevli dogrulamayi buradan yapar.
    pub company_name: Option<String>,
    pub title: Option<String>,
    pub direction: String,
    pub occurred_at: DateTime<Utc>,
    /// Debounce penceresinde tekrar okundugu icin yeni kayit acilmadiysa true.
    pub duplicate_ignored: bool,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct AttendanceEvent {
    pub id: i64,
    pub employee_id: Uuid,
    pub direction: String,
    pub occurred_at: DateTime<Utc>,
    pub marker_id: Option<i32>,
    pub is_manual: bool,
}

/// Bir personelin bir gunku mesai ozeti.
#[derive(Debug, Serialize)]
pub struct DailySummary {
    pub employee_id: Uuid,
    pub full_name: String,
    pub work_date: NaiveDate,
    pub first_in: Option<DateTime<Utc>>,
    pub last_out: Option<DateTime<Utc>>,
    pub worked_minutes: i64,
}
