"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { AuthBrand, AuthFooterSignature } from "@/components/auth/auth-brand";
import { registerUser } from "@/lib/auth-api";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { user } = await registerUser({ email, username, password });
      window.alert(
        `Account created for ${user.username}. Session wiring comes next.`
      );
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
            Create your account
          </h1>
          <p className="text-sm text-[#8B93A1]">
            Password needs at least 8 characters.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="email"
                className="font-mono text-[11px] uppercase tracking-wider text-[#8B93A1]"
              >
                Email
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="border-[#2A2F3A] bg-[#12151A] text-[#E8EAED] focus-visible:ring-[#F0A868]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="username"
                className="font-mono text-[11px] uppercase tracking-wider text-[#8B93A1]"
              >
                Username
              </Label>
              <Input
                id="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={3}
                maxLength={32}
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
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
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
              {loading ? "Creating account…" : "Create account"}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-[#8B93A1]">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-[#F0A868] hover:underline"
            >
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
      <AuthFooterSignature />
    </>
  );
}
