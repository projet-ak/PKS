mod config;
mod error;
mod models;
mod routes;

use std::time::Duration;

use axum::http::{header, HeaderValue, Method};
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tracing_subscriber::EnvFilter;

use crate::config::Config;

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub config: Config,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| "info,sqlx=warn".into()),
        )
        .init();

    let config = Config::from_env()?;

    let db = PgPoolOptions::new()
        .max_connections(10)
        .acquire_timeout(Duration::from_secs(5))
        .connect(&config.database_url)
        .await?;

    sqlx::migrate!("../migrations").run(&db).await?;
    tracing::info!("veritabani migration'lari uygulandi");

    // Uretimde frontend ile API ayni alan adindan servis edilir, o yuzden
    // CORS katmani yalnizca PKS_ALLOWED_ORIGIN verildiginde eklenir.
    let cors = match &config.allowed_origin {
        Some(origin) => Some(
            CorsLayer::new()
                .allow_origin(origin.parse::<HeaderValue>()?)
                .allow_methods([Method::GET, Method::POST, Method::DELETE])
                .allow_headers([header::CONTENT_TYPE]),
        ),
        None => None,
    };

    let bind_addr = config.bind_addr.clone();
    let mut app = routes::router(AppState { db, config });
    if let Some(cors) = cors {
        app = app.layer(cors);
    }
    let app = app.layer(TraceLayer::new_for_http());

    let listener = tokio::net::TcpListener::bind(&bind_addr).await?;
    tracing::info!("PKS API dinlemede: http://{bind_addr}");
    axum::serve(listener, app).await?;

    Ok(())
}
