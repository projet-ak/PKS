use axum::extract::State;
use axum::routing::{get, post};
use axum::{Json, Router};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::auth::{issue_token, verify_password, CurrentUser};
use crate::error::{ApiError, ApiResult};
use crate::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/login", post(login))
        .route("/me", get(me))
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct UserInfo {
    pub id: Uuid,
    pub username: String,
    pub full_name: Option<String>,
    pub role: String,
    pub company_id: Option<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub token: String,
    pub user: UserInfo,
}

type UserRow = (
    Uuid,
    String,
    String,
    String,
    Option<String>,
    Option<Uuid>,
    bool,
);

async fn login(
    State(state): State<AppState>,
    Json(body): Json<LoginRequest>,
) -> ApiResult<Json<LoginResponse>> {
    let row: Option<UserRow> = sqlx::query_as(
        "SELECT id, username, password_hash, role::text, full_name, company_id, is_active \
           FROM users WHERE lower(username) = lower($1)",
    )
    .bind(body.username.trim())
    .fetch_optional(&state.db)
    .await?;

    // Kullanici yoksa da parola yanlissa da ayni cevabi doneriz; aksi halde
    // hangi kullanici adlarinin var oldugu disaridan ogrenilebilir.
    let (id, username, password_hash, role, full_name, company_id, is_active) =
        row.ok_or_else(|| ApiError::Forbidden("kullanici adi veya parola hatali".into()))?;

    if !is_active || !verify_password(&body.password, &password_hash) {
        return Err(ApiError::Forbidden(
            "kullanici adi veya parola hatali".into(),
        ));
    }

    let token = issue_token(id, &username, &role, &state.config.jwt_secret)?;

    sqlx::query("UPDATE users SET last_login = now() WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;

    tracing::info!(username = %username, "oturum acildi");

    Ok(Json(LoginResponse {
        token,
        user: UserInfo {
            id,
            username,
            full_name,
            role,
            company_id,
        },
    }))
}

/// Sayfa yenilendiginde tokenin hala gecerli oldugunu dogrular.
async fn me(State(state): State<AppState>, user: CurrentUser) -> ApiResult<Json<UserInfo>> {
    let row: Option<(Uuid, String, Option<String>, String, Option<Uuid>)> = sqlx::query_as(
        "SELECT id, username, full_name, role::text, company_id \
           FROM users WHERE id = $1 AND is_active",
    )
    .bind(user.id)
    .fetch_optional(&state.db)
    .await?;

    let (id, username, full_name, role, company_id) = row.ok_or(ApiError::Unauthorized)?;

    Ok(Json(UserInfo {
        id,
        username,
        full_name,
        role,
        company_id,
    }))
}

/// Panelde kullanici yonetimi icin; sadece yonetici gorebilir.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct UserListRow {
    pub id: Uuid,
    pub username: String,
    pub full_name: Option<String>,
    pub role: String,
    pub is_active: bool,
    pub last_login: Option<DateTime<Utc>>,
}
