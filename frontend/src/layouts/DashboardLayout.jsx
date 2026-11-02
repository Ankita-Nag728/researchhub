import { useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import Sidebar from "../components/Sidebar";
import Logo from "../components/Logo";
import { useAuth } from "../context/AuthContext";

// Shared shell for the student dashboard. On small screens the sidebar
// slides in from the left and is opened with the menu button.
export default function DashboardLayout({ items, label }) {
  const [open, setOpen] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    // Leave the protected area FIRST. If we cleared the user first, the protected
    // route would bounce us to /login remembering "go back to the dashboard".
    navigate("/", { replace: true });
    await logout();
  }

  return (
    <div className="layout-dashboard">
      <a href="#main" className="skip-link">Skip to main content</a>
      <Sidebar items={items} label={label} open={open} onNavigate={() => setOpen(false)} onLogout={handleLogout} />
      <div>
        <div className="dashboard-topbar">
          <Logo />
          <button
            type="button"
            className="nav-toggle"
            style={{ display: "inline-flex" }}
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
          </button>
        </div>
        <main id="main" className="dashboard-main" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
