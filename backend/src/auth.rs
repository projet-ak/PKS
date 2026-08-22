//! Panel kullanicilarinin kimlik dogrulamasi.
//!
//! Parolalar Argon2id ile saklanir, oturum JWT ile tasinir. Kiosk cihazlari
//! bu akisin disindadir; onlar checkpoint anahtariyla taninir.

use argon2::password_hash::rand_core::OsRng;
use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;
use axum::extract::FromRequestParts;
use axum::http::request::Parts;
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::error::ApiError;
use crate::AppState;

/// Oturum suresi. Panelde uzun mesai boyunca tekrar giris istemeyecek kadar
/// uzun, calinan bir tokenin sonsuza kadar gecerli olmayacagi kadar kisa.
const TOKEN_HOURS: i64 = 12;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    /// Kullanici kimligi.
    pub sub: String,
    pub username: String,
    pub role: String,
    pub exp: i64,
}

/// Istek uzerinden dogrulanmis kullanici. Handler imzasina eklendiginde
/// token yoksa veya gecersizse handler hic calismaz.
#[derive(Debug, Clone)]
pub struct CurrentUser {
    pub id: Uuid,
    pub username: String,
    pub role: String,
}

impl CurrentUser {
    pub fn is_admin(&self) -> bool {
        self.role == "admin"
    }

    /// Veri degistiren islemler icin: viewer rolu yalnizca okuyabilir.
    pub fn require_write(&self) -> Result<(), ApiError> {
        if self.role == "viewer" {
            return Err(ApiError::Forbidden(
                "bu islem icin yetkiniz yok".into(),
            ));
        }
        Ok(())
    }

    pub fn require_admin(&self) -> Result<(), ApiError> {
        if !self.is_admin() {
            return Err(ApiError::Forbidden("bu islem yonetici gerektirir".into()));
        }
        Ok(())
    }
}

impl FromRequestParts<AppState> for CurrentUser {
    type Rejection = ApiError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let header = parts
            .headers
            .get(axum::http::header::AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .ok_or(ApiError::Unauthorized)?;

        let token = header
            .strip_prefix("Bearer ")
            .ok_or(ApiError::Unauthorized)?;

        let claims = verify_token(token, &state.config.jwt_secret)?;

        Ok(CurrentUser {
            id: claims.sub.parse().map_err(|_| ApiError::Unauthorized)?,
            username: claims.username,
            role: claims.role,
        })
    }
}

pub fn hash_password(password: &str) -> Result<String, ApiError> {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| ApiError::Internal(format!("parola hash'lenemedi: {e}")))
}

pub fn verify_password(password: &str, hash: &str) -> bool {
    match PasswordHash::new(hash) {
        Ok(parsed) => Argon2::default()
            .verify_password(password.as_bytes(), &parsed)
            .is_ok(),
        Err(_) => false,
    }
}

pub fn issue_token(
    user_id: Uuid,
    username: &str,
    role: &str,
    secret: &str,
) -> Result<String, ApiError> {
    let claims = Claims {
        sub: user_id.to_string(),
        username: username.to_string(),
        role: role.to_string(),
        exp: (Utc::now() + Duration::hours(TOKEN_HOURS)).timestamp(),
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|e| ApiError::Internal(format!("token uretilemedi: {e}")))
}

fn verify_token(token: &str, secret: &str) -> Result<Claims, ApiError> {
    decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )
    .map(|data| data.claims)
    .map_err(|_| ApiError::Unauthorized)
}

/// Ilk yonetici hesabini ortam degiskenlerinden olusturur.
///
/// Yalnizca hic kullanici yokken calisir; parola degistirildikten sonra
/// .env'deki eski deger hesabi geri almaz.
pub async fn seed_admin(
    db: &PgPool,
    username: &str,
    password: &str,
) -> Result<(), anyhow::Error> {
    let count: i64 = sqlx::query_scalar("SELECT count(*) FROM users")
        .fetch_one(db)
        .await?;

    if count > 0 {
        return Ok(());
    }

    if password.len() < 8 {
        anyhow::bail!("PTS_ADMIN_PASSWORD en az 8 karakter olmali");
    }

    let hash = hash_password(password).map_err(|e| anyhow::anyhow!("{e}"))?;

    sqlx::query(
        "INSERT INTO users (username, password_hash, role, full_name) \
         VALUES ($1, $2, 'admin', 'Sistem Yoneticisi')",
    )
    .bind(username)
    .bind(hash)
    .execute(db)
    .await?;

    tracing::info!(username, "ilk yonetici hesabi olusturuldu");
    Ok(())
}

/// Kiosk cihazinin gonderdigi anahtari dogrular ve gecis noktasini dondurur.
pub async fn checkpoint_from_key(
    db: &PgPool,
    api_key: &str,
) -> Result<(Uuid, String), ApiError> {
    let row: Option<(Uuid, String)> = sqlx::query_as(
        "UPDATE checkpoints SET last_seen_at = now() \
         WHERE api_key = $1 AND is_active RETURNING id, code",
    )
    .bind(api_key)
    .fetch_optional(db)
    .await?;

    // Kiosk oturum acmaz; "giris yapin" demek yaniltici olurdu.
    row.ok_or_else(|| {
        ApiError::Forbidden(
            "cihaz anahtari gecersiz veya pasif; panelden yeni anahtar alin".into(),
        )
    })
}
