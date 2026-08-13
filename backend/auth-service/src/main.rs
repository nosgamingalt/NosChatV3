mod auth;
mod routes;

use axum::{
    routing::{get, post},
    Json, Router,
};
use serde_json::{json, Value};
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use std::net::SocketAddr;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing_subscriber::EnvFilter;

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub jwt_secret: String,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .init();

    // NOTE: local dev Postgres runs on host port 5433, not the default 5432 —
    // this machine has a pre-existing native Windows Postgres service bound
    // to 5432 that isn't part of this project. See docker-compose.yml.
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://noschat:noschat@localhost:5433/noschat".to_string());

    let jwt_secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| {
        tracing::warn!(
            "JWT_SECRET not set — using an insecure default. Fine for local dev only, \
             never for anything real. Set it in .env before deploying anywhere."
        );
        "dev-insecure-secret-change-me".to_string()
    });

    // Attempt to connect, but don't crash the whole service if the DB isn't up yet
    // during early local scaffolding — /health should still report DB status,
    // and routes that need the DB will simply fail per-request if it's down.
    let pool_result = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await;

    let db_ok = pool_result.is_ok();
    if let Err(ref e) = pool_result {
        tracing::warn!("Could not connect to Postgres at startup: {e}. /health will report db: false until it's reachable, and /register and /login will fail until then too.");
    }

    // If the initial connection failed, still build a lazy pool so the
    // process can serve /health and retry DB connectivity on first real
    // request, rather than requiring a restart once Postgres comes up.
    let db = match pool_result {
        Ok(pool) => pool,
        Err(_) => PgPoolOptions::new()
            .max_connections(5)
            .connect_lazy(&database_url)?,
    };

    let state = AppState { db, jwt_secret };

    let app = Router::new()
        .route("/health", get(move || health(db_ok)))
        .route("/register", post(routes::register))
        .route("/login", post(routes::login))
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], 4000));
    tracing::info!("auth-service listening on {addr}");
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

async fn health(db_ok: bool) -> Json<Value> {
    Json(json!({ "status": "ok", "service": "auth-service", "db": db_ok }))
}
