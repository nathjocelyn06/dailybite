"use client";
import { useActionState } from "react";
import { sendLinkAction, verifyCodeAction, type LoginState } from "./actions";

/**
 * One field, one button. The same address signs you in or signs you up, so there is
 * no "do I already have an account?" to answer.
 */
export function LoginForm({ next }: { next: string }) {
  const [state, send, sending] = useActionState<LoginState, FormData>(sendLinkAction, {});
  const [codeState, verify, verifying] = useActionState<LoginState, FormData>(verifyCodeAction, {});
  const sent = state.sent;

  return (
    <>
      <form action={send} className="login-form">
        <label className="field">
          Your email
          <input
            className="input"
            type="email"
            name="email"
            required
            autoComplete="email"
            autoFocus
            placeholder="you@example.com"
            defaultValue={sent ?? ""}
          />
        </label>
        <input type="hidden" name="next" value={next} />
        <button className="btn pri" disabled={sending}>{sending ? "Sending…" : sent ? "Send another link" : "Email me a link"}</button>
        {state.error && <p className="banner warn" role="alert">{state.error}</p>}
      </form>

      {sent && (
        <div className="login-sent">
          <p>
            Check <strong>{sent}</strong> and tap the link to come in. It works on this device or any other.
          </p>
          <form action={verify} className="login-code">
            <label className="field">
              Or paste the code from the email
              <input className="input" name="token" inputMode="numeric" autoComplete="one-time-code" placeholder="123456" maxLength={6} />
            </label>
            <input type="hidden" name="email" value={sent} />
            <input type="hidden" name="next" value={next} />
            <button className="btn" disabled={verifying}>{verifying ? "Checking…" : "Sign in with the code"}</button>
          </form>
          {codeState.error && <p className="banner warn" role="alert">{codeState.error}</p>}
          <p className="muted" style={{ fontSize: 12 }}>
            Nothing in the inbox after a minute? Look in spam — the link comes from Supabase, not from DailyBite.
          </p>
        </div>
      )}
    </>
  );
}
