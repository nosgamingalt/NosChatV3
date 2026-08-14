const AUTH_SERVICE_URL =
  process.env.NEXT_PUBLIC_AUTH_SERVICE_URL ?? "http://localhost:4000";

export type BackendUser = {
  id: string;
  clerk_user_id: string;
  email: string;
  username: string | null;
};

/**
 * Calls the self-hosted Rust backend's protected /me route, passing the
 * Clerk session JWT as a bearer token. The backend verifies the token
 * against Clerk's JWKS (see backend/auth-service/src/clerk.rs) — Clerk
 * never talks to the backend directly except via the /webhooks/clerk sync
 * endpoint. This is the pattern every other protected backend route should
 * follow going forward.
 */
export async function fetchMe(token: string): Promise<BackendUser> {
  const res = await fetch(`${AUTH_SERVICE_URL}/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const message =
      data && typeof data === "object" && "error" in data
        ? (data as { error: string }).error
        : `Request failed with status ${res.status}`;
    throw new Error(message);
  }
  return res.json();
}
