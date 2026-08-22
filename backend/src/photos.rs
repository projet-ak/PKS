//! Gecis anindaki kamera goruntusunun saklanmasi.
//!
//! Goruntuler veritabaninda degil dosya sisteminde tutulur; tabloda yalnizca
//! goreli yol durur. Boylece veritabani yedegi kucuk kalir ve fotograflar
//! ayri bir birimde birikir.

use std::path::{Path, PathBuf};

use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use chrono::{DateTime, Datelike, Utc};

use crate::error::ApiError;

/// Tek bir karenin ust siniri. 640x480 JPEG tipik olarak 40-80 KB tutar;
/// 2 MB fazlasiyla yeterli ve sisirilmis istekleri erkenden reddeder.
const MAX_PHOTO_BYTES: usize = 2 * 1024 * 1024;

/// Kioskun gonderdigi data URL'i cozup diske yazar ve goreli yolu doner.
///
/// Yol gun bazinda klasorlenir: tek bir dizinde yuz binlerce dosya birikirse
/// listeleme ve yedekleme yavaslar.
pub fn store(
    photo_dir: &str,
    data_url: &str,
    occurred_at: DateTime<Utc>,
    event_id: i64,
) -> Result<String, ApiError> {
    // "data:image/jpeg;base64,...." veya duz base64 kabul ediyoruz.
    let payload = data_url
        .split_once(",")
        .map(|(_, rest)| rest)
        .unwrap_or(data_url);

    let bytes = STANDARD
        .decode(payload.trim())
        .map_err(|_| ApiError::BadRequest("fotograf cozulemedi".into()))?;

    if bytes.is_empty() {
        return Err(ApiError::BadRequest("fotograf bos".into()));
    }

    if bytes.len() > MAX_PHOTO_BYTES {
        return Err(ApiError::BadRequest(format!(
            "fotograf cok buyuk ({} KB); en fazla {} KB",
            bytes.len() / 1024,
            MAX_PHOTO_BYTES / 1024
        )));
    }

    let relative = format!(
        "{:04}/{:02}/{:02}/{event_id}.jpg",
        occurred_at.year(),
        occurred_at.month(),
        occurred_at.day()
    );

    let full = PathBuf::from(photo_dir).join(&relative);
    if let Some(parent) = full.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| ApiError::Internal(format!("fotograf dizini acilamadi: {e}")))?;
    }

    std::fs::write(&full, &bytes)
        .map_err(|e| ApiError::Internal(format!("fotograf yazilamadi: {e}")))?;

    Ok(relative)
}

/// Kayittaki goreli yolu okunabilir tam yola cevirir.
///
/// Yol veritabanindan geldigi icin guvenilir sayilmaz; ".." gibi parcalar
/// dizin disina cikmayi denerse reddederiz.
pub fn read(photo_dir: &str, relative: &str) -> Result<Vec<u8>, ApiError> {
    let candidate = Path::new(relative);
    let safe = candidate
        .components()
        .all(|c| matches!(c, std::path::Component::Normal(_)));

    if !safe {
        return Err(ApiError::BadRequest("gecersiz fotograf yolu".into()));
    }

    std::fs::read(PathBuf::from(photo_dir).join(candidate)).map_err(|_| ApiError::NotFound)
}
