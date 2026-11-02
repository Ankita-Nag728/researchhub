import { useId } from "react";

// Label + control + hint + error, wired together for screen readers.
// `as` can be "input" (default), "textarea" or "select".
export default function FormInput({ label, error, hint, as = "input", children, className = "", ...props }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  const Control = as;

  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {props.required && <span aria-hidden="true"> *</span>}
      </label>
      <Control
        id={id}
        className={`input ${className}`}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={describedBy}
        {...props}
      >
        {children}
      </Control>
      {hint && <span id={hintId} className="hint">{hint}</span>}
      {error && (
        <span id={errorId} className="error-text" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
