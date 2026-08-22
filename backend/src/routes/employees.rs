use axum::extract::{Path, Query, State};
use axum::routing::get;
use axum::{Json, Router};
use serde::Deserialize;
use uuid::Uuid;

use crate::auth::CurrentUser;
use crate::error::{ApiError, ApiResult};
use crate::models::{Employee, NewEmployee};
use crate::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list).post(create))
        .route("/{id}", get(detail).put(update).delete(deactivate))
}

/// Personel satirini firmasi ve aktif ArUco kartiyla birlikte okur.
const EMPLOYEE_SELECT: &str = "SELECT e.id, e.employee_no, e.first_name, e.last_name, \
     e.email, e.phone, e.title, e.department_id, e.hired_on, e.is_active, \
     e.company_id, co.name AS company_name, c.marker_id \
       FROM employees e \
       LEFT JOIN companies co ON co.id = e.company_id \
       LEFT JOIN aruco_cards c ON c.employee_id = e.id AND c.revoked_at IS NULL";

/// INSERT/UPDATE sonrasi ayni sekli dondurmek icin; iliskiler alt sorguyla gelir.
const EMPLOYEE_RETURNING: &str = "id, employee_no, first_name, last_name, email, phone, \
     title, department_id, hired_on, is_active, company_id, \
     (SELECT name FROM companies WHERE id = employees.company_id) AS company_name, \
     (SELECT marker_id FROM aruco_cards \
       WHERE employee_id = employees.id AND revoked_at IS NULL) AS marker_id";

#[derive(Debug, Deserialize)]
pub struct ListQuery {
    /// Verilirse yalnizca o firmanin personeli doner.
    pub company_id: Option<Uuid>,
}

async fn list(
    State(state): State<AppState>,
    _user: CurrentUser,
    Query(q): Query<ListQuery>,
) -> ApiResult<Json<Vec<Employee>>> {
    let sql = format!(
        "{EMPLOYEE_SELECT} WHERE e.is_active \
           AND ($1::uuid IS NULL OR e.company_id = $1) \
         ORDER BY e.last_name, e.first_name"
    );
    let rows = sqlx::query_as::<_, Employee>(&sql)
        .bind(q.company_id)
        .fetch_all(&state.db)
        .await?;
    Ok(Json(rows))
}

async fn detail(
    State(state): State<AppState>,
    _user: CurrentUser,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<Employee>> {
    let sql = format!("{EMPLOYEE_SELECT} WHERE e.id = $1");
    let row = sqlx::query_as::<_, Employee>(&sql)
        .bind(id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(ApiError::NotFound)?;
    Ok(Json(row))
}

async fn create(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(body): Json<NewEmployee>,
) -> ApiResult<Json<Employee>> {
    user.require_write()?;

    if body.employee_no.trim().is_empty() {
        return Err(ApiError::BadRequest("sicil numarasi bos olamaz".into()));
    }

    let sql = format!(
        "INSERT INTO employees \
             (employee_no, first_name, last_name, email, phone, title, department_id, \
              hired_on, company_id) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) \
         RETURNING {EMPLOYEE_RETURNING}"
    );
    let row = sqlx::query_as::<_, Employee>(&sql)
        .bind(body.employee_no.trim())
        .bind(&body.first_name)
        .bind(&body.last_name)
        .bind(&body.email)
        .bind(&body.phone)
        .bind(&body.title)
        .bind(body.department_id)
        .bind(body.hired_on)
        .bind(body.company_id)
        .fetch_one(&state.db)
        .await
        // Unique ihlalini 409'a cevir; digerlerini 500 olarak birak.
        .map_err(|e| {
            if let sqlx::Error::Database(db) = &e {
                if db.is_unique_violation() {
                    return ApiError::Conflict("bu sicil numarasi zaten kayitli".into());
                }
            }
            ApiError::Database(e)
        })?;
    Ok(Json(row))
}

/// Personel bilgilerini gunceller.
///
/// Sicil numarasi da degistirilebilir; sahada yanlis girilen sicilin
/// duzeltilememesi kaydi kullanilamaz hale getirirdi. ArUco karti sicilden
/// turetilmis olsa bile otomatik degismez, cunku basili kart hala eski
/// numarayi tasiyor olabilir.
async fn update(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<Uuid>,
    Json(body): Json<NewEmployee>,
) -> ApiResult<Json<Employee>> {
    user.require_write()?;

    if body.employee_no.trim().is_empty() {
        return Err(ApiError::BadRequest("sicil numarasi bos olamaz".into()));
    }

    let sql = format!(
        "UPDATE employees SET \
             employee_no = $2, first_name = $3, last_name = $4, email = $5, \
             phone = $6, title = $7, department_id = $8, hired_on = $9, \
             company_id = $10, updated_at = now() \
         WHERE id = $1 RETURNING {EMPLOYEE_RETURNING}"
    );
    let row = sqlx::query_as::<_, Employee>(&sql)
        .bind(id)
        .bind(body.employee_no.trim())
        .bind(&body.first_name)
        .bind(&body.last_name)
        .bind(&body.email)
        .bind(&body.phone)
        .bind(&body.title)
        .bind(body.department_id)
        .bind(body.hired_on)
        .bind(body.company_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| {
            if let sqlx::Error::Database(db) = &e {
                if db.is_unique_violation() {
                    return ApiError::Conflict("bu sicil numarasi zaten kayitli".into());
                }
            }
            ApiError::Database(e)
        })?
        .ok_or(ApiError::NotFound)?;

    Ok(Json(row))
}

/// Personeli silmek yerine pasife cekeriz; gecmis mesai kayitlari korunur.
async fn deactivate(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<Employee>> {
    user.require_write()?;

    let sql = format!(
        "UPDATE employees SET is_active = FALSE, updated_at = now() \
         WHERE id = $1 RETURNING {EMPLOYEE_RETURNING}"
    );
    let row = sqlx::query_as::<_, Employee>(&sql)
        .bind(id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(ApiError::NotFound)?;
    Ok(Json(row))
}
