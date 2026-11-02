import { Link } from "react-router-dom";
import { BookOpen, FileText, FlaskConical, Hourglass, Users } from "lucide-react";
import LoadingSpinner from "../../components/LoadingSpinner";
import ErrorState from "../../components/ErrorState";
import useApi from "../../hooks/useApi";
import { adminService } from "../../services/applicationService";

const TILES = [
  { key: "users", label: "Registered users", icon: Users, to: "/admin/users" },
  { key: "projects", label: "Research projects", icon: FlaskConical, to: "/admin/projects" },
  { key: "papers", label: "Research papers", icon: BookOpen, to: "/admin/papers" },
  { key: "applications", label: "Applications", icon: FileText, to: "/admin/applications" },
  { key: "pending_applications", label: "Pending applications", icon: Hourglass, to: "/admin/applications?status=submitted" },
];

export default function AdminOverview() {
  const { data, loading, error, retry } = useApi(() => adminService.stats(), []);
  return (
    <div className="stack">
      <header className="page-header"><p className="eyebrow">Administration</p><h1>Platform overview</h1></header>
      {loading && <LoadingSpinner />}
      {error && <ErrorState error={error} onRetry={retry} />}
      {data && (
        <div className="stats-grid">
          {TILES.map(({ key, label, icon: Icon, to }) => (
            <Link key={key} to={to} className="card card-interactive stat" style={{ textDecoration: "none", color: "inherit" }}>
              <Icon size={20} aria-hidden="true" />
              <span className="stat-value">{data[key]}</span>
              <span className="stat-label">{label}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
