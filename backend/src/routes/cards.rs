use axum::extract::{Path, State};
use axum::{Json, Router};
use axum::routing::post;
use uuid::Uuid;

use crate::error::{ApiError, ApiResult};
use crate::models::{ArucoCard, AssignCard};
use crate::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/employee/{employee_id}", post(assign).delete(revoke))
}

const CARD_COLUMNS: &str = "id, marker_id, dictionary, employee_id, issued_at, revoked_at";

/// Personele ArUco kart tanimlar. Varsa onceki aktif kart otomatik iptal edilir,
/// boylece bir personelin her zaman tek gecerli karti olur.
async fn assign(
    State(state): State<AppState>,
    Path(employee_id): Path<Uuid>,
    Json(body): Json<AssignCard>,
) -> ApiResult<Json<ArucoCard>> {
    if body.marker_id < 0 {
        return Err(ApiError::BadRequest("marker_id negatif olamaz".into()));
    }

    let mut tx = state.db.begin().await?;

    let exists: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM employees WHERE id = $1 AND is_active)")
            .bind(employee_id)
            .fetch_one(&mut *tx)
            .await?;
    if !exists {
        return Err(ApiError::NotFound);
    }

    sqlx::query(
        "UPDATE aruco_cards SET revoked_at = now() \
         WHERE employee_id = $1 AND revoked_at IS NULL",
    )
    .bind(employee_id)
    .execute(&mut *tx)
    .await?;

    let sql = format!(
        "INSERT INTO aruco_cards (marker_id, dictionary, employee_id) \
         VALUES ($1, $2, $3) RETURNING {CARD_COLUMNS}"
    );
    let card = sqlx::query_as::<_, ArucoCard>(&sql)
        .bind(body.marker_id)
        .bind(&body.dictionary)
        .bind(employee_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| match &e {
            sqlx::Error::Database(db) if db.is_unique_violation() => ApiError::Conflict(
                "bu ArUco ID baska bir personele tanimli".into(),
            ),
            _ => ApiError::Database(e),
        })?;

    tx.commit().await?;
    Ok(Json(card))
}

/// Kart kaybi/iade durumunda aktif karti iptal eder.
async fn revoke(
    State(state): State<AppState>,
    Path(employee_id): Path<Uuid>,
) -> ApiResult<Json<ArucoCard>> {
    let sql = format!(
        "UPDATE aruco_cards SET revoked_at = now() \
         WHERE employee_id = $1 AND revoked_at IS NULL RETURNING {CARD_COLUMNS}"
    );
    let card = sqlx::query_as::<_, ArucoCard>(&sql)
        .bind(employee_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(ApiError::NotFound)?;
    Ok(Json(card))
}
