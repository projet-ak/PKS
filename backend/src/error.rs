use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::json;

#[derive(Debug, thiserror::Error)]
pub enum ApiError {
    #[error("kayit bulunamadi")]
    NotFound,

    #[error("oturum acmaniz gerekiyor")]
    Unauthorized,

    #[error("{0}")]
    Forbidden(String),

    #[error("{0}")]
    BadRequest(String),

    #[error("{0}")]
    Conflict(String),

    #[error("{0}")]
    Internal(String),

    #[error(transparent)]
    Database(#[from] sqlx::Error),
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        // sqlx'in "satir yok" hatasini 404'e cevir, digerlerini 500 olarak logla.
        let (status, message) = match &self {
            ApiError::NotFound => (StatusCode::NOT_FOUND, self.to_string()),
            ApiError::Unauthorized => (StatusCode::UNAUTHORIZED, self.to_string()),
            ApiError::Forbidden(m) => (StatusCode::FORBIDDEN, m.clone()),
            ApiError::BadRequest(m) => (StatusCode::BAD_REQUEST, m.clone()),
            ApiError::Conflict(m) => (StatusCode::CONFLICT, m.clone()),
            ApiError::Internal(m) => {
                tracing::error!(error = %m, "sunucu hatasi");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "sunucu hatasi".to_string(),
                )
            }
            ApiError::Database(sqlx::Error::RowNotFound) => {
                (StatusCode::NOT_FOUND, "kayit bulunamadi".to_string())
            }
            ApiError::Database(e) => {
                tracing::error!(error = %e, "veritabani hatasi");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "sunucu hatasi".to_string(),
                )
            }
        };

        (status, Json(json!({ "error": message }))).into_response()
    }
}

pub type ApiResult<T> = Result<T, ApiError>;
