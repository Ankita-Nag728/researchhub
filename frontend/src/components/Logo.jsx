import { Link } from "react-router-dom";

// Wordmark: a burgundy tile with an "R" and a small line-art sprig.
export default function Logo({ to = "/" }) {
  return (
    <Link to={to} className="brand" aria-label="ResearchHub home">
      <svg className="brand-mark" viewBox="0 0 34 34" aria-hidden="true">
        <rect width="34" height="34" rx="9" fill="#743C53" />
        <path
          d="M11 25V9h6.6c2.8 0 4.5 1.5 4.5 4 0 2-1.2 3.4-3.1 3.9L23 25h-2.8l-3.4-6.8H13.6V25H11zm2.6-9.2h3.8c1.3 0 2-.7 2-1.9s-.7-1.9-2-1.9h-3.8v3.8z"
          fill="#FFF1F3"
        />
        <path d="M25 8c-2 .4-3.4 1.6-4 3.4M25 8c.2 2-.6 3.5-2.2 4.4" stroke="#D987A2" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      </svg>
      <span className="brand-word">ResearchHub</span>
    </Link>
  );
}
