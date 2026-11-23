"use client";
import { useActionState, useState } from "react";
import {
  sendLinkAction,
  signInPasswordAction,
  signUpPasswordAction,
  verifyCodeAction,
  type LoginState
} from "./actions";

/**
 * Password first, link second.
 *
 * The magic link is the nicer idea, but it rides on Supabase's built-in mailer, which
 * allows a few messages an hour on the free tier — so the dependable path is the one
 * that needs no email at all, and the link is there for anyone who wants it.
 */
export function LoginForm({ next }: { next: string }) {
  const [signUp, setSignUp] = useState(false);
  const [withLink, setWithLink] = useState(false);

  const [inState, signIn, signingIn] = useActionState<LoginState, FormData>(signInPasswordAction, {});
  const [upState, createAccount, creating] = useActionState<LoginState, FormData>(signUpPasswordAction, {});
  const [linkState, sendLink, sending] = useActionState<LoginState, FormData>(sendLinkAction, {});
  const [codeState, verify, verifying] = useActionState<LoginState, FormData>(verifyCodeAction, {});

  const state = signUp ? upState : inState;
  const busy = signingIn || creating;
  const sent = linkState.sent;

  if (withLink) {
    return (
      <>
        <form action={sendLink} className="login-form">
          <label className="field">
            Your email
            <input className="input" type="email" name="email" required autoComplete="email" autoFocus placeholder="you@example.com" defaultValue={sent ?? ""} />
          </label>
          <input type="hidden" name="next" value={next} />
          <button className="btn pri" disabled={sending}>{sending ? "Sending…" : sent ? "Send another link" : "Email me a link"}</button>
          {linkState.error && <p className="banner warn" role="alert">{linkState.error}</p>}
        </form>

        {sent && (
          <div className="login-sent">
            <p>Check <strong>{sent}</strong> and tap the link. It works on any device.</p>
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
          </div>
        )}

        <button type="button" className="link-btn" onClick={() => setWithLink(false)}>Use a password instead</button>
      </>
    );
  }

  return (
    <>
      <form action={signUp ? createAccount : signIn} className="login-form" key={signUp ? "up" : "in"}>
        <label className="field">
          Your email
          <input className="input" type="email" name="email" required autoComplete="email" autoFocus placeholder="you@example.com" />
        </label>
        <label className="field">
          Password
          <input
            className="input"
            type="password"
            name="password"
            required
            minLength={signUp ? 8 : undefined}
            autoComplete={signUp ? "new-password" : "current-password"}
            placeholder={signUp ? "at least 8 characters" : ""}
          />
        </label>
        <input type="hidden" name="next" value={next} />
        <button className="btn pri" disabled={busy}>
          {busy ? "One moment…" : signUp ? "Create my account" : "Sign in"}
        </button>
        {state.error && <p className="banner warn" role="alert">{state.error}</p>}
        {upState.sent && !upState.error && (
          <p className="banner">Account made. Confirm it from the email sent to <strong>{upState.sent}</strong>, then sign in.</p>
        )}
      </form>

      <div className="login-alt">
        <button type="button" className="link-btn" onClick={() => setSignUp(!signUp)}>
          {signUp ? "I already have an account" : "Create an account"}
        </button>
        <span aria-hidden="true">·</span>
        <button type="button" className="link-btn" onClick={() => setWithLink(true)}>Email me a link instead</button>
      </div>
    </>
  );
}
