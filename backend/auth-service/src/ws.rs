//! In-process WebSocket hub for real-time fan-out (new messages, friend
//! requests). One user can have multiple live connections (multiple tabs/
//! devices), so we keep a Vec of senders per user id and clean up dead ones
//! lazily on send failure.
//!
//! This is in-memory, single-process fan-out — fine for one backend
//! instance. The spec's long-term design (Section 8.1) is Redis pub/sub so
//! multiple backend instances can fan out to each other's connections;
//! revisit if this ever runs as more than one process.

use axum::extract::ws::{Message as WsMessage, WebSocket, WebSocketUpgrade};
use axum::extract::{Query, State};
use axum::response::IntoResponse;
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};
use uuid::Uuid;

use crate::AppState;

#[derive(Clone, Default)]
pub struct WsHub {
    connections: Arc<RwLock<HashMap<Uuid, Vec<mpsc::UnboundedSender<Value>>>>>,
}

impl WsHub {
    pub async fn register(&self, user_id: Uuid) -> mpsc::UnboundedReceiver<Value> {
        let (tx, rx) = mpsc::unbounded_channel();
        self.connections.write().await.entry(user_id).or_default().push(tx);
        rx
    }

    /// Drops every sender for this user whose receiver has already closed —
    /// called opportunistically rather than tracking connection identity.
    pub async fn prune(&self, user_id: Uuid) {
        let mut conns = self.connections.write().await;
        if let Some(v) = conns.get_mut(&user_id) {
            v.retain(|tx| !tx.is_closed());
            if v.is_empty() {
                conns.remove(&user_id);
            }
        }
    }

    pub async fn send_to(&self, user_id: Uuid, payload: Value) {
        let conns = self.connections.read().await;
        if let Some(senders) = conns.get(&user_id) {
            for tx in senders {
                let _ = tx.send(payload.clone());
            }
        }
    }

    pub async fn send_to_many(&self, user_ids: &[Uuid], payload: Value) {
        for id in user_ids {
            self.send_to(*id, payload.clone()).await;
        }
    }
}

#[derive(Deserialize)]
pub struct WsAuthQuery {
    token: String,
}

/// `GET /ws?token=<clerk session jwt>` — browsers can't set custom headers
/// on the WebSocket handshake, so the Clerk token travels as a query param
/// here instead of the `Authorization` header used everywhere else.
pub async fn ws_upgrade(
    ws: WebSocketUpgrade,
    Query(auth): Query<WsAuthQuery>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let claims = match state.clerk_verifier.verify(&auth.token).await {
        Ok(c) => c,
        Err(e) => {
            tracing::warn!("ws upgrade rejected: invalid token: {e}");
            return axum::http::StatusCode::UNAUTHORIZED.into_response();
        }
    };

    let user: Option<(Uuid,)> =
        sqlx::query_as("SELECT id FROM users WHERE clerk_user_id = $1")
            .bind(&claims.sub)
            .fetch_optional(&state.db)
            .await
            .unwrap_or(None);

    let Some((user_id,)) = user else {
        tracing::warn!("ws upgrade rejected: no local user row for {}", claims.sub);
        return axum::http::StatusCode::NOT_FOUND.into_response();
    };

    ws.on_upgrade(move |socket| handle_socket(socket, state, user_id))
}

async fn handle_socket(socket: WebSocket, state: AppState, user_id: Uuid) {
    let (mut sender, mut receiver) = socket.split();
    let mut rx = state.ws_hub.register(user_id).await;

    tracing::info!("ws connected: user {user_id}");

    let mut send_task = tokio::spawn(async move {
        while let Some(payload) = rx.recv().await {
            let text = payload.to_string();
            if sender.send(WsMessage::Text(text.into())).await.is_err() {
                break;
            }
        }
    });

    // We don't expect meaningful client->server messages yet (no typing
    // indicators wired up), but we must drain the receiver so pings/closes
    // are handled and the connection doesn't look hung.
    let hub = state.ws_hub.clone();
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            if matches!(msg, WsMessage::Close(_)) {
                break;
            }
        }
        hub.prune(user_id).await;
    });

    tokio::select! {
        _ = &mut send_task => recv_task.abort(),
        _ = &mut recv_task => send_task.abort(),
    }

    state.ws_hub.prune(user_id).await;
    tracing::info!("ws disconnected: user {user_id}");
}
