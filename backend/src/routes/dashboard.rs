use axum::extract::{Query, State};
use axum::routing::get;
use axum::{Json, Router};
use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::auth::CurrentUser;
use crate::error::ApiResult;
use crate::AppState;

pub fn router() -> Router<AppState> {
    Router::new().route("/", get(summary))
}

#[derive(Debug, Deserialize)]
pub struct DashboardQuery {
    pub company_id: Option<Uuid>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DayPoint {
    pub work_date: NaiveDate,
    pub people: i64,
    pub hours: f64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct RecentEvent {
    pub id: i64,
    pub full_name: String,
    pub direction: String,
    pub occurred_at: DateTime<Utc>,
    pub has_photo: bool,
}

#[derive(Debug, Serialize)]
pub struct Dashboard {
    pub employee_count: i64,
    pub with_card: i64,
    /// Bugun en az bir hareketi olan personel sayisi.
    pub present_today: i64,
    /// Su an iceride sayilanlar: son hareketi "in" olanlar.
    pub inside_now: i64,
    pub today_minutes: i64,
    pub checkpoints_active: i64,
    /// Son 7 gunun gunluk ozeti; panelde sutun grafigi olarak cizilir.
    pub last_days: Vec<DayPoint>,
    pub recent: Vec<RecentEvent>,
}

async fn summary(
    State(state): State<AppState>,
    _user: CurrentUser,
    Query(q): Query<DashboardQuery>,
) -> ApiResult<Json<Dashboard>> {
    let company = q.company_id;

    let (employee_count, with_card): (i64, i64) = sqlx::query_as(
        "SELECT count(*),
                count(*) FILTER (
                    WHERE EXISTS (SELECT 1 FROM aruco_cards c
                                   WHERE c.employee_id = e.id AND c.revoked_at IS NULL)
                )
           FROM employees e
          WHERE e.is_active AND ($1::uuid IS NULL OR e.company_id = $1)",
    )
    .bind(company)
    .fetch_one(&state.db)
    .await?;

    let (present_today, today_minutes): (i64, i64) = sqlx::query_as(
        "WITH today AS (
             SELECT a.employee_id,
                    a.direction,
                    a.occurred_at,
                    LEAD(a.occurred_at) OVER w AS next_at,
                    LEAD(a.direction)   OVER w AS next_dir
               FROM attendance_events a
               JOIN employees e ON e.id = a.employee_id
              WHERE a.occurred_at::date = current_date
                AND ($1::uuid IS NULL OR e.company_id = $1)
             WINDOW w AS (PARTITION BY a.employee_id ORDER BY a.occurred_at)
         )
         SELECT count(DISTINCT employee_id),
                COALESCE(ROUND(SUM(EXTRACT(EPOCH FROM (next_at - occurred_at)) / 60.0)
                    FILTER (WHERE direction = 'in' AND next_dir = 'out')), 0)::bigint
           FROM today",
    )
    .bind(company)
    .fetch_one(&state.db)
    .await?;

    // Iceride sayilanlar: her personelin en son hareketi "in" ise.
    let inside_now: i64 = sqlx::query_scalar(
        "SELECT count(*)
           FROM employees e
           JOIN LATERAL (
                SELECT direction
                  FROM attendance_events a
                 WHERE a.employee_id = e.id
                 ORDER BY a.occurred_at DESC
                 LIMIT 1
           ) last_ev ON TRUE
          WHERE e.is_active
            AND last_ev.direction = 'in'
            AND ($1::uuid IS NULL OR e.company_id = $1)",
    )
    .bind(company)
    .fetch_one(&state.db)
    .await?;

    let checkpoints_active: i64 =
        sqlx::query_scalar("SELECT count(*) FROM checkpoints WHERE is_active")
            .fetch_one(&state.db)
            .await?;

    let last_days = sqlx::query_as::<_, DayPoint>(
        "WITH span AS (
             SELECT generate_series(current_date - INTERVAL '6 days', current_date,
                                    INTERVAL '1 day')::date AS work_date
         ),
         ev AS (
             SELECT a.employee_id,
                    a.occurred_at::date AS work_date,
                    a.direction,
                    a.occurred_at,
                    LEAD(a.occurred_at) OVER w AS next_at,
                    LEAD(a.direction)   OVER w AS next_dir
               FROM attendance_events a
               JOIN employees e ON e.id = a.employee_id
              WHERE a.occurred_at::date >= current_date - INTERVAL '6 days'
                AND ($1::uuid IS NULL OR e.company_id = $1)
             WINDOW w AS (PARTITION BY a.employee_id, a.occurred_at::date
                          ORDER BY a.occurred_at)
         )
         SELECT s.work_date,
                COALESCE(count(DISTINCT ev.employee_id), 0)::bigint AS people,
                COALESCE(SUM(EXTRACT(EPOCH FROM (ev.next_at - ev.occurred_at)) / 3600.0)
                    FILTER (WHERE ev.direction = 'in' AND ev.next_dir = 'out'), 0)::float8
                    AS hours
           FROM span s
           LEFT JOIN ev ON ev.work_date = s.work_date
          GROUP BY s.work_date
          ORDER BY s.work_date",
    )
    .bind(company)
    .fetch_all(&state.db)
    .await?;

    let recent = sqlx::query_as::<_, RecentEvent>(
        "SELECT a.id,
                e.first_name || ' ' || e.last_name AS full_name,
                a.direction::text AS direction,
                a.occurred_at,
                (a.photo_path IS NOT NULL) AS has_photo
           FROM attendance_events a
           JOIN employees e ON e.id = a.employee_id
          WHERE ($1::uuid IS NULL OR e.company_id = $1)
          ORDER BY a.occurred_at DESC
          LIMIT 10",
    )
    .bind(company)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(Dashboard {
        employee_count,
        with_card,
        present_today,
        inside_now,
        today_minutes,
        checkpoints_active,
        last_days,
        recent,
    }))
}
