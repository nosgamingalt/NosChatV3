use axum::{routing::get, Router, Json};
use serde_json::{json, Value};
use sqlx::postgres::PgPoolOptions;
use std::net::SocketAddr;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .init();

    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://noschat:noschat@localhost:5432/noschat".to_string());

    // Attempt to connect, but don't crash the whole service if the DB isn't up yet
    // during early local scaffolding — /health should still report DB status.
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await;

    let db_ok = pool.is_ok();
    if let Err(ref e) = pool {
        tracing::warn!("Could not connect to Postgres at startup: {e}. /health will report db: false until it's reachable.");
    }

    let app = Router::new()
        .route("/health", get(move || health(db_ok)))
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http());

    let addr = SocketAddr::from(([0, 0, 0, 0], 4000));
    tracing::info!("auth-service listening on {addr}");
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

async fn health(db_ok: bool) -> Json<Value> {
    Json(json!({ "status": "ok", "service": "auth-service", "db": db_ok }))
}
