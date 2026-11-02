import { Link } from "react-router-dom";
import { Bookmark, CheckCircle2, Clock, FileText, XCircle } from "lucide-react";
import ProjectCard from "../../components/ProjectCard";
import StatusBadge from "../../components/StatusBadge";
import LoadingSpinner from "../../components/LoadingSpinner";
import ErrorState from "../../components/ErrorState";
import EmptyState from "../../components/EmptyState";
import useApi from "../../hooks/useApi";
import { useAuth } from "../../context/AuthContext";
import { useBookmarks } from "../../context/BookmarksContext";
import { applicationService } from "../../services/applicationService";
import { projectService } from "../../services/projectService";
import { formatDate } from "../../utils/format";
import { getRecentProjectIds } from "../../utils/recent";

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="card stat">
      <Icon size={20} aria-hidden="true" />
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

export default function Overview() {
  const { user } = useAuth();
  const { saved, findProject, toggleProject } = useBookmarks();
  const apps = useApi(() => applicationService.mine(), []);
  // Recently viewed projects are remembered in this browser; fetch their current details.
  const recent = useApi(async () => {
    const found = await Promise.all(getRecentProjectIds().map((id) => projectService.get(id).catch(() => null)));
    return found.filter(Boolean);
  }, []);

  if (apps.loading) return <LoadingSpinner label="Loading your dashboard..." />;
  if (apps.error) return <ErrorState error={apps.error} onRetry={apps.retry} />;

  const list = apps.data;
  const count = (...statuses) => list.filter((a) => statuses.includes(a.status)).length;

  // Recent activity is built from real records: applications and saved projects.
  const activity = [
    ...list.flatMap((a) => {
      const events = [{ when: a.submitted_at, text: `You applied to ${a.project_title}`, key: `a${a.id}` }];
      if (a.updated_at !== a.submitted_at && a.status !== "submitted") {
        events.push({ when: a.updated_at, text: `${a.project_title} is now ${a.status.replace("_", " ")}`, key: `u${a.id}` });
      }
      return events;
    }),
    ...saved.projects.map((b) => ({ when: b.created_at, text: `You saved ${b.project.title}`, key: `b${b.bookmark_id}` })),
  ].sort((x, y) => new Date(y.when) - new Date(x.when)).slice(0, 6);

  return (
    <div className="stack">
      <header className="page-header">
        <p className="eyebrow">Overview</p>
        <h1>Welcome, {user.full_name.split(" ")[0]}</h1>
      </header>

      {user.profile_completion < 100 && (
        <div className="card completion">
          <div className="completion-top">
            <b>Profile {user.profile_completion}% complete</b>
            <Link to="/dashboard/profile">Finish your profile</Link>
          </div>
          <div className="progress" role="progressbar" aria-valuenow={user.profile_completion} aria-valuemin={0} aria-valuemax={100} aria-label="Profile completion">
            <span style={{ width: `${user.profile_completion}%` }} />
          </div>
        </div>
      )}

      <div className="stats-grid">
        <Stat icon={FileText} label="Total applications" value={list.length} />
        <Stat icon={Clock} label="Pending" value={count("submitted", "under_review", "shortlisted")} />
        <Stat icon={CheckCircle2} label="Accepted" value={count("accepted")} />
        <Stat icon={XCircle} label="Rejected" value={count("rejected")} />
        <Stat icon={Bookmark} label="Saved projects" value={saved.projects.length} />
      </div>

      <section aria-labelledby="recent-title">
        <h2 id="recent-title">Recently explored</h2>
        {recent.data?.length ? (
          <div className="grid-cards">
            {recent.data.map((p) => <ProjectCard key={p.id} project={p} bookmarked={Boolean(findProject(p.id))} onToggleBookmark={toggleProject} />)}
          </div>
        ) : (
          <EmptyState title="Nothing explored yet" message="Projects you open will show up here so you can find your way back." action={<Link to="/explore" className="btn btn-primary" style={{ marginTop: "var(--space-4)" }}>Explore research</Link>} />
        )}
      </section>

      <section aria-labelledby="activity-title">
        <h2 id="activity-title">Recent activity</h2>
        {activity.length ? (
          <ul className="activity card">
            {activity.map((e) => (
              <li key={e.key}><span>{e.text}</span><time dateTime={e.when} className="muted">{formatDate(e.when)}</time></li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No activity yet" message="Apply to a project or save one, and your activity will appear here." />
        )}
      </section>

      {list.length > 0 && (
        <section aria-labelledby="latest-title">
          <h2 id="latest-title">Latest application</h2>
          <div className="card activity-latest">
            <div><b>{list[0].project_title}</b><br /><span className="muted">{list[0].project_institution}</span></div>
            <StatusBadge status={list[0].status} kind="application" />
          </div>
        </section>
      )}
    </div>
  );
}
