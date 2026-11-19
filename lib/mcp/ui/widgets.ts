import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The three DailyBite views that Claude can render inline (MCP Apps / SEP-1865).
 *
 * Each one is a single self-contained HTML document: the host drops it in a sandboxed
 * iframe whose default CSP allows inline script and style and nothing external, so
 * there is no stylesheet, no CDN and no image to fetch — only what is in the string.
 *
 * The browser half of the extension (`bridge.js`, vendored from
 * `@modelcontextprotocol/ext-apps` 2.0.4, MIT) is inlined into the same module script
 * as the view's own code. It is published as an ES module whose last statement exports
 * a minified local name, so the export clause is rewritten into a plain `const App`
 * binding the view can use. That is parsed out of the file rather than hard-coded,
 * because the minified name changes with every release of the package.
 */

const BRIDGE = (() => {
  const src = readFileSync(join(process.cwd(), "lib/mcp/ui/bridge.js"), "utf8");
  const m = /export\s*\{([^}]*)\}\s*;?\s*$/.exec(src.trimEnd());
  if (!m) throw new Error("bridge.js: no export clause to rewrite");
  const local = m[1]
    .split(",")
    .map((p) => p.trim().split(/\s+as\s+/))
    .find((p) => (p[1] ?? p[0]) === "App")?.[0];
  if (!local) throw new Error("bridge.js: no App export");
  return `${src.trimEnd().slice(0, m.index)}\nconst App = ${local};\n`;
})();

const CSS = `
*,*::before,*::after{box-sizing:border-box}
:root{
  --ink:#2E2A26;--muted:#837A72;--line:#EFE2D6;--paper:#FFFCF4;--red:#E72025;--rest:#EAE6DF;
  --yellow:#FBE7A1;--yellow-line:#EBD076;
  font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;
}
@media (prefers-color-scheme:dark){
  :root{--ink:#F2EDE6;--muted:#A99F95;--line:#3A3531;--paper:#232120;--rest:#38332F}
  body{background:#1B1917}
}
body{margin:0;padding:16px;color:var(--ink);background:transparent;font-size:14px;line-height:1.45}
h1{font-size:17px;margin:0 0 2px}
.sub{color:var(--muted);font-size:12px;margin:0 0 14px}
.card{background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:14px;margin-bottom:10px}
.row{display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--line)}
.row:last-child{border-bottom:0}
.grow{flex:1;min-width:0}
.name{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.muted{color:var(--muted);font-size:12px}
.big{font-size:26px;font-weight:700;letter-spacing:-0.01em}
.bar{height:8px;border-radius:4px;background:var(--rest);overflow:hidden;margin-top:6px}
.bar>i{display:block;height:100%;background:var(--red)}
.chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.chip{font-size:11px;border:1px solid var(--line);border-radius:999px;padding:3px 9px;color:var(--muted);white-space:nowrap}
.chip.warn{border-color:var(--red);color:var(--red)}
button{
  /* the pill stays pastel yellow in both themes, so its label stays dark ink */
  font:inherit;font-size:12px;font-weight:600;color:#2E2A26;background:var(--yellow);
  border:1px solid var(--yellow-line);border-radius:999px;padding:6px 13px;cursor:pointer;white-space:nowrap
}
button:hover{filter:brightness(1.04)}
button[disabled]{opacity:.5;cursor:default}
button.ghost{background:transparent;border-color:var(--line);color:var(--muted)}
.macros{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:12px}
.empty{color:var(--muted);padding:6px 0}
.head{display:flex;align-items:baseline;gap:8px}
`;

/** `app.ontoolresult` gives the whole CallToolResult; the data rides in its `_meta`. */
const SHARED_JS = `
const app = new App({ name: "DailyBite", version: "1.0.0" });
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const num = (n) => Number(n ?? 0).toLocaleString("en-US");

/** The tool's own JSON, from _meta when the host passes it, else out of the text block. */
function payload(result) {
  const direct = result && result._meta && result._meta["dailybite/data"];
  if (direct) return direct;
  const text = ((result && result.content) || []).filter((c) => c.type === "text").map((c) => c.text).join("\\n");
  const fence = /\`\`\`json\\s*([\\s\\S]*?)\`\`\`/.exec(text);
  if (!fence) return null;
  try { return JSON.parse(fence[1]); } catch { return null; }
}

/** Run a tool on the server and re-render from its answer. */
async function call(name, args, btn) {
  if (btn) { btn.disabled = true; btn.textContent = "…"; }
  try {
    render(payload(await app.callServerTool({ name, arguments: args })));
  } catch (e) {
    const err = $("err");
    if (err) err.textContent = e && e.message ? e.message : "That did not work";
    if (btn) btn.disabled = false;
  }
}
`;

const FOOT = `
app.ontoolresult = (result) => render(payload(result));
app.connect();
`;

function page(title: string, body: string, script: string): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>${title}</title>
<style>${CSS}</style></head>
<body>
${body}
<script type="module">
${BRIDGE}
${SHARED_JS}
${script}
${FOOT}
</script>
</body></html>`;
}

// ---------------------------------------------------------------- the day

const DAY = page(
  "Today",
  `<h1 id="title">Today</h1><p class="sub" id="date"></p>
<div class="card">
  <div class="head"><span class="big" id="kcal">—</span><span class="muted" id="goal"></span></div>
  <div class="bar"><i id="kbar" style="width:0%"></i></div>
  <div class="macros" id="macros"></div>
</div>
<div class="card"><div class="muted" style="margin-bottom:4px">Meals</div><div id="meals"></div></div>
<div class="card" id="spendcard"><div class="muted">Food spend today</div><div class="big" id="spend">—</div><div class="muted" id="budget"></div></div>
<p class="muted" id="err"></p>`,
  `
function macro(label, got, goal, unit) {
  const pct = goal > 0 ? Math.min(100, (got / goal) * 100) : 0;
  return '<div><div class="muted">' + label + '</div><div><strong>' + num(got) + '</strong> <span class="muted">/ ' + num(goal) + unit + '</span></div><div class="bar"><i style="width:' + pct + '%"></i></div></div>';
}

function render(s) {
  if (!s) return;
  $("title").textContent = s.is_today ? "Today" : s.date;
  $("date").textContent = s.date + (s.timezone ? " · " + s.timezone : "");
  $("kcal").textContent = num(s.eaten.kcal) + " kcal";
  $("goal").textContent = "of " + num(s.goals.kcal) + " · " + num(s.remaining_kcal) + " left";
  $("kbar").style.width = Math.min(100, (s.eaten.kcal / Math.max(1, s.goals.kcal)) * 100) + "%";
  $("macros").innerHTML =
    macro("Protein", s.eaten.protein_g, s.goals.protein_g, " g") +
    macro("Carbs", s.eaten.carbs_g, s.goals.carbs_g, " g") +
    macro("Fat", s.eaten.fat_g, s.goals.fat_g, " g");

  // slots is [{ slot, eaten, pending, planned }], in meal order.
  const rows = [];
  for (const group of s.slots || []) {
    const slot = group.slot;
    for (const m of [].concat(group.eaten || [], group.pending || [], group.planned || [])) {
      const pending = m.status === "pending_confirm";
      rows.push(
        '<div class="row"><div class="grow"><div class="name">' + esc(m.name) + '</div>' +
        '<div class="muted">' + slot + (m.kcal ? " · " + num(m.kcal) + " kcal" : "") + (pending ? " · estimate" : "") + '</div></div>' +
        (pending ? '<button data-confirm="' + esc(m.id) + '">Confirm</button>' : '<span class="chip">' + esc(m.status) + '</span>') +
        '</div>'
      );
    }
  }
  $("meals").innerHTML = rows.length ? rows.join("") : '<p class="empty">Nothing logged yet.</p>';
  for (const b of document.querySelectorAll("[data-confirm]")) {
    b.onclick = () => call("confirm_meal", { id: b.getAttribute("data-confirm") }, b);
  }

  $("spend").textContent = num(s.spend_today) + " " + s.budget.currency;
  $("budget").textContent = num(s.budget.spent) + " of " + num(s.budget.budget) + " this month · " + num(s.budget.remaining) + " left";

  const warn = [].concat(s.use_soon || [], []).map((i) => '<span class="chip warn">' + esc(i.name) + ' · use soon</span>');
  if (warn.length) $("spendcard").insertAdjacentHTML("afterend", '<div class="card"><div class="muted">In the fridge</div><div class="chips">' + warn.join("") + '</div></div>');
}
`
);

// ---------------------------------------------------------------- the fridge

const FRIDGE = page(
  "What's in the fridge",
  `<h1>What&rsquo;s in my fridge</h1><p class="sub" id="count"></p><div id="shelves"></div><p class="muted" id="err"></p>`,
  `
const SHELF = { veg_fruit: "Vegetables & fruits", protein: "Proteins", dairy_eggs: "Dairy & eggs", frozen: "Frozen", pantry: "Pantry", other: "Other" };

function render(data) {
  const items = Array.isArray(data) ? data : (data && data.items) || (data && data.fridge) || [];
  $("count").textContent = items.length + (items.length === 1 ? " item" : " items");
  const by = {};
  for (const i of items) (by[i.category] = by[i.category] || []).push(i);

  const out = [];
  for (const key of Object.keys(SHELF)) {
    const list = by[key];
    if (!list || !list.length) continue;
    const rows = list.map((i) => {
      const flag = i.expiry === "expired" ? '<span class="chip warn">expired</span>'
        : i.expiry === "use_soon" ? '<span class="chip warn">' + (i.days_left === 0 ? "today" : i.days_left + "d") + '</span>'
        : i.low ? '<span class="chip">low</span>' : "";
      return '<div class="row"><div class="grow"><div class="name">' + esc(i.name) + '</div>' +
        '<div class="muted">' + num(i.qty) + " " + esc(i.unit) + '</div></div>' + flag +
        '<button data-use="' + esc(i.id) + '">Use 1</button></div>';
    });
    out.push('<div class="card"><div class="muted" style="margin-bottom:4px">' + SHELF[key] + "</div>" + rows.join("") + "</div>");
  }
  $("shelves").innerHTML = out.length ? out.join("") : '<p class="empty">The fridge is empty.</p>';
  for (const b of document.querySelectorAll("[data-use]")) {
    b.onclick = async () => {
      b.disabled = true;
      b.textContent = "…";
      try {
        await app.callServerTool({ name: "use_fridge_item", arguments: { id: b.getAttribute("data-use"), amount: 1 } });
        // use_fridge_item answers with the one item, so the shelf is read again.
        render(payload(await app.callServerTool({ name: "list_fridge", arguments: {} })));
      } catch (e) {
        $("err").textContent = (e && e.message) || "That did not work";
        b.disabled = false;
        b.textContent = "Use 1";
      }
    };
  }
}
`
);

// ---------------------------------------------------------------- one meal

const MEAL = page(
  "Meal",
  `<h1 id="name">Meal</h1><p class="sub" id="meta"></p>
<div class="card"><div class="head"><span class="big" id="kcal">—</span><span class="muted" id="macro"></span></div><div id="items" style="margin-top:8px"></div></div>
<div id="actions" class="chips"></div>
<p class="muted" id="err"></p>`,
  `
function render(m) {
  if (!m) return;
  if (m.meal) m = m.meal;
  $("name").textContent = m.name || "Meal";
  $("meta").textContent = [m.date, m.slot, m.status === "pending_confirm" ? "estimate, not counted yet" : m.status].filter(Boolean).join(" · ");
  $("kcal").textContent = m.kcal == null ? "— kcal" : num(m.kcal) + " kcal";
  $("macro").textContent = ["P " + num(m.protein_g) + " g", "C " + num(m.carbs_g) + " g", "F " + num(m.fat_g) + " g"].join(" · ");
  $("items").innerHTML = (m.items || []).map((i) =>
    '<div class="row"><div class="grow"><div class="name">' + esc(i.name) + '</div><div class="muted">' +
    [i.portion, i.grams ? i.grams + " g" : null].filter(Boolean).join(" · ") + '</div></div>' +
    '<span class="muted">' + (i.kcal == null ? "" : num(i.kcal) + " kcal") + '</span></div>'
  ).join("") || '<p class="empty">No items listed.</p>';

  $("actions").innerHTML = m.status === "pending_confirm"
    ? '<button id="ok">Yes, I ate this</button><button class="ghost" id="no">Delete it</button>'
    : '<span class="chip">' + esc(m.status) + "</span>";
  const ok = $("ok"), no = $("no");
  if (ok) ok.onclick = () => call("confirm_meal", { id: m.id }, ok);
  if (no) no.onclick = async () => {
    no.disabled = true;
    try {
      await app.callServerTool({ name: "delete_meal", arguments: { id: m.id } });
      $("actions").innerHTML = '<span class="chip">deleted</span>';
      $("meta").textContent = "Removed from your journal.";
    } catch (e) {
      $("err").textContent = (e && e.message) || "That did not work";
      no.disabled = false;
    }
  };
}
`
);

export const WIDGETS = [
  { name: "dailybite-day", uri: "ui://dailybite/day.html", html: DAY },
  { name: "dailybite-fridge", uri: "ui://dailybite/fridge.html", html: FRIDGE },
  { name: "dailybite-meal", uri: "ui://dailybite/meal.html", html: MEAL }
] as const;

export const UI = {
  day: "ui://dailybite/day.html",
  fridge: "ui://dailybite/fridge.html",
  meal: "ui://dailybite/meal.html"
} as const;
