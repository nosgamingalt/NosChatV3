import { auth, currentUser } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { fetchMe } from "@/lib/backend-api";

// Minimal protected dashboard — replaces the old "redirect straight to
// /login" stub now that Clerk + middleware actually gate this route.
// Proves the full loop end to end: Clerk session -> JWT -> backend /me
// verifies it against Clerk's JWKS and returns the locally-synced user row.
export default async function Home() {
  const { getToken } = await auth();
  const user = await currentUser();
  if (!user) {
    redirect("/login");
  }

  const token = await getToken();
  let backendStatus: string;
  try {
    const me = token ? await fetchMe(token) : null;
    backendStatus = me
      ? `Backend confirms local user row for ${me.email} (id ${me.id}).`
      : "No Clerk session token available to check the backend.";
  } catch (err) {
    // Most likely cause during local dev: auth-service isn't running, or
    // the Clerk webhook hasn't synced this user into the local `users`
    // table yet (see backend/auth-service/src/webhooks.rs).
    backendStatus =
      err instanceof Error
        ? `Backend check failed: ${err.message}`
        : "Backend check failed.";
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center gap-4 px-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-[#E8EAED]">
          Welcome, {user.firstName ?? user.username ?? "there"}
        </h1>
        <UserButton />
      </div>
      <Card className="border-[#2A2F3A] bg-[#1B1F27]">
        <CardHeader>
          <p className="text-sm text-[#8B93A1]">
            Backend sync check (Clerk JWT → auth-service → Postgres)
          </p>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[#E8EAED]">{backendStatus}</p>
        </CardContent>
      </Card>
    </div>
  );
}
