import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import StatusBadge from "../../components/StatusBadge";
import Pagination from "../../components/Pagination";
import LoadingSpinner from "../../components/LoadingSpinner";
import ErrorState from "../../components/ErrorState";
import EmptyState from "../../components/EmptyState";
import SearchBar from "../../components/SearchBar";
import useApi from "../../hooks/useApi";
import { useToast } from "../../context/ToastContext";
import { applicationService } from "../../services/applicationService";
import { toApiError } from "../../services/apiClient";
import { APPLICATION_STATUS, formatDate } from "../../utils/format";

function ReviewDialog({ application, onClose, onSaved }) {
  const toast = useToast();
  const [status, setStatus] = useState(application.status);
  const [busy, setBusy] = useState(false);
  const closeRef = useRef(null);
  const a = application;

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save() {
    setBusy(true);
    try {
      await applicationService.updateStatus(a.id, status);
      toast.success("Status updated.");
      onSaved();
    } catch (err) {
      toast.error(toApiError(err).message);
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal wide" role="dialog" aria-modal="true" aria-labelledby="review-title">
        <h3 id="review-title">{a.applicant.full_name} &middot; {a.project_title}</h3>
        <dl className="detail-panel">
          <div><dt>Applicant</dt><dd>{a.applicant.email}<br />{[a.applicant.university, a.applicant.department, a.applicant.academic_year].filter(Boolean).join(" · ")}</dd></div>
          <div><dt>Statement of interest</dt><dd>{a.statement_of_interest}</dd></div>
          <div><dt>Relevant skills</dt><dd>{a.relevant_skills}</dd></div>
          <div><dt>Academic background</dt><dd>{a.academic_background}</dd></div>
          <div><dt>Experience</dt><dd>{a.experience}</dd></div>
          {a.portfolio_url && <div><dt>Portfolio</dt><dd><a href={a.portfolio_url} target="_blank" rel="noopener noreferrer">{a.portfolio_url}</a></dd></div>}
          <div><dt>Submitted</dt><dd>{formatDate(a.submitted_at)}</dd></div>
        </dl>
        <div className="field">
          <label htmlFor="review-status">Status</label>
          <select id="review-status" className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            {Object.entries(APPLICATION_STATUS).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
          </select>
        </div>
        <div className="modal-actions">
          <button type="button" ref={closeRef} className="btn btn-secondary" onClick={onClose}>Close</button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={busy || status === a.status}>{busy ? "Saving..." : "Save status"}</button>
        </div>
      </div>
    </div>
  );
}

export default function AdminApplications() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, parseInt(params.get("page") || "1", 10) || 1);
  const q = params.get("q") || "";
  const status = params.get("status") || "";
  const [reviewing, setReviewing] = useState(null);
  const { data, loading, error, retry } = useApi(() => applicationService.adminList({ q: q || undefined, status: status || undefined, page, page_size: 15 }), [params.toString()]);
  const set = (changes) => setParams((cur) => { const n = new URLSearchParams(cur); Object.entries(changes).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k))); if (!("page" in changes)) n.delete("page"); return n; }, { replace: true });

  return (
    <div className="stack">
      <header className="page-header"><p className="eyebrow">Administration</p><h1>Applications</h1></header>
      <div className="toolbar">
        <div className="grow"><SearchBar value={q} onSearch={(t) => set({ q: t })} placeholder="Search by applicant, email or project" label="Search applications" /></div>
        <div className="field">
          <label htmlFor="astatus">Status</label>
          <select id="astatus" className="input" value={status} onChange={(e) => set({ status: e.target.value })}>
            <option value="">All</option>
            {Object.entries(APPLICATION_STATUS).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
          </select>
        </div>
      </div>
      {loading && <LoadingSpinner />}
      {error && <ErrorState error={error} onRetry={retry} />}
      {data && data.items.length === 0 && <EmptyState title="No applications found" message="Applications appear here as students submit them." />}
      {data && data.items.length > 0 && (
        <>
          <div className="table-wrap card">
            <table className="table">
              <caption className="sr-only">Applications</caption>
              <thead><tr><th scope="col">Applicant</th><th scope="col">Project</th><th scope="col">Submitted</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead>
              <tbody>
                {data.items.map((a) => (
                  <tr key={a.id}>
                    <th scope="row">{a.applicant.full_name}<br /><span className="muted small">{a.applicant.email}</span></th>
                    <td data-label="Project">{a.project_title}</td>
                    <td data-label="Submitted">{formatDate(a.submitted_at)}</td>
                    <td data-label="Status"><StatusBadge status={a.status} kind="application" /></td>
                    <td><button type="button" className="btn btn-secondary btn-sm" onClick={() => setReviewing(a)}>Review</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} totalPages={data.total_pages} onChange={(p) => set({ page: p === 1 ? "" : String(p) })} />
        </>
      )}
      {reviewing && <ReviewDialog application={reviewing} onClose={() => setReviewing(null)} onSaved={() => { setReviewing(null); retry(); }} />}
    </div>
  );
}
