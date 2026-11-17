"use client";
import { useState, useTransition } from "react";
import { addFridgeAction, addShoppingAction } from "../actions";

export function AddFridgeForm() {
  const [f, setF] = useState({ name: "", category: "veg_fruit", qty: "1", unit: "pcs", expires_in_days: "" });
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.name.trim()) return setErr("Enter a name.");
    if (!(Number(f.qty) > 0)) return setErr("Quantity must be more than 0.");
    setErr("");
    start(async () => {
      await addFridgeAction({
        name: f.name.trim(),
        category: f.category,
        qty: Number(f.qty),
        unit: f.unit || "pcs",
        ...(f.expires_in_days ? { expires_in_days: Number(f.expires_in_days) } : {})
      });
      setF({ ...f, name: "", qty: "1", expires_in_days: "" });
    });
  };
  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <label className="field">Name<input className="input" value={f.name} onChange={(e) => { setF({ ...f, name: e.target.value }); setErr(""); }} /></label>
      <label className="field">Shelf
        <select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
          <option value="veg_fruit">Vegetables & fruits</option><option value="protein">Proteins</option><option value="dairy_eggs">Dairy & eggs</option>
          <option value="frozen">Frozen</option><option value="pantry">Pantry</option><option value="other">Other</option>
        </select>
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <label className="field" style={{ flex: 1 }}>Qty<input className="input" inputMode="decimal" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} /></label>
        <label className="field" style={{ flex: 1 }}>Unit<input className="input" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} /></label>
        <label className="field" style={{ flex: 1 }}>Expires in (days)<input className="input" inputMode="numeric" value={f.expires_in_days} onChange={(e) => setF({ ...f, expires_in_days: e.target.value })} /></label>
      </div>
      {err && <p style={{ color: "#a32d2d", fontSize: 13 }}>{err}</p>}
      <button className="btn pri" disabled={pending}>{pending ? "Adding…" : "Add to fridge"}</button>
    </form>
  );
}

export function AddShoppingForm() {
  const [name, setName] = useState("");
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setErr("Enter an item.");
    setErr("");
    start(async () => {
      await addShoppingAction({ name: name.trim(), qty: Number(qty) || 1, ...(price ? { est_price: Number(price) } : {}), reason: "manual" });
      setName("");
      setPrice("");
    });
  };
  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <label className="field">Item<input className="input" value={name} onChange={(e) => { setName(e.target.value); setErr(""); }} /></label>
      <div style={{ display: "flex", gap: 8 }}>
        <label className="field" style={{ flex: 1 }}>Qty<input className="input" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} /></label>
        <label className="field" style={{ flex: 1 }}>Est. price<input className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></label>
      </div>
      {err && <p style={{ color: "#a32d2d", fontSize: 13 }}>{err}</p>}
      <button className="btn" disabled={pending}>{pending ? "Adding…" : "Add"}</button>
    </form>
  );
}
