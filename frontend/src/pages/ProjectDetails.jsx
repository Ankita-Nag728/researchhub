import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Bookmark, Building2, CalendarClock, Clock, GraduationCap, Users } from "lucide-react";
import StatusBadge from "../components/StatusBadge";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorState from "../components/ErrorState";
import useApi from "../hooks/useApi";
import { useAuth } from "../context/AuthContext";
import { useBookmarks } from "../context/BookmarksContext";
import { projectService } from "../services/projectService";
import { applicationService } from "../services/applicationService";
import { formatDate, isDeadlinePassed } from "../utils/format";
import { rememberProject } from "../utils/recent";

function Section({ title, children }) {
  return (
    <section className="detail-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

const Paragraphs = ({ text }) => text.split(/\n{2,}/).map((p, i) => <p key={i} style={{ whiteSpace: "pre-line" }}>{p}</p>);

export default function ProjectDetails() {
  const { id } = useParams();
  const { isAuthenticated } = useAuth();
  const { findProject, toggleProject } = useBookmarks();
  const { data: project, loading, error, retry } = useApi(() => projectService.get(id), [id]);
  const mine = useApi(() => (isAuthenticated ? applicationService.mine() : Promise.resolve([])), [isAuthenticated]);

  useEffect(() => {
    if (project) rememberProject(project.id);
  }, [project]);

  if (loading) return <LoadingSpinner label="Loading project..." />;
  if (error) {
    return (
      <div className="container" style={{ paddingBlock: "var(--space-7)" }}>
        <ErrorState error={error.status === 404 ? { message: "This project does not exist or is no longer available." } : error}
          onRetry={error.status === 404 ? undefined : retry} title={error.status === 404 ? "Project not found" : "We could not load this project"} />
      </div>
    );
  }

  const applied = (mine.data || []).find((a) => a.project_id === project.id);
  const passed = isDeadlinePassed(project.application_deadline);
  const closedReason =
    project.status !== "open" ? "This project is not open for applications." : passed ? "The application deadline has passed." : "";
  const saved = findProject(project.id);

  return (
    <div className="container detail-page">
      <Link to="/explore" className="back-link"><ArrowLeft size={16} aria-hidden="true" /> All projects</Link>

      <header className="detail-header">
        <div className="detail-badges">
          <span className="tag">{project.domain}</span>
          <StatusBadge status={project.status} kind="project" />
          {project.is_sample && <span className="tag">Sample data</span>}
        </div>
        <h1>{project.title}</h1>
        <p className="muted lead">{project.short_description}</p>
      </header>

      <div className="detail-grid">
        <article>
          <Section title="About this project"><Paragraphs text={project.full_description} /></Section>
          <Section title="Research objectives"><Paragraphs text={project.research_objectives} /></Section>
          <Section title="Required skills">
            {project.required_skills.length ? (
              <ul className="chips">{project.required_skills.map((s) => <li key={s} className="tag">{s}</li>)}</ul>
            ) : <p className="muted">No specific skills listed.</p>}
          </Section>
          <Section title="Eligibility"><Paragraphs text={project.eligibility} /></Section>
          <Section title="How to apply">
            <Paragraphs text={project.application_instructions || "Use the Apply Now button to complete the application form."} />
          </Section>
        </article>

        <aside className="card detail-aside" aria-label="Project summary">
          <ul className="facts">
            <li><Building2 size={18} aria-hidden="true" /><span><b>Institution</b>{project.institution}</span></li>
            <li><GraduationCap size={18} aria-hidden="true" /><span><b>Supervisor</b>{project.supervisor}</span></li>
            <li><Clock size={18} aria-hidden="true" /><span><b>Duration</b>{project.duration}</span></li>
            <li><Users size={18} aria-hidden="true" /><span><b>Available positions</b>{project.available_positions}</span></li>
            <li><CalendarClock size={18} aria-hidden="true" /><span><b>Application deadline</b>{formatDate(project.application_deadline)}</span></li>
          </ul>

          {applied ? (
            <>
              <div className="banner banner-success">You applied on {formatDate(applied.submitted_at)}. Status: <b>{applied.status.replace("_", " ")}</b></div>
              <Link to="/dashboard/applications" className="btn btn-secondary btn-block">View my applications</Link>
            </>
          ) : closedReason ? (
            <div className="banner banner-warning">{closedReason}</div>
          ) : (
            // Logged-out visitors are sent to login first; ProtectedRoute remembers this page.
            <Link to={`/projects/${project.id}/apply`} className="btn btn-primary btn-block">Apply Now</Link>
          )}

          {isAuthenticated && (
            <button type="button" className="btn btn-ghost btn-block" aria-pressed={Boolean(saved)} onClick={() => toggleProject(project)}>
              <Bookmark size={18} aria-hidden="true" fill={saved ? "currentColor" : "none"} /> {saved ? "Saved" : "Save project"}
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}
