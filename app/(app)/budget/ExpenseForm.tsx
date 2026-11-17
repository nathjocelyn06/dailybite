"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addExpenseAction, updateExpenseAction } from "../actions";

export type EditableExpense = {
  id: string;
  merchant: string;
  amount: number;
  category: string;
  date: string;
};

/** Add a new expense, or edit an existing one when `expense` is passed (Budget › History › Edit). */
export function ExpenseForm({ expense }: { expense?: EditableExpense }) {
  const router = useRouter();
  const editing = !!expense;
  const blank = { merchant: "", amount: "", category: "daily_food", date: "" };
  const [f, setF] = useState(
    expense
      ? { merchant: expense.merchant, amount: String(expense.amount), category: expense.category, date: expense.date }
      : blank
  );
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.merchant.trim()) return setErr("Enter where you spent it.");
    if (f.amount === "" || !(Number(f.amount) >= 0)) return setErr("Enter an amount.");
    setErr("");
    setMsg("");
    start(async () => {
      try {
        if (expense) {
          await updateExpenseAction(expense.id, {
            merchant: f.merchant.trim(),
            amount: Number(f.amount),
            category: f.category,
            date: f.date || expense.date
          });
          setMsg("Saved.");
          router.push("/budget");
        } else {
          await addExpenseAction({
            merchant: f.merchant.trim(),
            amount: Number(f.amount),
            category: f.category,
            items: [],
            ...(f.date ? { date: f.date } : {})
          });
          setF(blank);
          setMsg("Added.");
        }
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Could not save");
      }
    });
  };

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <label className="field">Merchant
        <input className="input" value={f.merchant} onChange={(e) => { setF({ ...f, merchant: e.target.value }); setErr(""); }} />
      </label>
      <label className="field">Amount
        <input className="input" inputMode="decimal" value={f.amount} onChange={(e) => { setF({ ...f, amount: e.target.value }); setErr(""); }} />
      </label>
      <label className="field">Category
        <select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
          <option value="daily_food">Daily food</option>
          <option value="groceries">Groceries</option>
          <option value="snacks_drinks">Snacks &amp; drinks</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label className="field">{editing ? "Date" : "Date (default today)"}
        <input className="input" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
      </label>
      {err && <p style={{ color: "#a32d2d", fontSize: 13 }} role="alert">{err}</p>}
      {msg && <p className="muted" role="status" style={{ fontSize: 13 }}>{msg}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn pri" disabled={pending}>{pending ? "Saving…" : editing ? "Save changes" : "Save expense"}</button>
        {editing && (
          <button type="button" className="btn" disabled={pending} onClick={() => router.push("/budget")}>Cancel</button>
        )}
      </div>
    </form>
  );
}
