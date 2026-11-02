import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ExternalLink, Plus } from "lucide-react";
import ConfirmationModal from "../../components/ConfirmationModal";
import Pagination from "../../components/Pagination";
import LoadingSpinner from "../../components/LoadingSpinner";
import ErrorState from "../../components/ErrorState";
import EmptyState from "../../components/EmptyState";
import SearchBar from "../../components/SearchBar";
import useApi from "../../hooks/useApi";
import { useToast } from "../../context/ToastContext";
import { paperService } from "../../services/paperService";
import { toApiError } from "../../services/apiClient";

export default function AdminPapers() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, parseInt(params.get("page") || "1", 10) || 1);
  const q = params.get("q") || "";
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const { data, loading, error, retry } = useApi(() => paperService.list({ q: q || undefined, page, page_size: 12 }), [params.toString()]);
  const set = (changes) => setParams((cur) => { const n = new URLSearchParams(cur); Object.entries(changes).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k))); if (!("page" in changes)) n.delete("page"); return n; }, { replace: true });

  async function confirm() {
    setBusy(true);
    try {
      await paperService.remove(pending.id);
      toast.success("Paper deleted.");
      retry();
    } catch (err) {
      toast.error(toApiError(err).message);
    } finally {
      setBusy(false);
      setPending(null);
    }
  }

  return (
    <div className="stack">
      <header className="page-header" style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-4)", flexWrap: "wrap", alignItems: "end" }}>
        <div><p className="eyebrow">Administration</p><h1>Research papers</h1></div>
        <Link to="/admin/papers/new" className="btn btn-primary"><Plus size={16} aria-hidden="true" /> Add paper</Link>
      </header>
      <div className="toolbar"><div className="grow"><SearchBar value={q} onSearch={(t) => set({ q: t })} placeholder="Search by title, author or keyword" label="Search papers" /></div></div>
      {loading && <LoadingSpinner />}
      {error && <ErrorState error={error} onRetry={retry} />}
      {data && data.items.length === 0 && <EmptyState title="No papers found" message="Add publication details and a link to the legitimate source." />}
      {data && data.items.length > 0 && (
        <>
          <div className="table-wrap card">
            <table className="table">
              <caption className="sr-only">Research papers</caption>
              <thead><tr><th scope="col">Title</th><th scope="col">Category</th><th scope="col">Year</th><th scope="col">Actions</th></tr></thead>
              <tbody>
                {data.items.map((p) => (
                  <tr key={p.id}>
                    <th scope="row">{p.title}<br /><span className="muted small">{p.journal}</span></th>
                    <td data-label="Category">{p.category}</td>
                    <td data-label="Year">{p.publication_year}</td>
                    <td><div className="actions">
                      <Link to={`/admin/papers/${p.id}/edit`} className="btn btn-secondary btn-sm">Edit</Link>
                      <a href={p.external_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">Source <ExternalLink size={14} aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a>
                      <button type="button" className="btn btn-ghost btn-sm" style={{ color: "var(--error)" }} onClick={() => setPending(p)}>Delete</button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} totalPages={data.total_pages} onChange={(p) => set({ page: p === 1 ? "" : String(p) })} />
        </>
      )}
      <ConfirmationModal open={Boolean(pending)} danger busy={busy} title="Delete this paper?" message={`"${pending?.title}" and any saved bookmarks of it will be removed.`} confirmLabel="Delete" onConfirm={confirm} onCancel={() => setPending(null)} />
    </div>
  );
}
