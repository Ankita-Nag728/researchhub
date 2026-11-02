import { X } from "lucide-react";

// Config-driven filter row. `filters` is an array of:
//   { name, label, type: "select" | "date", options?: [{ value, label }] }
// `values` is an object keyed by filter name; `onChange(name, value)` updates one.
export default function FilterPanel({ filters, values, onChange, onClear }) {
  const hasActive = filters.some((f) => values[f.name]);
  return (
    <div className="filter-panel" role="group" aria-label="Filters">
      {filters.map((f) => (
        <div className="field" key={f.name}>
          <label htmlFor={`filter-${f.name}`}>{f.label}</label>
          {f.type === "date" ? (
            <input
              id={`filter-${f.name}`}
              type="date"
              className="input"
              value={values[f.name] || ""}
              onChange={(e) => onChange(f.name, e.target.value)}
            />
          ) : (
            <select
              id={`filter-${f.name}`}
              className="input"
              value={values[f.name] || ""}
              onChange={(e) => onChange(f.name, e.target.value)}
            >
              <option value="">All</option>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          )}
        </div>
      ))}
      {hasActive && (
        <button type="button" className="btn btn-ghost" onClick={onClear}>
          <X size={16} aria-hidden="true" /> Clear all filters
        </button>
      )}
    </div>
  );
}
