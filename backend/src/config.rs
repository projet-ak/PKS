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
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
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
        })
    }
}
