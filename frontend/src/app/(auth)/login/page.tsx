"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { AuthBrand, AuthFooterSignature } from "@/components/auth/auth-brand";
import { loginUser } from "@/lib/auth-api";

export default function LoginPage() {
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { user } = await loginUser({ emailOrUsername, password });
      // No client-side session storage wired up yet — Phase 1 scaffolding
      // only proves the login round-trip against auth-service. Token/session
      // persistence (cookies vs. localStorage, refresh flow) is a decision
      // to make once NosChatV3-Spec-v2.md's auth/session section is back in
      // the repo, not something to guess at here.
      setError(null);
      window.alert(`Signed in as ${user.username}. Session wiring comes next.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <AuthBrand />
      <Card className="border-[#2A2F3A] bg-[#1B1F27]">
        <CardHeader>
          <h1 className="text-lg font-semibold text-[#E8EAED]">
            Sign in to your server
          </h1>
          <p className="text-sm text-[#8B93A1]">
            Enter your username or email to continue.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="emailOrUsername"
                className="font-mono text-[11px] uppercase tracking-wider text-[#8B93A1]"
              >
                Email or username
              </Label>
              <Input
                id="emailOrUsername"
                autoComplete="username"
                value={emailOrUsername}
                onChange={(e) => setEmailOrUsername(e.target.value)}
                required
                className="border-[#2A2F3A] bg-[#12151A] text-[#E8EAED] focus-visible:ring-[#F0A868]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="password"
                className="font-mono text-[11px] uppercase tracking-wider text-[#8B93A1]"
              >
                Password
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="border-[#2A2F3A] bg-[#12151A] text-[#E8EAED] focus-visible:ring-[#F0A868]"
              />
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-md border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-300"
              >
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="mt-1 bg-[#F0A868] text-[#12151A] hover:bg-[#e59a52]"
            >
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-[#8B93A1]">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="font-medium text-[#F0A868] hover:underline"
            >
              Create one
            </Link>
          </p>
        </CardContent>
      </Card>
      <AuthFooterSignature />
    </>
  );
}
