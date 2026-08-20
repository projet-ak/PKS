use axum::extract::{Path, State};
use axum::routing::get;
use axum::{Json, Router};
use uuid::Uuid;

use crate::error::{ApiError, ApiResult};
use crate::models::{Employee, NewEmployee};
use crate::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list).post(create))
        .route("/{id}", get(detail).delete(deactivate))
}

const EMPLOYEE_COLUMNS: &str = "id, employee_no, first_name, last_name, email, phone, \
     title, department_id, hired_on, is_active";

async fn list(State(state): State<AppState>) -> ApiResult<Json<Vec<Employee>>> {
    let sql = format!(
        "SELECT {EMPLOYEE_COLUMNS} FROM employees \
         WHERE is_active ORDER BY last_name, first_name"
    );
    let rows = sqlx::query_as::<_, Employee>(&sql).fetch_all(&state.db).await?;
    Ok(Json(rows))
}

async fn detail(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<Employee>> {
    let sql = format!("SELECT {EMPLOYEE_COLUMNS} FROM employees WHERE id = $1");
    let row = sqlx::query_as::<_, Employee>(&sql)
        .bind(id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(ApiError::NotFound)?;
    Ok(Json(row))
}

async fn create(
    State(state): State<AppState>,
    Json(body): Json<NewEmployee>,
) -> ApiResult<Json<Employee>> {
    if body.employee_no.trim().is_empty() {
        return Err(ApiError::BadRequest("sicil numarasi bos olamaz".into()));
    }

    let sql = format!(
        "INSERT INTO employees \
             (employee_no, first_name, last_name, email, phone, title, department_id, hired_on) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) \
         RETURNING {EMPLOYEE_COLUMNS}"
    );
    let row = sqlx::query_as::<_, Employee>(&sql)
        .bind(&body.employee_no)
        .bind(&body.first_name)
        .bind(&body.last_name)
        .bind(&body.email)
        .bind(&body.phone)
        .bind(&body.title)
        .bind(body.department_id)
        .bind(body.hired_on)
        .fetch_one(&state.db)
        .await
        .map_err(|e| match &e {
            sqlx::Error::Database(db) if db.is_unique_violation() => {
                ApiError::Conflict("bu sicil numarasi zaten kayitli".into())
            }
            _ => ApiError::Database(e),
        })?;
    Ok(Json(row))
}

/// Personeli silmek yerine pasife cekeriz; gecmis mesai kayitlari korunur.
async fn deactivate(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<Employee>> {
    let sql = format!(
        "UPDATE employees SET is_active = FALSE, updated_at = now() \
         WHERE id = $1 RETURNING {EMPLOYEE_COLUMNS}"
    );
    let row = sqlx::query_as::<_, Employee>(&sql)
        .bind(id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(ApiError::NotFound)?;
    Ok(Json(row))
}
