import { NavLink } from "react-router-dom";
import { LayoutDashboard, Compass, FileText, Bookmark, BookOpen, UserRound, LogOut } from "lucide-react";
import Logo from "./Logo";

const ITEMS = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/explore", label: "Explore Research", icon: Compass },
  { to: "/dashboard/applications", label: "My Applications", icon: FileText },
  { to: "/dashboard/saved", label: "Saved Projects", icon: Bookmark },
  { to: "/papers", label: "Research Papers", icon: BookOpen },
  { to: "/dashboard/profile", label: "My Profile", icon: UserRound },
];

// `items` can be overridden (the admin area reuses this component).
export default function Sidebar({ items = ITEMS, open = false, onNavigate, onLogout, label = "Dashboard" }) {
  return (
    <aside className={`sidebar ${open ? "open" : ""}`} aria-label={label}>
      <Logo />
      <nav aria-label={`${label} navigation`}>
        <ul className="sidebar-nav">
          {items.map(({ to, label: text, icon: Icon, end }) => (
            <li key={to}>
              <NavLink to={to} end={end} onClick={onNavigate} className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}>
                <Icon size={18} aria-hidden="true" />
                {text}
              </NavLink>
            </li>
          ))}
          <li>
            <button type="button" className="sidebar-btn" onClick={onLogout}>
              <LogOut size={18} aria-hidden="true" />
              Logout
            </button>
          </li>
        </ul>
      </nav>
    </aside>
  );
}
