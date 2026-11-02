import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import StatusBadge from "../../components/StatusBadge";
import ConfirmationModal from "../../components/ConfirmationModal";
import Pagination from "../../components/Pagination";
import LoadingSpinner from "../../components/LoadingSpinner";
import ErrorState from "../../components/ErrorState";
import EmptyState from "../../components/EmptyState";
import SearchBar from "../../components/SearchBar";
import useApi from "../../hooks/useApi";
import { useToast } from "../../context/ToastContext";
import { projectService } from "../../services/projectService";
import { toApiError } from "../../services/apiClient";
import { PROJECT_STATUS, formatDate } from "../../utils/format";

// Builds the request body the API expects from a project returned by the API.
export const projectToPayload = (p) => ({
  title: p.title, short_description: p.short_description, full_description: p.full_description, research_objectives: p.research_objectives,
  domain: p.domain, institution: p.institution, supervisor: p.supervisor, required_skills: p.required_skills, eligibility: p.eligibility,
  duration: p.duration, available_positions: p.available_positions, application_deadline: p.application_deadline,
  application_instructions: p.application_instructions, status: p.status, is_sample: p.is_sample,
});

export default function AdminProjects() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, parseInt(params.get("page") || "1", 10) || 1);
  const q = params.get("q") || "";
  const status = params.get("status") || "";
  const [pending, setPending] = useState(null); // { kind: "archive" | "delete", project }
  const [busy, setBusy] = useState(false);
  const { data, loading, error, retry } = useApi(
    () => projectService.list({ include_archived: true, q: q || undefined, status: status || undefined, page, page_size: 12, sort: "newest" }),
    [params.toString()],
  );

  const set = (changes) => setParams((cur) => { const n = new URLSearchParams(cur); Object.entries(changes).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k))); if (!("page" in changes)) n.delete("page"); return n; }, { replace: true });

  async function confirm() {
    setBusy(true);
    try {
      if (pending.kind === "delete") await projectService.remove(pending.project.id);
      else await projectService.update(pending.project.id, { ...projectToPayload(pending.project), status: "archived" });
      toast.success(pending.kind === "delete" ? "Project deleted." : "Project archived.");
      setPending(null);
      retry();
    } catch (err) {
      toast.error(toApiError(err).message);
      setPending(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <header className="page-header" style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-4)", flexWrap: "wrap", alignItems: "end" }}>
        <div><p className="eyebrow">Administration</p><h1>Research projects</h1></div>
        <Link to="/admin/projects/new" className="btn btn-primary"><Plus size={16} aria-hidden="true" /> New project</Link>
      </header>
      <div className="toolbar">
        <div className="grow"><SearchBar value={q} onSearch={(t) => set({ q: t })} placeholder="Search projects" label="Search projects" /></div>
        <div className="field">
          <label htmlFor="pstatus">Status</label>
          <select id="pstatus" className="input" value={status} onChange={(e) => set({ status: e.target.value })}>
            <option value="">All (including archived)</option>
            {Object.entries(PROJECT_STATUS).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {loading && <LoadingSpinner />}
      {error && <ErrorState error={error} onRetry={retry} />}
      {data && data.items.length === 0 && <EmptyState title="No projects found" message="Create the first project to publish it on the Explore page." />}
      {data && data.items.length > 0 && (
        <>
          <div className="table-wrap card">
            <table className="table">
              <caption className="sr-only">Research projects</caption>
              <thead><tr><th scope="col">Title</th><th scope="col">Domain</th><th scope="col">Deadline</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead>
              <tbody>
                {data.items.map((p) => (
                  <tr key={p.id}>
                    <th scope="row"><Link to={`/projects/${p.id}`}>{p.title}</Link><br /><span className="muted small">{p.institution}</span></th>
                    <td data-label="Domain">{p.domain}</td>
                    <td data-label="Deadline">{formatDate(p.application_deadline)}</td>
                    <td data-label="Status"><StatusBadge status={p.status} /></td>
                    <td><div className="actions">
                      <Link to={`/admin/projects/${p.id}/edit`} className="btn btn-secondary btn-sm">Edit</Link>
                      {p.status !== "archived" && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPending({ kind: "archive", project: p })}>Archive</button>}
                      <button type="button" className="btn btn-ghost btn-sm" style={{ color: "var(--error)" }} onClick={() => setPending({ kind: "delete", project: p })}>Delete</button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} totalPages={data.total_pages} onChange={(p) => set({ page: p === 1 ? "" : String(p) })} />
        </>
      )}

      <ConfirmationModal
        open={Boolean(pending)} danger={pending?.kind === "delete"} busy={busy}
        title={pending?.kind === "delete" ? "Delete this project?" : "Archive this project?"}
        message={pending?.kind === "delete"
          ? `"${pending?.project.title}" will be permanently removed. Projects that have applications cannot be deleted; archive those instead.`
          : `"${pending?.project.title}" will be hidden from the public site. Applications and history are kept.`}
        confirmLabel={pending?.kind === "delete" ? "Delete" : "Archive"}
        onConfirm={confirm} onCancel={() => setPending(null)}
      />
    </div>
  );
}
