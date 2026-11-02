import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import SearchBar from "../components/SearchBar";
import FilterPanel from "../components/FilterPanel";
import ResearchPaperCard from "../components/ResearchPaperCard";
import Pagination from "../components/Pagination";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorState from "../components/ErrorState";
import EmptyState from "../components/EmptyState";
import useApi from "../hooks/useApi";
import { useAuth } from "../context/AuthContext";
import { useBookmarks } from "../context/BookmarksContext";
import { paperService } from "../services/paperService";

const PAGE_SIZE = 9;
const SORTS = [{ value: "newest", label: "Newest first" }, { value: "oldest", label: "Oldest first" }, { value: "title", label: "Title (A to Z)" }];

export default function Papers() {
  const [params, setParams] = useSearchParams();
  const { isAuthenticated } = useAuth();
  const { findPaper, togglePaper } = useBookmarks();

  const query = params.get("q") || "";
  const sort = SORTS.some((s) => s.value === params.get("sort")) ? params.get("sort") : "newest";
  const page = Math.max(1, parseInt(params.get("page") || "1", 10) || 1);
  const filters = useMemo(() => ({ category: params.get("category") || "", year: params.get("year") || "" }), [params]);

  const update = useCallback((changes, { resetPage = true } = {}) => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
      if (resetPage) next.delete("page");
      return next;
    }, { replace: true });
  }, [setParams]);
  const handleSearch = useCallback((text) => update({ q: text }), [update]);

  const results = useApi(() => paperService.list({ q: query || undefined, category: filters.category || undefined, year: filters.year || undefined, sort, page, page_size: PAGE_SIZE }), [params.toString()]);
  const options = useApi(() => paperService.filters(), []);
  const { data, loading, error, retry } = results;
  const hasFilters = Boolean(query || filters.category || filters.year);

  const filterConfig = [
    { name: "category", label: "Research category", type: "select", options: (options.data?.categories || []).map((c) => ({ value: c, label: c })) },
    { name: "year", label: "Publication year", type: "select", options: (options.data?.years || []).map((y) => ({ value: String(y), label: String(y) })) },
  ];

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <p className="eyebrow">Library</p>
          <h1>Research papers</h1>
          <p>Publication details with links to the original sources. ResearchHub does not host the papers themselves.</p>
        </div>
      </section>
      <section className="container" style={{ paddingBottom: "var(--space-7)" }} aria-label="Research papers">
        <div className="explore-controls">
          <SearchBar value={query} onSearch={handleSearch} placeholder="Search by title, author or keyword" label="Search research papers" />
          <FilterPanel filters={filterConfig} values={filters} onChange={(n, v) => update({ [n]: v })} onClear={() => setParams({}, { replace: true })} />
        </div>
        <div className="explore-toolbar">
          <p className="result-count" aria-live="polite">{data && !loading ? `${data.total} ${data.total === 1 ? "paper" : "papers"} found` : " "}</p>
          <div className="field">
            <label htmlFor="paper-sort">Sort by</label>
            <select id="paper-sort" className="input" value={sort} onChange={(e) => update({ sort: e.target.value })}>
              {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>

        {loading && <LoadingSpinner label="Loading papers..." />}
        {!loading && error && <ErrorState error={error} onRetry={retry} title="Papers could not be loaded" />}
        {!loading && !error && data?.items?.length === 0 && (
          <EmptyState title={hasFilters ? "No papers match your search" : "The library is empty"} message={hasFilters ? "Try different keywords or clear the filters." : "Papers will appear here once they are added."}
            action={hasFilters && <button type="button" className="btn btn-secondary" style={{ marginTop: "var(--space-4)" }} onClick={() => setParams({}, { replace: true })}>Clear all filters</button>} />
        )}
        {!loading && !error && data?.items?.length > 0 && (
          <>
            <div className="grid-cards">
              {data.items.map((p) => (
                <ResearchPaperCard key={p.id} paper={p} bookmarked={Boolean(findPaper(p.id))} onToggleBookmark={isAuthenticated ? togglePaper : undefined} />
              ))}
            </div>
            <div style={{ marginTop: "var(--space-6)" }}>
              <Pagination page={data.page} totalPages={data.total_pages} onChange={(p) => { update({ page: p === 1 ? "" : String(p) }, { resetPage: false }); window.scrollTo({ top: 0 }); }} />
            </div>
          </>
        )}
      </section>
    </>
  );
}
