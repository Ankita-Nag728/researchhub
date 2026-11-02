import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Menu, X } from "lucide-react";
import Logo from "./Logo";
import { useAuth } from "../context/AuthContext";

const LINKS = [
  { to: "/", label: "Home", end: true },
  { to: "/explore", label: "Explore Research" },
  { to: "/papers", label: "Research Papers" },
  { to: "/about", label: "About" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { isAuthenticated, isAdmin } = useAuth();
  const close = () => setOpen(false);

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <Logo />
        <button
          type="button"
          className="nav-toggle"
          aria-expanded={open}
          aria-controls="main-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
        </button>

        <nav id="main-nav" className={`nav-panel ${open ? "open" : ""}`} aria-label="Main">
          <ul className="nav-links">
            {LINKS.map((l) => (
              <li key={l.to}>
                <NavLink to={l.to} end={l.end} onClick={close} className={({ isActive }) => (isActive ? "active" : "")}>
                  {l.label}
                </NavLink>
              </li>
            ))}
          </ul>
          <div className="nav-actions">
            {isAuthenticated ? (
              <Link to={isAdmin ? "/admin" : "/dashboard"} className="btn btn-primary btn-sm" onClick={close}>
                {isAdmin ? "Admin" : "Dashboard"}
              </Link>
            ) : (
              <>
                <Link to="/login" className="btn btn-ghost btn-sm" onClick={close}>
                  Login
                </Link>
                <Link to="/register" className="btn btn-primary btn-sm" onClick={close}>
                  Get Started
                </Link>
              </>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
