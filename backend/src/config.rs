use std::env;

/// Ortam degiskenlerinden okunan calisma ayarlari.
#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub bind_addr: String,
    /// Ayni karti pes pese okuyan kioskun mukerrer kayit acmasini engeller.
    pub scan_debounce_seconds: i64,
    /// CORS icin izin verilen origin. Uretimde frontend ile API ayni alan
    /// adinda oldugundan bos birakilir ve CORS katmani hic eklenmez.
    pub allowed_origin: Option<String>,
    /// JWT imzalama anahtari. Degistirilirse acik oturumlar duser.
    pub jwt_secret: String,
    /// Hic kullanici yokken olusturulacak ilk yonetici hesabi.
    pub admin_username: String,
    pub admin_password: Option<String>,
    /// Gecis fotograflarinin yazildigi dizin. Veritabaninda yalnizca yol
    /// durur; dosyalar burada birikir ve ayri yedeklenir.
    pub photo_dir: String,
    /// Kioskun checkpoint anahtari olmadan kayit acabilmesi. Sahaya cikmadan
    /// once kapatilmali; acikken adresi bilen herkes gecis olusturabilir.
    pub allow_anonymous_kiosk: bool,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        let jwt_secret = env::var("PTS_JWT_SECRET")
            .map_err(|_| anyhow::anyhow!("PTS_JWT_SECRET tanimli degil"))?;

        if jwt_secret.len() < 16 {
            anyhow::bail!("PTS_JWT_SECRET en az 16 karakter olmali");
        }

        Ok(Self {
            database_url: env::var("DATABASE_URL")
                .map_err(|_| anyhow::anyhow!("DATABASE_URL tanimli degil"))?,
            bind_addr: env::var("PTS_BIND_ADDR").unwrap_or_else(|_| "0.0.0.0:8080".into()),
            scan_debounce_seconds: env::var("PTS_SCAN_DEBOUNCE_SECONDS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(30),
            allowed_origin: env::var("PTS_ALLOWED_ORIGIN")
                .ok()
                .filter(|v| !v.trim().is_empty()),
            jwt_secret,
            admin_username: env::var("PTS_ADMIN_USERNAME").unwrap_or_else(|_| "admin".into()),
            admin_password: env::var("PTS_ADMIN_PASSWORD")
                .ok()
                .filter(|v| !v.trim().is_empty()),
            photo_dir: env::var("PTS_PHOTO_DIR").unwrap_or_else(|_| "/data/photos".into()),
            allow_anonymous_kiosk: env::var("PTS_ALLOW_ANONYMOUS_KIOSK")
                .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
                .unwrap_or(false),
        })
    }
}
