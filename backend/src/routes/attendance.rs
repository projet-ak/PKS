use axum::extract::{Path, Query, State};
use axum::http::{header, HeaderMap};
use axum::response::IntoResponse;
use axum::routing::{get, post};
use axum::{Json, Router};
use chrono::{DateTime, Duration, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::auth::{checkpoint_from_key, CurrentUser};
use crate::error::{ApiError, ApiResult};
use crate::models::{ScanRequest, ScanResponse};
use crate::{photos, AppState};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/scan", post(scan))
        .route("/events", get(events))
        .route("/daily", get(daily))
        .route("/photo/{id}", get(photo))
}

/// Kartin sahibi ve son hareketi. Yon kararini bu satirdan veriyoruz.
struct CardHolder {
    employee_id: Uuid,
    employee_no: String,
    full_name: String,
    company_name: Option<String>,
    title: Option<String>,
    last_direction: Option<String>,
    last_at: Option<DateTime<Utc>>,
}

type HolderRow = (
    Uuid,
    String,
    String,
    Option<String>,
    Option<String>,
    Option<String>,
    Option<DateTime<Utc>>,
);

/// Kiosk bir ArUco marker okudugunda cagirilir.
///
/// Yon, cihaz sabit yonluyse istekten gelir; degilse personelin son
/// hareketine gore belirlenir. Ayni kart debounce penceresi icinde tekrar
/// okunursa yeni kayit acilmaz (kamera ayni kareyi birden cok gorur).
async fn scan(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<ScanRequest>,
) -> ApiResult<Json<ScanResponse>> {
    // Kiosk cihazi kullanici girisi yapmaz; kendi anahtariyla taninir.
    // Anahtar ayni zamanda gecisin hangi noktada oldugunu da belirler.
    let checkpoint = match headers
        .get("x-checkpoint-key")
        .and_then(|v| v.to_str().ok())
    {
        Some(key) => Some(checkpoint_from_key(&state.db, key).await?),
        None if state.config.allow_anonymous_kiosk => None,
        None => {
            return Err(ApiError::Forbidden(
                "cihaz anahtari gonderilmedi; kiosk kurulumunu tamamlayin".into(),
            ))
        }
    };

    let holder = sqlx::query_as::<_, HolderRow>(
        "SELECT e.id,
                e.employee_no,
                e.first_name || ' ' || e.last_name AS full_name,
                co.name AS company_name,
                e.title,
                last_ev.direction::text,
                last_ev.occurred_at
           FROM aruco_cards c
           JOIN employees e ON e.id = c.employee_id
           LEFT JOIN companies co ON co.id = e.company_id
           LEFT JOIN LATERAL (
                SELECT direction, occurred_at
                  FROM attendance_events
                 WHERE employee_id = e.id
                 ORDER BY occurred_at DESC
                 LIMIT 1
           ) AS last_ev ON TRUE
          WHERE c.marker_id = $1
            AND c.dictionary = $2
            AND c.revoked_at IS NULL
            AND e.is_active",
    )
    .bind(body.marker_id)
    .bind(&body.dictionary)
    .fetch_optional(&state.db)
    .await?
    .map(
        |(employee_id, employee_no, full_name, company_name, title, last_direction, last_at)| {
            CardHolder {
                employee_id,
                employee_no,
                full_name,
                company_name,
                title,
                last_direction,
                last_at,
            }
        },
    )
    .ok_or(ApiError::NotFound)?;

    let now = Utc::now();
    let debounce = Duration::seconds(state.config.scan_debounce_seconds);

    // Debounce penceresi: son hareketin uzerinden yeterli sure gecmediyse
    // kaydi tekrarlamak yerine mevcut durumu geri bildiririz.
    if let (Some(last_at), Some(last_direction)) = (holder.last_at, holder.last_direction.as_ref())
    {
        if now - last_at < debounce {
            return Ok(Json(ScanResponse {
                employee_id: holder.employee_id,
                employee_no: holder.employee_no,
                full_name: holder.full_name,
                company_name: holder.company_name,
                title: holder.title,
                direction: last_direction.clone(),
                occurred_at: last_at,
                duplicate_ignored: true,
            }));
        }
    }

    // Sabit yonlu kiosk (ornegin cikis kapisi) kendi yonunu bildirir; aksi
    // halde son hareketin tersini aliriz.
    let direction = match body.direction.as_deref() {
        Some("in") => "in",
        Some("out") => "out",
        Some(other) => {
            return Err(ApiError::BadRequest(format!(
                "gecersiz yon '{other}', 'in' veya 'out' olmali"
            )))
        }
        None => match holder.last_direction.as_deref() {
            Some("in") => "out",
            _ => "in",
        },
    };

    let checkpoint_id: Option<Uuid> = checkpoint.as_ref().map(|(id, _)| *id);

    let (event_id, occurred_at): (i64, DateTime<Utc>) = sqlx::query_as(
        "INSERT INTO attendance_events
             (employee_id, checkpoint_id, direction, marker_id)
         VALUES ($1, $2, $3::attendance_direction, $4)
         RETURNING id, occurred_at",
    )
    .bind(holder.employee_id)
    .bind(checkpoint_id)
    .bind(direction)
    .bind(body.marker_id)
    .fetch_one(&state.db)
    .await?;

    // Fotograf kaydi gecisi engellemesin: diske yazilamazsa hareketi silmek
    // yerine uyari birakip devam ederiz.
    if let Some(photo) = body.photo.as_deref().filter(|p| !p.trim().is_empty()) {
        match photos::store(&state.config.photo_dir, photo, occurred_at, event_id) {
            Ok(relative) => {
                sqlx::query("UPDATE attendance_events SET photo_path = $2 WHERE id = $1")
                    .bind(event_id)
                    .bind(&relative)
                    .execute(&state.db)
                    .await?;
            }
            Err(e) => tracing::warn!(error = %e, event_id, "gecis fotografi saklanamadi"),
        }
    }

    tracing::info!(
        employee = %holder.employee_no,
        marker = body.marker_id,
        direction,
        "gecis kaydedildi"
    );

    Ok(Json(ScanResponse {
        employee_id: holder.employee_id,
        employee_no: holder.employee_no,
        full_name: holder.full_name,
        company_name: holder.company_name,
        title: holder.title,
        direction: direction.to_string(),
        occurred_at,
        duplicate_ignored: false,
    }))
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct AttendanceEvent {
    pub id: i64,
    pub employee_id: Uuid,
    pub employee_no: String,
    pub full_name: String,
    pub direction: String,
    pub occurred_at: DateTime<Utc>,
    pub marker_id: Option<i32>,
    pub is_manual: bool,
    pub checkpoint_code: Option<String>,
    /// Fotograf varsa true; goruntunun kendisi ayri uctan alinir.
    pub has_photo: bool,
}

#[derive(Debug, Deserialize)]
pub struct EventQuery {
    pub employee_id: Option<Uuid>,
    pub company_id: Option<Uuid>,
    pub from: Option<NaiveDate>,
    pub to: Option<NaiveDate>,
    #[serde(default = "default_limit")]
    pub limit: i64,
}

fn default_limit() -> i64 {
    200
}

/// Ham hareket dokumu: kisi aktivitesi ekrani bunu kullanir.
async fn events(
    State(state): State<AppState>,
    _user: CurrentUser,
    Query(q): Query<EventQuery>,
) -> ApiResult<Json<Vec<AttendanceEvent>>> {
    let limit = q.limit.clamp(1, 2000);

    let rows = sqlx::query_as::<_, AttendanceEvent>(
        "SELECT a.id,
                a.employee_id,
                e.employee_no,
                e.first_name || ' ' || e.last_name AS full_name,
                a.direction::text AS direction,
                a.occurred_at,
                a.marker_id,
                a.is_manual,
                cp.code AS checkpoint_code,
                (a.photo_path IS NOT NULL) AS has_photo
           FROM attendance_events a
           JOIN employees e ON e.id = a.employee_id
           LEFT JOIN checkpoints cp ON cp.id = a.checkpoint_id
          WHERE ($1::uuid IS NULL OR a.employee_id = $1)
            AND ($2::uuid IS NULL OR e.company_id = $2)
            AND ($3::date IS NULL OR a.occurred_at::date >= $3)
            AND ($4::date IS NULL OR a.occurred_at::date <= $4)
          ORDER BY a.occurred_at DESC
          LIMIT $5",
    )
    .bind(q.employee_id)
    .bind(q.company_id)
    .bind(q.from)
    .bind(q.to)
    .bind(limit)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(rows))
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DailySummary {
    pub employee_id: Uuid,
    pub employee_no: String,
    pub full_name: String,
    pub company_name: Option<String>,
    pub title: Option<String>,
    pub work_date: NaiveDate,
    pub first_in: Option<DateTime<Utc>>,
    pub last_out: Option<DateTime<Utc>>,
    pub worked_minutes: i64,
    /// Giris-cikis eslesmeyen hareket sayisi; puantajda uyari olarak gosterilir.
    pub unmatched: i64,
}

#[derive(Debug, Deserialize)]
pub struct DailyQuery {
    /// Bos birakilirsa bugun. `to` verilirse aralik olarak calisir.
    pub from: Option<NaiveDate>,
    pub to: Option<NaiveDate>,
    pub company_id: Option<Uuid>,
    pub employee_id: Option<Uuid>,
}

/// Gunluk puantaj: ilk giris, son cikis ve calisilan dakika.
///
/// Calisilan sure, gun icindeki ardisik in/out ciftlerinin toplamidir; cikis
/// yapmadan gunu kapatan personelde son giristen sonrasi sayilmaz ve o
/// hareket `unmatched` olarak raporlanir.
pub async fn daily_rows(
    state: &AppState,
    q: &DailyQuery,
) -> ApiResult<Vec<DailySummary>> {
    let from = q.from.unwrap_or_else(|| Utc::now().date_naive());
    let to = q.to.unwrap_or(from);

    if to < from {
        return Err(ApiError::BadRequest(
            "bitis tarihi baslangictan once olamaz".into(),
        ));
    }

    let rows = sqlx::query_as::<_, DailySummary>(
        "WITH day_events AS (
             SELECT a.employee_id,
                    a.occurred_at::date AS work_date,
                    a.direction,
                    a.occurred_at,
                    LEAD(a.occurred_at) OVER w AS next_at,
                    LEAD(a.direction)   OVER w AS next_dir
               FROM attendance_events a
               JOIN employees e ON e.id = a.employee_id
              WHERE a.occurred_at::date BETWEEN $1 AND $2
                AND ($3::uuid IS NULL OR e.company_id = $3)
                AND ($4::uuid IS NULL OR a.employee_id = $4)
             WINDOW w AS (
                 PARTITION BY a.employee_id, a.occurred_at::date
                 ORDER BY a.occurred_at
             )
         )
         SELECT e.id AS employee_id,
                e.employee_no,
                e.first_name || ' ' || e.last_name AS full_name,
                co.name AS company_name,
                e.title,
                d.work_date,
                MIN(d.occurred_at) FILTER (WHERE d.direction = 'in')  AS first_in,
                MAX(d.occurred_at) FILTER (WHERE d.direction = 'out') AS last_out,
                COALESCE(ROUND(SUM(EXTRACT(EPOCH FROM (d.next_at - d.occurred_at)) / 60.0)
                    FILTER (WHERE d.direction = 'in' AND d.next_dir = 'out')), 0)::bigint
                    AS worked_minutes,
                COUNT(*) FILTER (
                    WHERE d.direction = 'in' AND (d.next_dir IS DISTINCT FROM 'out')
                )::bigint AS unmatched
           FROM day_events d
           JOIN employees e ON e.id = d.employee_id
           LEFT JOIN companies co ON co.id = e.company_id
          GROUP BY e.id, e.employee_no, full_name, co.name, e.title, d.work_date
          ORDER BY d.work_date DESC, full_name",
    )
    .bind(from)
    .bind(to)
    .bind(q.company_id)
    .bind(q.employee_id)
    .fetch_all(&state.db)
    .await?;

    Ok(rows)
}

async fn daily(
    State(state): State<AppState>,
    _user: CurrentUser,
    Query(q): Query<DailyQuery>,
) -> ApiResult<Json<Vec<DailySummary>>> {
    Ok(Json(daily_rows(&state, &q).await?))
}

/// Gecis anindaki kamera goruntusu. Panelde oturum gerektirir.
async fn photo(
    State(state): State<AppState>,
    _user: CurrentUser,
    Path(id): Path<i64>,
) -> ApiResult<impl IntoResponse> {
    let relative: Option<String> =
        sqlx::query_scalar("SELECT photo_path FROM attendance_events WHERE id = $1")
            .bind(id)
            .fetch_optional(&state.db)
            .await?
            .flatten();

    let relative = relative.ok_or(ApiError::NotFound)?;
    let bytes = photos::read(&state.config.photo_dir, &relative)?;

    Ok((
        [
            (header::CONTENT_TYPE, "image/jpeg"),
            // Fotograf degismez; tarayici tekrar istemesin.
            (header::CACHE_CONTROL, "private, max-age=86400"),
        ],
        bytes,
    ))
}
