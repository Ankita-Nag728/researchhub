import { Link } from "react-router-dom";

// Shared frame for the four authentication pages.
export default function AuthShell({ title, intro, children, footer }) {
  return (
    <section className="auth-wrap">
      <div className="auth-card card">
        <p className="eyebrow">ResearchHub</p>
        <h1>{title}</h1>
        {intro && <p className="muted">{intro}</p>}
        {children}
        {footer && <p className="auth-footer">{footer}</p>}
      </div>
      <p className="muted auth-note">
        <Link to="/">Back to home</Link>
      </p>
    </section>
  );
}

export function FormBanner({ message, tone = "error" }) {
  if (!message) return null;
  return (
    <div className={`banner banner-${tone}`} role={tone === "error" ? "alert" : "status"}>
      {message}
    </div>
  );
}
