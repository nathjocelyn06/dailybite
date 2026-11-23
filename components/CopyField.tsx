"use client";
import { useState } from "react";

/** A secret you have to hand to something else: hidden by default, copied in one tap. */
export function CopyField({ label, value }: { label: string; value: string }) {
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setShown(true); // no clipboard permission: at least let them select it
    }
  }

  return (
    <label className="field">
      {label}
      <span className="copy-field">
        <input className="input" readOnly value={shown ? value : value.replace(/key=.*/, "key=••••••••••••")} onFocus={(e) => e.currentTarget.select()} />
        <button type="button" className="btn sm" onClick={() => setShown(!shown)}>{shown ? "Hide" : "Show"}</button>
        <button type="button" className="btn sm pri" onClick={() => void copy()}>{copied ? "Copied" : "Copy"}</button>
      </span>
    </label>
  );
}
