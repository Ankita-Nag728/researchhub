import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import ConfirmationModal from "../../components/ConfirmationModal";
import Pagination from "../../components/Pagination";
import LoadingSpinner from "../../components/LoadingSpinner";
import ErrorState from "../../components/ErrorState";
import EmptyState from "../../components/EmptyState";
import SearchBar from "../../components/SearchBar";
import useApi from "../../hooks/useApi";
import { useToast } from "../../context/ToastContext";
import { adminService } from "../../services/applicationService";
import { toApiError } from "../../services/apiClient";
import { formatDate } from "../../utils/format";

export default function AdminUsers() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, parseInt(params.get("page") || "1", 10) || 1);
  const q = params.get("q") || "";
  const role = params.get("role") || "";
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const { data, loading, error, retry } = useApi(() => adminService.users({ q: q || undefined, role: role || undefined, page, page_size: 15 }), [params.toString()]);
  const set = (changes) => setParams((cur) => { const n = new URLSearchParams(cur); Object.entries(changes).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k))); if (!("page" in changes)) n.delete("page"); return n; }, { replace: true });

  async function toggle(user) {
    setBusy(true);
    try {
      await adminService.setUserActive(user.id, !user.is_active);
      toast.success(user.is_active ? "Account suspended." : "Account restored.");
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
      <header className="page-header"><p className="eyebrow">Administration</p><h1>Users</h1></header>
      <div className="toolbar">
        <div className="grow"><SearchBar value={q} onSearch={(t) => set({ q: t })} placeholder="Search by name, email or university" label="Search users" /></div>
        <div className="field">
          <label htmlFor="urole">Role</label>
          <select id="urole" className="input" value={role} onChange={(e) => set({ role: e.target.value })}>
            <option value="">All</option><option value="student">Student</option><option value="researcher">Researcher</option><option value="admin">Admin</option>
          </select>
        </div>
      </div>
      {loading && <LoadingSpinner />}
      {error && <ErrorState error={error} onRetry={retry} />}
      {data && data.items.length === 0 && <EmptyState title="No users found" message="Try a different search." />}
      {data && data.items.length > 0 && (
        <>
          <div className="table-wrap card">
            <table className="table">
              <caption className="sr-only">Registered users</caption>
              <thead><tr><th scope="col">Name</th><th scope="col">University</th><th scope="col">Role</th><th scope="col">Joined</th><th scope="col">Account</th></tr></thead>
              <tbody>
                {data.items.map((u) => (
                  <tr key={u.id}>
                    <th scope="row">{u.full_name}<br /><span className="muted small">{u.email}</span></th>
                    <td data-label="University">{u.university}</td>
                    <td data-label="Role"><span className="tag">{u.role}</span></td>
                    <td data-label="Joined">{formatDate(u.created_at)}</td>
                    <td>
                      {u.role === "admin" ? <span className="muted small">Administrator</span> : u.is_active ? (
                        <button type="button" className="btn btn-ghost btn-sm" style={{ color: "var(--error)" }} onClick={() => setPending(u)}>Suspend</button>
                      ) : (
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => toggle(u)}>Restore</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} totalPages={data.total_pages} onChange={(p) => set({ page: p === 1 ? "" : String(p) })} />
        </>
      )}
      <ConfirmationModal open={Boolean(pending)} danger busy={busy} title="Suspend this account?" message={`${pending?.full_name} will be signed out and unable to log in until restored. Their data is kept.`} confirmLabel="Suspend" onConfirm={() => toggle(pending)} onCancel={() => setPending(null)} />
    </div>
  );
}
