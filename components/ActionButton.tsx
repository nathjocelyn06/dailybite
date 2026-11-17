"use client";
import { useTransition } from "react";

/** Calls a server action with fixed args. Disabled while pending; errors are shown inline. */
export function ActionButton<A extends unknown[]>({
  action,
  args,
  children,
  className = "btn sm",
  confirm,
  label
}: {
  action: (...a: A) => Promise<unknown>;
  args: A;
  children: React.ReactNode;
  className?: string;
  confirm?: string;
  label?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      disabled={pending}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        start(async () => {
          try {
            await action(...args);
          } catch (e) {
            alert(e instanceof Error ? e.message : "Something went wrong");
          }
        });
      }}
    >
      {pending ? "…" : children}
    </button>
  );
}
