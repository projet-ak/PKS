use axum::extract::{Path, State};
use axum::routing::get;
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::auth::CurrentUser;
use crate::error::{ApiError, ApiResult};
use crate::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list).post(create))
        .route("/{id}", axum::routing::delete(deactivate))
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Company {
    pub id: Uuid,
    pub code: String,
    pub name: String,
    pub logo_path: Option<String>,
    pub is_active: bool,
    /// Firmaya bagli aktif personel sayisi; silmeden once gormek gerekir.
    pub employee_count: i64,
}

#[derive(Debug, Deserialize)]
pub struct NewCompany {
    pub code: String,
    pub name: String,
    pub logo_path: Option<String>,
}

const COMPANY_SELECT: &str = "SELECT c.id, c.code, c.name, c.logo_path, c.is_active, \
     (SELECT count(*) FROM employees e \
       WHERE e.company_id = c.id AND e.is_active) AS employee_count \
       FROM companies c";

async fn list(State(state): State<AppState>, _user: CurrentUser) -> ApiResult<Json<Vec<Company>>> {
    let sql = format!("{COMPANY_SELECT} WHERE c.is_active ORDER BY c.sort_order, c.name");
    let rows = sqlx::query_as::<_, Company>(&sql)
        .fetch_all(&state.db)
        .await?;
    Ok(Json(rows))
}

async fn create(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(body): Json<NewCompany>,
) -> ApiResult<Json<Company>> {
    user.require_admin()?;

    let code = body.code.trim().to_uppercase();
    let name = body.name.trim();

    if code.is_empty() || name.is_empty() {
        return Err(ApiError::BadRequest("kod ve ad bos olamaz".into()));
    }

    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO companies (code, name, logo_path, sort_order) \
         VALUES ($1, $2, $3, COALESCE((SELECT max(sort_order) + 1 FROM companies), 1)) \
         RETURNING id",
    )
    .bind(&code)
    .bind(name)
    .bind(body.logo_path.as_deref().filter(|v| !v.trim().is_empty()))
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        if let sqlx::Error::Database(db) = &e {
            if db.is_unique_violation() {
                return ApiError::Conflict(format!("'{code}' kodu zaten kullaniliyor"));
            }
        }
        ApiError::Database(e)
    })?;

    let sql = format!("{COMPANY_SELECT} WHERE c.id = $1");
    let row = sqlx::query_as::<_, Company>(&sql)
        .bind(id)
        .fetch_one(&state.db)
        .await?;

    Ok(Json(row))
}

/// Firmayi silmek yerine pasife cekeriz; gecmis personel kayitlari firmaya
/// referans verdigi icin silme veriyi koparirdi.
async fn deactivate(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<Company>> {
    user.require_admin()?;

    let attached: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM employees WHERE company_id = $1 AND is_active",
    )
    .bind(id)
    .fetch_one(&state.db)
    .await?;

    if attached > 0 {
        return Err(ApiError::Conflict(format!(
            "bu firmaya bagli {attached} aktif personel var; once onlari tasiyin"
        )));
    }

    sqlx::query("UPDATE companies SET is_active = FALSE WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;

    let sql = format!("{COMPANY_SELECT} WHERE c.id = $1");
    let row = sqlx::query_as::<_, Company>(&sql)
        .bind(id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(ApiError::NotFound)?;

    Ok(Json(row))
}
