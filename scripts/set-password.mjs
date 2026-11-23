/**
 * Give an existing account a password, locally.
 *
 * Accounts made by magic link have no password, and the app cannot add one to an
 * account nobody can sign in to. This does it with the service-role key from
 * .env.local, which never leaves your machine — and the password is typed into your
 * own terminal, not into a chat window or a web form.
 *
 *   node scripts/set-password.mjs you@example.com
 */
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { createClient } from "@supabase/supabase-js";

const email = (process.argv[2] ?? "").trim().toLowerCase();
if (!email) {
  console.error("Usage: node scripts/set-password.mjs you@example.com");
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);

const sb = createClient(
  env.DAILYBITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL,
  env.DAILYBITE_SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const { data: list, error: listErr } = await sb.auth.admin.listUsers();
if (listErr) {
  console.error("Could not read the accounts:", listErr.message);
  process.exit(1);
}
const user = list.users.find((u) => (u.email ?? "").toLowerCase() === email);
if (!user) {
  console.error(`No account for ${email}. Accounts: ${list.users.map((u) => u.email).join(", ")}`);
  process.exit(1);
}

const rl = createInterface({ input: stdin, output: stdout });
const password = (await rl.question(`New password for ${email} (at least 8 characters): `)).trim();
rl.close();

if (password.length < 8) {
  console.error("Too short. Nothing was changed.");
  process.exit(1);
}

// email_confirm also clears "email not confirmed", which would otherwise block sign-in
// on a project that has confirmation turned on.
const { error } = await sb.auth.admin.updateUserById(user.id, { password, email_confirm: true });
if (error) {
  console.error("Could not set it:", error.message);
  process.exit(1);
}
console.log(`Done. Sign in at /login with ${email} and that password.`);
