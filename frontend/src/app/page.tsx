import { redirect } from "next/navigation";

// No dashboard/home screen exists yet (Phase 1 is auth-only scaffolding),
// so route the bare `/` straight to login rather than leaving the default
// create-next-app boilerplate homepage in place.
export default function Home() {
  redirect("/login");
}
