pub mod attendance;
pub mod auth;
pub mod cards;
pub mod checkpoints;
pub mod companies;
pub mod employees;

use axum::routing::get;
use axum::Router;
use serde_json::json;

use crate::AppState;

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(|| async { axum::Json(json!({ "status": "ok" })) }))
        .nest("/api/auth", auth::router())
        .nest("/api/companies", companies::router())
        .nest("/api/checkpoints", checkpoints::router())
        .nest("/api/employees", employees::router())
        .nest("/api/cards", cards::router())
        .nest("/api/attendance", attendance::router())
        .with_state(state)
}
