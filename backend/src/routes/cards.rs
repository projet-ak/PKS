use axum::extract::{Path, State};
use axum::routing::post;
use axum::{Json, Router};
use uuid::Uuid;

use crate::auth::CurrentUser;
use crate::error::{ApiError, ApiResult};
use crate::models::{ArucoCard, AssignCard};
use crate::AppState;

/// ARUCO_MIP_36h12 sozlugunde 250 kod var, yani gecerli ID araligi 0-249.
/// Sozlugu degistirirsek burasi da degismeli.
pub const MAX_MARKER_ID: i32 = 249;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/employee/{employee_id}", post(assign).delete(revoke))
        .route("/employee/{employee_id}/auto", post(assign_from_employee_no))
}

const CARD_COLUMNS: &str = "id, marker_id, dictionary, employee_id, issued_at, revoked_at";

/// Sicil numarasindan ArUco marker ID'si turetir.
///
/// Sicil metin olarak tutuluyor ve "00001" gibi basinda sifir tasiyabiliyor;
/// bu yuzden yalnizca rakamlari alip sayiya ceviririz. Harf iceren sicillerde
/// ("A-14" gibi) harfler yok sayilir. Sonuc sozlugun sinirini asarsa hata
/// dondururuz, cunku uretilemeyen bir kart tanimlamak anlamsiz olur.
pub fn marker_id_from_employee_no(employee_no: &str) -> Result<i32, ApiError> {
    let digits: String = employee_no.chars().filter(|c| c.is_ascii_digit()).collect();

    if digits.is_empty() {
        return Err(ApiError::BadRequest(format!(
            "'{employee_no}' sicil numarasi rakam icermiyor, ArUco ID turetilemedi"
        )));
    }

    let value: i64 = digits.parse().map_err(|_| {
        ApiError::BadRequest(format!("'{employee_no}' sicil numarasi cok buyuk"))
    })?;

    if value > MAX_MARKER_ID as i64 {
        return Err(ApiError::BadRequest(format!(
            "sicil {employee_no} icin ArUco ID {value} olurdu; kullanilan sozluk \
             en fazla {MAX_MARKER_ID} destekliyor"
        )));
    }

    Ok(value as i32)
}

/// Personele ArUco kart tanimlar. Varsa onceki aktif kart otomatik iptal edilir,
/// boylece bir personelin her zaman tek gecerli karti olur.
async fn assign(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(employee_id): Path<Uuid>,
    Json(body): Json<AssignCard>,
) -> ApiResult<Json<ArucoCard>> {
    user.require_write()?;
    let card = assign_marker(&state, employee_id, body.marker_id, &body.dictionary).await?;
    Ok(Json(card))
}

/// Kart ID'sini personelin sicil numarasindan turetip tanimlar.
async fn assign_from_employee_no(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(employee_id): Path<Uuid>,
) -> ApiResult<Json<ArucoCard>> {
    user.require_write()?;
    let employee_no: String =
        sqlx::query_scalar("SELECT employee_no FROM employees WHERE id = $1 AND is_active")
            .bind(employee_id)
            .fetch_optional(&state.db)
            .await?
            .ok_or(ApiError::NotFound)?;

    let marker_id = marker_id_from_employee_no(&employee_no)?;
    let card = assign_marker(&state, employee_id, marker_id, "ARUCO_MIP_36h12").await?;
    Ok(Json(card))
}

async fn assign_marker(
    state: &AppState,
    employee_id: Uuid,
    marker_id: i32,
    dictionary: &str,
) -> ApiResult<ArucoCard> {
    if !(0..=MAX_MARKER_ID).contains(&marker_id) {
        return Err(ApiError::BadRequest(format!(
            "ArUco ID 0 ile {MAX_MARKER_ID} arasinda olmali"
        )));
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
        .bind(marker_id)
        .bind(dictionary)
        .bind(employee_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| {
            if let sqlx::Error::Database(db) = &e {
                if db.is_unique_violation() {
                    return ApiError::Conflict(format!(
                        "ArUco ID {marker_id} baska bir personele tanimli"
                    ));
                }
            }
            ApiError::Database(e)
        })?;

    tx.commit().await?;
    Ok(card)
}

/// Kart kaybi/iade durumunda aktif karti iptal eder.
async fn revoke(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(employee_id): Path<Uuid>,
) -> ApiResult<Json<ArucoCard>> {
    user.require_write()?;
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
