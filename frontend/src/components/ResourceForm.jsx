import { useState } from "react";
import { Link } from "react-router-dom";
import FormInput from "./FormInput";
import { FormBanner } from "../pages/auth/AuthShell";
import { toApiError } from "../services/apiClient";
import { splitList, validateUrl } from "../utils/validation";

// Config-driven form for admin create/edit pages (projects and papers).
// field: { name, label, type: text|textarea|select|number|datetime|list|url, required, options, hint, full, rows, maxLength, min, max }

const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function initialValues(fields, initial) {
  return Object.fromEntries(fields.map((f) => {
    const v = initial?.[f.name];
    if (f.type === "list") return [f.name, (v || []).join(", ")];
    if (f.type === "datetime") return [f.name, toLocalInput(v)];
    return [f.name, v ?? (f.default ?? "")];
  }));
}

function toPayload(fields, values) {
  return Object.fromEntries(fields.map((f) => {
    const raw = values[f.name];
    if (f.type === "list") return [f.name, splitList(raw)];
    if (f.type === "datetime") return [f.name, raw ? new Date(raw).toISOString() : null];
    if (f.type === "number") return [f.name, raw === "" ? null : Number(raw)];
    if (typeof raw === "string") return [f.name, f.required ? raw.trim() : raw.trim() || null];
    return [f.name, raw];
  }));
}

export default function ResourceForm({ fields, initial, onSubmit, submitLabel, cancelTo }) {
  const [values, setValues] = useState(() => initialValues(fields, initial));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const found = {};
    fields.forEach((f) => {
      const raw = String(values[f.name] ?? "").trim();
      if (f.required && !raw) found[f.name] = `${f.label} is required.`;
      else if (f.type === "url" && validateUrl(raw)) found[f.name] = validateUrl(raw);
    });
    setErrors(found);
    setFormError("");
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      await onSubmit(toPayload(fields, values));
    } catch (err) {
      const apiError = toApiError(err);
      setErrors(apiError.fieldErrors || {});
      setFormError(apiError.message);
      setBusy(false);
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit} noValidate>
      <FormBanner message={formError} />
      <div className="form-grid">
        {fields.map((f) => {
          const common = {
            key: f.name, label: f.label, value: values[f.name], required: f.required, hint: f.hint, error: errors[f.name], maxLength: f.maxLength,
            onChange: (e) => setValues((v) => ({ ...v, [f.name]: e.target.value })),
          };
          const wrap = (node) => <div key={f.name} className={f.full || f.type === "textarea" ? "full" : ""}>{node}</div>;
          if (f.type === "textarea") return wrap(<FormInput {...common} as="textarea" rows={f.rows || 4} />);
          if (f.type === "select") return wrap(<FormInput {...common} as="select">{f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</FormInput>);
          const typeMap = { number: "number", datetime: "datetime-local", url: "url", text: "text", list: "text" };
          return wrap(<FormInput {...common} type={typeMap[f.type] || "text"} min={f.min} max={f.max} />);
        })}
      </div>
      <div style={{ display: "flex", gap: "var(--space-3)" }}>
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Saving..." : submitLabel}</button>
        <Link to={cancelTo} className="btn btn-secondary">Cancel</Link>
      </div>
    </form>
  );
}
