const AUTH_SERVICE_URL =
  process.env.NEXT_PUBLIC_AUTH_SERVICE_URL ?? "http://localhost:4000";

export type AuthUser = {
  id: string;
  email: string;
  username: string;
};

export type AuthResponse = {
  token: string;
  user: AuthUser;
};

export type ApiError = {
  error: string;
};

async function parseJsonOrThrow<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? (data as ApiError).error
        : `Request failed with status ${res.status}`;
    throw new Error(message);
  }
  return data as T;
}

export async function registerUser(params: {
  email: string;
  username: string;
  password: string;
}): Promise<AuthResponse> {
  const res = await fetch(`${AUTH_SERVICE_URL}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return parseJsonOrThrow<AuthResponse>(res);
}

export async function loginUser(params: {
  emailOrUsername: string;
  password: string;
}): Promise<AuthResponse> {
  const res = await fetch(`${AUTH_SERVICE_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email_or_username: params.emailOrUsername,
      password: params.password,
    }),
  });
  return parseJsonOrThrow<AuthResponse>(res);
}
