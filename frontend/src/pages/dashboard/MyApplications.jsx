import { Link } from "react-router-dom";
import StatusBadge from "../../components/StatusBadge";
import LoadingSpinner from "../../components/LoadingSpinner";
import ErrorState from "../../components/ErrorState";
import EmptyState from "../../components/EmptyState";
import useApi from "../../hooks/useApi";
import { applicationService } from "../../services/applicationService";
import { formatDate } from "../../utils/format";

export default function MyApplications() {
  const { data, loading, error, retry } = useApi(() => applicationService.mine(), []);
  return (
    <div className="stack">
      <header className="page-header">
        <p className="eyebrow">My applications</p>
        <h1>Your application history</h1>
      </header>
      {loading && <LoadingSpinner label="Loading applications..." />}
      {error && <ErrorState error={error} onRetry={retry} />}
      {data && data.length === 0 && (
        <EmptyState title="You have not applied yet" message="When you apply to a project it appears here, with its current status." action={<Link to="/explore" className="btn btn-primary" style={{ marginTop: "var(--space-4)" }}>Find a project</Link>} />
      )}
      {data && data.length > 0 && (
        <div className="table-wrap card">
          <table className="table">
            <caption className="sr-only">Your applications</caption>
            <thead><tr><th scope="col">Project</th><th scope="col">Institution</th><th scope="col">Submitted</th><th scope="col">Status</th><th scope="col">Last updated</th></tr></thead>
            <tbody>
              {data.map((a) => (
                <tr key={a.id}>
                  <th scope="row"><Link to={`/projects/${a.project_id}`}>{a.project_title}</Link></th>
                  <td data-label="Institution">{a.project_institution}</td>
                  <td data-label="Submitted">{formatDate(a.submitted_at)}</td>
                  <td data-label="Status"><StatusBadge status={a.status} kind="application" /></td>
                  <td data-label="Last updated">{formatDate(a.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
