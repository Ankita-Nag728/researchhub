import { Link } from "react-router-dom";
import { Building2, CalendarClock, GraduationCap, ArrowRight, Bookmark } from "lucide-react";
import StatusBadge from "./StatusBadge";
import { formatDate } from "../utils/format";

// Shows one research project. All data comes from the API (no hardcoded values).
// `onToggleBookmark` is optional: pass it only for logged-in students.
export default function ProjectCard({ project, bookmarked = false, onToggleBookmark }) {
  const href = `/projects/${project.id}`;
  return (
    <article className="card card-interactive project-card">
      <div className="card-top">
        <span className="tag">{project.domain}</span>
        <StatusBadge status={project.status} kind="project" />
      </div>
      <h3>
        <Link to={href}>{project.title}</Link>
      </h3>
      <p className="muted" style={{ margin: 0, fontSize: "var(--text-sm)" }}>{project.short_description}</p>
      <ul className="meta">
        <li><Building2 size={16} aria-hidden="true" /> {project.institution}</li>
        <li><GraduationCap size={16} aria-hidden="true" /> {project.supervisor}</li>
        <li><CalendarClock size={16} aria-hidden="true" /> Deadline: {formatDate(project.application_deadline)}</li>
      </ul>
      <div className="card-actions">
        <Link to={href} className="btn btn-secondary btn-sm">
          View Details <ArrowRight size={16} aria-hidden="true" />
        </Link>
        {onToggleBookmark && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            aria-pressed={bookmarked}
            aria-label={bookmarked ? `Remove ${project.title} from saved projects` : `Save ${project.title}`}
            onClick={() => onToggleBookmark(project)}
          >
            <Bookmark size={18} aria-hidden="true" fill={bookmarked ? "currentColor" : "none"} />
          </button>
        )}
      </div>
    </article>
  );
}
