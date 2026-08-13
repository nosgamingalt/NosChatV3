use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

use crate::auth::{hash_password, issue_jwt, verify_password};
use crate::AppState;

#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    pub email: String,
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub token: String,
    pub user: UserPublic,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct UserPublic {
    pub id: Uuid,
    pub email: String,
    pub username: String,
}

#[derive(Debug, thiserror::Error)]
pub enum AuthError {
    #[error("email or username already in use")]
    Conflict,
    #[error("invalid email, username, or password")]
    Validation,
    #[error("invalid credentials")]
    InvalidCredentials,
    #[error("internal error")]
    Internal(#[from] anyhow::Error),
}

impl IntoResponse for AuthError {
    fn into_response(self) -> axum::response::Response {
        let (status, msg) = match &self {
            AuthError::Conflict => (StatusCode::CONFLICT, self.to_string()),
            AuthError::Validation => (StatusCode::BAD_REQUEST, self.to_string()),
            AuthError::InvalidCredentials => (StatusCode::UNAUTHORIZED, self.to_string()),
            AuthError::Internal(e) => {
                tracing::error!("internal auth error: {e:#}");
                (StatusCode::INTERNAL_SERVER_ERROR, "internal error".to_string())
            }
        };
        (status, Json(json!({ "error": msg }))).into_response()
    }
}

fn validate_register(req: &RegisterRequest) -> Result<(), AuthError> {
    if !req.email.contains('@') || req.email.len() < 5 {
        return Err(AuthError::Validation);
    }
    if req.username.trim().len() < 3 || req.username.len() > 32 {
        return Err(AuthError::Validation);
    }
    if req.password.len() < 8 {
        return Err(AuthError::Validation);
    }
    Ok(())
}

pub async fn register(
    State(state): State<AppState>,
    Json(req): Json<RegisterRequest>,
) -> Result<Json<AuthResponse>, AuthError> {
    validate_register(&req)?;

    let password_hash = hash_password(&req.password).map_err(AuthError::Internal)?;

    let existing: Option<(Uuid,)> = sqlx::query_as(
        "SELECT id FROM users WHERE lower(email) = lower($1) OR lower(username) = lower($2)",
    )
    .bind(&req.email)
    .bind(&req.username)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| AuthError::Internal(e.into()))?;

    if existing.is_some() {
        return Err(AuthError::Conflict);
    }

    let user: UserPublic = sqlx::query_as(
        r#"
        INSERT INTO users (email, username, password_hash)
        VALUES ($1, $2, $3)
        RETURNING id, email, username
        "#,
    )
    .bind(&req.email)
    .bind(&req.username)
    .bind(&password_hash)
    .fetch_one(&state.db)
    .await
    .map_err(|e| AuthError::Internal(e.into()))?;

    let token = issue_jwt(user.id, &state.jwt_secret).map_err(AuthError::Internal)?;

    Ok(Json(AuthResponse { token, user }))
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub email_or_username: String,
    pub password: String,
}

pub async fn login(
    State(state): State<AppState>,
    Json(req): Json<LoginRequest>,
) -> Result<Json<AuthResponse>, AuthError> {
    #[derive(sqlx::FromRow)]
    struct UserRow {
        id: Uuid,
        email: String,
        username: String,
        password_hash: String,
    }

    let row: Option<UserRow> = sqlx::query_as(
        "SELECT id, email, username, password_hash FROM users \
         WHERE lower(email) = lower($1) OR lower(username) = lower($1)",
    )
    .bind(&req.email_or_username)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| AuthError::Internal(e.into()))?;

    let row = row.ok_or(AuthError::InvalidCredentials)?;

    let ok = verify_password(&req.password, &row.password_hash).map_err(AuthError::Internal)?;
    if !ok {
        return Err(AuthError::InvalidCredentials);
    }

    let token = issue_jwt(row.id, &state.jwt_secret).map_err(AuthError::Internal)?;

    Ok(Json(AuthResponse {
        token,
        user: UserPublic {
            id: row.id,
            email: row.email,
            username: row.username,
        },
    }))
}
