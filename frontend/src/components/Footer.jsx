import { Link } from "react-router-dom";
import Logo from "./Logo";

// Social links are configured in one place. Empty URLs are not rendered,
// so we never ship links that go nowhere.
const SOCIAL_LINKS = [
  // { label: "GitHub", href: "https://github.com/your-org" },
];

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <Logo />
            <p className="muted" style={{ marginTop: "var(--space-3)", maxWidth: "36ch", fontSize: "var(--text-sm)" }}>
              A home for academic research opportunities, publications and the people who pursue them.
            </p>
          </div>
          <div>
            <h4>Explore</h4>
            <ul>
              <li><Link to="/explore">Research projects</Link></li>
              <li><Link to="/papers">Research papers</Link></li>
              <li><Link to="/about">About</Link></li>
              <li><Link to="/contact">Contact</Link></li>
            </ul>
          </div>
          <div>
            <h4>Legal</h4>
            <ul>
              <li><Link to="/privacy">Privacy Policy</Link></li>
              <li><Link to="/terms">Terms of Service</Link></li>
              {SOCIAL_LINKS.map((s) => (
                <li key={s.label}>
                  <a href={s.href} target="_blank" rel="noopener noreferrer">{s.label}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          &copy; {new Date().getFullYear()} ResearchHub. Demonstration data is labelled as sample data.
        </div>
      </div>
    </footer>
  );
}
