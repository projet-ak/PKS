use axum::extract::{Path, State};
use axum::routing::get;
use axum::{Json, Router};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::auth::{hash_password, CurrentUser};
use crate::error::{ApiError, ApiResult};
use crate::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list).post(create))
        .route("/{id}", axum::routing::put(update).delete(deactivate))
}

/// Tanimli roller. Panelde acilir listeyi de bu belirler.
pub const ROLES: [&str; 4] = ["admin", "hr", "manager", "viewer"];

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct User {
    pub id: Uuid,
    pub username: String,
    pub full_name: Option<String>,
    pub role: String,
    pub is_active: bool,
    pub last_login: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct NewUser {
    pub username: String,
    pub full_name: Option<String>,
    pub role: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateUser {
    pub full_name: Option<String>,
    pub role: String,
    pub is_active: bool,
    /// Bos birakilirsa parola degismez.
    pub password: Option<String>,
}

const USER_COLUMNS: &str =
    "id, username, full_name, role::text AS role, is_active, last_login";

fn check_role(role: &str) -> Result<(), ApiError> {
    if ROLES.contains(&role) {
        Ok(())
    } else {
        Err(ApiError::BadRequest(format!(
            "gecersiz rol '{role}'; secenekler: {}",
            ROLES.join(", ")
        )))
    }
}

fn check_password(password: &str) -> Result<(), ApiError> {
    if password.chars().count() < 8 {
        return Err(ApiError::BadRequest(
            "parola en az 8 karakter olmali".into(),
        ));
    }
    Ok(())
}

async fn list(State(state): State<AppState>, user: CurrentUser) -> ApiResult<Json<Vec<User>>> {
    user.require_admin()?;
    let sql = format!("SELECT {USER_COLUMNS} FROM users ORDER BY username");
    let rows = sqlx::query_as::<_, User>(&sql).fetch_all(&state.db).await?;
    Ok(Json(rows))
}

async fn create(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(body): Json<NewUser>,
) -> ApiResult<Json<User>> {
    user.require_admin()?;

    let username = body.username.trim().to_lowercase();
    if username.is_empty() {
        return Err(ApiError::BadRequest("kullanici adi bos olamaz".into()));
    }
    check_role(&body.role)?;
    check_password(&body.password)?;

    let hash = hash_password(&body.password)?;

    let sql = format!(
        "INSERT INTO users (username, password_hash, role, full_name) \
         VALUES ($1, $2, $3::user_role, $4) RETURNING {USER_COLUMNS}"
    );
    let row = sqlx::query_as::<_, User>(&sql)
        .bind(&username)
        .bind(hash)
        .bind(&body.role)
        .bind(body.full_name.as_deref().map(str::trim))
        .fetch_one(&state.db)
        .await
        .map_err(|e| {
            if let sqlx::Error::Database(db) = &e {
                if db.is_unique_violation() {
                    return ApiError::Conflict("bu kullanici adi zaten var".into());
                }
            }
            ApiError::Database(e)
        })?;

    tracing::info!(created = %username, by = %user.username, "kullanici olusturuldu");
    Ok(Json(row))
}

async fn update(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateUser>,
) -> ApiResult<Json<User>> {
    user.require_admin()?;
    check_role(&body.role)?;

    // Yonetici kendi hesabini pasife alip disarida kalmasin.
    if id == user.id && !body.is_active {
        return Err(ApiError::BadRequest(
            "kendi hesabinizi pasife alamazsiniz".into(),
        ));
    }

    // Son aktif yonetici rolunu birakirsa panele kimse giremez.
    if id == user.id && body.role != "admin" {
        let others: i64 = sqlx::query_scalar(
            "SELECT count(*) FROM users WHERE role = 'admin' AND is_active AND id <> $1",
        )
        .bind(id)
        .fetch_one(&state.db)
        .await?;

        if others == 0 {
            return Err(ApiError::BadRequest(
                "sistemde baska yonetici yok; once bir yonetici tanimlayin".into(),
            ));
        }
    }

    let password_hash = match body.password.as_deref().filter(|p| !p.trim().is_empty()) {
        Some(p) => {
            check_password(p)?;
            Some(hash_password(p)?)
        }
        None => None,
    };

    let sql = format!(
        "UPDATE users SET \
             full_name = $2, role = $3::user_role, is_active = $4, \
             password_hash = COALESCE($5, password_hash) \
         WHERE id = $1 RETURNING {USER_COLUMNS}"
    );
    let row = sqlx::query_as::<_, User>(&sql)
        .bind(id)
        .bind(body.full_name.as_deref().map(str::trim))
        .bind(&body.role)
        .bind(body.is_active)
        .bind(password_hash)
        .fetch_optional(&state.db)
        .await?
        .ok_or(ApiError::NotFound)?;

    Ok(Json(row))
}

/// Kullaniciyi silmek yerine pasife cekeriz; kayitlarda kimin ne yaptigi
/// izlenebilir kalsin.
async fn deactivate(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<User>> {
    user.require_admin()?;

    if id == user.id {
        return Err(ApiError::BadRequest(
            "kendi hesabinizi pasife alamazsiniz".into(),
        ));
    }

    let sql = format!(
        "UPDATE users SET is_active = FALSE WHERE id = $1 RETURNING {USER_COLUMNS}"
    );
    let row = sqlx::query_as::<_, User>(&sql)
        .bind(id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(ApiError::NotFound)?;

    Ok(Json(row))
}
