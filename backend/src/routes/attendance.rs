use axum::extract::{Query, State};
use axum::http::HeaderMap;
use axum::routing::{get, post};
use axum::{Json, Router};
use chrono::{DateTime, Duration, NaiveDate, Utc};
use serde::Deserialize;
use uuid::Uuid;

use crate::auth::{checkpoint_from_key, CurrentUser};
use crate::error::{ApiError, ApiResult};
use crate::models::{AttendanceEvent, DailySummary, ScanRequest, ScanResponse};
use crate::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/scan", post(scan))
        .route("/events", get(events))
        .route("/daily", get(daily))
}

/// Kartin sahibi ve son hareketi. Yon kararini bu satirdan veriyoruz.
struct CardHolder {
    employee_id: Uuid,
    employee_no: String,
    full_name: String,
    last_direction: Option<String>,
    last_at: Option<DateTime<Utc>>,
}

/// Kiosk bir ArUco marker okudugunda cagirilir.
///
/// Yon otomatik belirlenir: personelin bugunku son hareketi "in" ise bu okuma
/// "out", degilse "in" olarak kaydedilir. Ayni kart debounce penceresi icinde
/// tekrar okunursa yeni kayit acilmaz (kamera ayni kareyi birden cok gorur).
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

    let holder = sqlx::query_as::<_, (Uuid, String, String, Option<String>, Option<DateTime<Utc>>)>(
        "SELECT e.id,
                e.employee_no,
                e.first_name || ' ' || e.last_name AS full_name,
                last_ev.direction::text,
                last_ev.occurred_at
           FROM aruco_cards c
           JOIN employees e ON e.id = c.employee_id
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
    .map(|(employee_id, employee_no, full_name, last_direction, last_at)| CardHolder {
        employee_id,
        employee_no,
        full_name,
        last_direction,
        last_at,
    })
    .ok_or_else(|| ApiError::NotFound)?;

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

    let occurred_at: DateTime<Utc> = sqlx::query_scalar(
        "INSERT INTO attendance_events
             (employee_id, checkpoint_id, direction, marker_id)
         VALUES ($1, $2, $3::attendance_direction, $4)
         RETURNING occurred_at",
    )
    .bind(holder.employee_id)
    .bind(checkpoint_id)
    .bind(direction)
    .bind(body.marker_id)
    .fetch_one(&state.db)
    .await?;

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
        direction: direction.to_string(),
        occurred_at,
        duplicate_ignored: false,
    }))
}

#[derive(Debug, Deserialize)]
pub struct EventQuery {
    pub employee_id: Option<Uuid>,
    #[serde(default = "default_limit")]
    pub limit: i64,
}

fn default_limit() -> i64 {
    100
}

async fn events(
    State(state): State<AppState>,
    _user: CurrentUser,
    Query(q): Query<EventQuery>,
) -> ApiResult<Json<Vec<AttendanceEvent>>> {
    let limit = q.limit.clamp(1, 1000);
    let rows = sqlx::query_as::<_, AttendanceEvent>(
        "SELECT id, employee_id, direction::text AS direction, occurred_at, marker_id, is_manual
           FROM attendance_events
          WHERE ($1::uuid IS NULL OR employee_id = $1)
          ORDER BY occurred_at DESC
          LIMIT $2",
    )
    .bind(q.employee_id)
    .bind(limit)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct DailyQuery {
    /// Bos birakilirsa bugun.
    pub date: Option<NaiveDate>,
}

/// Gunluk puantaj: ilk giris, son cikis ve calisilan dakika.
///
/// Calisilan sure, gun icindeki ardisik in/out ciftlerinin toplamidir; cikis
/// yapmadan gunu kapatan personelde son giristen sonrasi sayilmaz.
async fn daily(
    State(state): State<AppState>,
    _user: CurrentUser,
    Query(q): Query<DailyQuery>,
) -> ApiResult<Json<Vec<DailySummary>>> {
    let date = q.date.unwrap_or_else(|| Utc::now().date_naive());

    let rows = sqlx::query_as::<_, (Uuid, String, Option<DateTime<Utc>>, Option<DateTime<Utc>>, Option<f64>)>(
        "WITH day_events AS (
             SELECT employee_id,
                    direction,
                    occurred_at,
                    LEAD(occurred_at) OVER (PARTITION BY employee_id ORDER BY occurred_at) AS next_at,
                    LEAD(direction)   OVER (PARTITION BY employee_id ORDER BY occurred_at) AS next_dir
               FROM attendance_events
              WHERE occurred_at::date = $1
         )
         SELECT e.id,
                e.first_name || ' ' || e.last_name AS full_name,
                MIN(d.occurred_at) FILTER (WHERE d.direction = 'in')  AS first_in,
                MAX(d.occurred_at) FILTER (WHERE d.direction = 'out') AS last_out,
                -- EXTRACT/SUM numeric dondurur; sqlx numeric'i f64'e cozemez,
                -- o yuzden acikca double precision'a cast ediyoruz.
                (SUM(EXTRACT(EPOCH FROM (d.next_at - d.occurred_at)) / 60.0)
                    FILTER (WHERE d.direction = 'in' AND d.next_dir = 'out')
                )::float8 AS worked_minutes
           FROM day_events d
           JOIN employees e ON e.id = d.employee_id
          GROUP BY e.id, full_name
          ORDER BY full_name",
    )
    .bind(date)
    .fetch_all(&state.db)
    .await?;

    let summaries = rows
        .into_iter()
        .map(
            |(employee_id, full_name, first_in, last_out, worked)| DailySummary {
                employee_id,
                full_name,
                work_date: date,
                first_in,
                last_out,
                worked_minutes: worked.unwrap_or(0.0).round() as i64,
            },
        )
        .collect();

    Ok(Json(summaries))
}
