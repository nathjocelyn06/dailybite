import Image from "next/image";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in · DailyBite" };

/** The only page outside the app shell: no sidebar, no tab bar, nothing to click but in. */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next = "" } = await searchParams;
  return (
    <main className="login">
      <section className="login-card">
        <Image className="login-logo" src="/logo-dailybite-splash.png" alt="DailyBite" width={1207} height={471} priority />
        <h1 className="h1">Your food journal</h1>
        <p className="muted">
          A fridge you decorate, a journal you keep, a budget that adds up. Sign in with your email —
          there is no password to remember, and a new address makes a new account.
        </p>
        <LoginForm next={next} />
      </section>
    </main>
  );
}
