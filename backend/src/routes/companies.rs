use axum::extract::State;
use axum::routing::get;
use axum::{Json, Router};
use serde::Serialize;
use uuid::Uuid;

use crate::auth::CurrentUser;
use crate::error::ApiResult;
use crate::AppState;

pub fn router() -> Router<AppState> {
    Router::new().route("/", get(list))
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Company {
    pub id: Uuid,
    pub code: String,
    pub name: String,
    pub logo_path: Option<String>,
}

async fn list(
    State(state): State<AppState>,
    _user: CurrentUser,
) -> ApiResult<Json<Vec<Company>>> {
    let rows = sqlx::query_as::<_, Company>(
        "SELECT id, code, name, logo_path FROM companies \
          WHERE is_active ORDER BY sort_order, name",
    )
    .fetch_all(&state.db)
    .await?;
    Ok(Json(rows))
}
