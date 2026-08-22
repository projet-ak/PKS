use axum::extract::{Path, State};
use axum::http::HeaderMap;
use axum::routing::{get, post};
use axum::{Json, Router};
use chrono::{DateTime, Utc};
use rand::distr::{Alphanumeric, SampleString};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::auth::{checkpoint_from_key, CurrentUser};
use crate::error::{ApiError, ApiResult};
use crate::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list).post(create))
        // Kiosk kurulumunda anahtarin gecerliligini sinar; oturum istemez.
        .route("/whoami", post(whoami))
        .route("/{id}", axum::routing::delete(deactivate))
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Checkpoint {
    pub id: Uuid,
    pub code: String,
    pub name: String,
    /// Cihaza bir kez yazilir. Panelde gorunur olmasi gerekir, aksi halde
    /// kiosk kurulumu yapilamaz.
    pub api_key: String,
    pub company_id: Option<Uuid>,
    pub is_active: bool,
    pub last_seen_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct NewCheckpoint {
    pub code: String,
    pub name: String,
    pub company_id: Option<Uuid>,
}

const CHECKPOINT_COLUMNS: &str =
    "id, code, name, api_key, company_id, is_active, last_seen_at";

async fn list(
    State(state): State<AppState>,
    user: CurrentUser,
) -> ApiResult<Json<Vec<Checkpoint>>> {
    user.require_admin()?;
    let sql = format!("SELECT {CHECKPOINT_COLUMNS} FROM checkpoints ORDER BY name");
    let rows = sqlx::query_as::<_, Checkpoint>(&sql)
        .fetch_all(&state.db)
        .await?;
    Ok(Json(rows))
}

async fn create(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(body): Json<NewCheckpoint>,
) -> ApiResult<Json<Checkpoint>> {
    user.require_admin()?;

    if body.code.trim().is_empty() || body.name.trim().is_empty() {
        return Err(ApiError::BadRequest("kod ve ad bos olamaz".into()));
    }

    // Anahtar sunucuda uretilir; kullanicidan alinsa zayif secilebilirdi.
    let api_key = Alphanumeric.sample_string(&mut rand::rng(), 40);

    let sql = format!(
        "INSERT INTO checkpoints (code, name, api_key, company_id) \
         VALUES ($1, $2, $3, $4) RETURNING {CHECKPOINT_COLUMNS}"
    );
    let row = sqlx::query_as::<_, Checkpoint>(&sql)
        .bind(body.code.trim())
        .bind(body.name.trim())
        .bind(&api_key)
        .bind(body.company_id)
        .fetch_one(&state.db)
        .await
        .map_err(|e| {
            if let sqlx::Error::Database(db) = &e {
                if db.is_unique_violation() {
                    return ApiError::Conflict("bu kod zaten kullaniliyor".into());
                }
            }
            ApiError::Database(e)
        })?;

    Ok(Json(row))
}

/// Cihaz kaybolur veya degisirse anahtari gecersiz kilar.
async fn deactivate(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<Checkpoint>> {
    user.require_admin()?;
    let sql = format!(
        "UPDATE checkpoints SET is_active = FALSE WHERE id = $1 \
         RETURNING {CHECKPOINT_COLUMNS}"
    );
    let row = sqlx::query_as::<_, Checkpoint>(&sql)
        .bind(id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(ApiError::NotFound)?;
    Ok(Json(row))
}

#[derive(Debug, Serialize)]
pub struct CheckpointIdentity {
    pub code: String,
}

/// Kiosk cihazinin anahtarini dogrular ve hangi noktaya bagli oldugunu soyler.
///
/// Kurulum sirasinda yanlis yapistirilan bir anahtarin kart okutulana kadar
/// fark edilmemesi kotu olurdu; bu uc sayesinde hata aninda gorulur.
async fn whoami(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> ApiResult<Json<CheckpointIdentity>> {
    let key = headers
        .get("x-checkpoint-key")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| ApiError::BadRequest("cihaz anahtari gonderilmedi".into()))?;

    let (_, code) = checkpoint_from_key(&state.db, key).await?;
    Ok(Json(CheckpointIdentity { code }))
}
