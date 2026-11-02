import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import SearchBar from "../components/SearchBar";
import FilterPanel from "../components/FilterPanel";
import ProjectCard from "../components/ProjectCard";
import Pagination from "../components/Pagination";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorState from "../components/ErrorState";
import EmptyState from "../components/EmptyState";
import useApi from "../hooks/useApi";
import { useAuth } from "../context/AuthContext";
import { useBookmarks } from "../context/BookmarksContext";
import { projectService } from "../services/projectService";
import { PROJECT_STATUS, RESEARCH_DOMAINS } from "../utils/format";

const PAGE_SIZE = 9;
const FILTER_KEYS = ["domain", "institution", "status", "deadline_before"];
const SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "deadline", label: "Deadline (soonest)" },
];

// The URL is the single source of truth for search, filters, sort and page.
// That makes results shareable, and the browser Back button just works.
export default function Explore() {
  const [params, setParams] = useSearchParams();
  const { isAuthenticated } = useAuth();
  const { findProject, toggleProject } = useBookmarks();

  const query = params.get("q") || "";
  const sort = SORTS.some((s) => s.value === params.get("sort")) ? params.get("sort") : "newest";
  const page = Math.max(1, parseInt(params.get("page") || "1", 10) || 1);
  const filters = useMemo(() => Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) || ""])), [params]);

  const update = useCallback(
    (changes, { resetPage = true } = {}) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
          if (resetPage) next.delete("page");
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const handleSearch = useCallback((text) => update({ q: text }), [update]);
  const clearAll = () => setParams({}, { replace: true });

  const apiParams = { q: query || undefined, sort, page, page_size: PAGE_SIZE };
  FILTER_KEYS.forEach((k) => {
    if (filters[k]) apiParams[k] = filters[k];
  });

  const results = useApi(() => projectService.list(apiParams), [params.toString()]);
  const options = useApi(() => projectService.filters(), []);

  // If the options request fails the page still works; the dropdowns just fall back to defaults.
  const institutions = options.data?.institutions || [];
  const domains = options.data?.domains?.length ? options.data.domains : RESEARCH_DOMAINS;

  const filterConfig = [
    { name: "domain", label: "Research domain", type: "select", options: domains.map((d) => ({ value: d, label: d })) },
    { name: "institution", label: "Institution", type: "select", options: institutions.map((i) => ({ value: i, label: i })) },
    {
      name: "status",
      label: "Status",
      type: "select",
      options: Object.entries(PROJECT_STATUS)
        .filter(([value]) => value !== "archived")
        .map(([value, s]) => ({ value, label: s.label })),
    },
    { name: "deadline_before", label: "Deadline on or before", type: "date" },
  ];

  const hasFilters = Boolean(query) || FILTER_KEYS.some((k) => filters[k]);
  const { data, loading, error, retry } = results;

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <p className="eyebrow">Explore</p>
          <h1>Find a research project</h1>
          <p>Search by title or keyword, then narrow the list by domain, institution, status or deadline.</p>
        </div>
      </section>

      <section className="container" style={{ paddingBottom: "var(--space-7)" }} aria-label="Research projects">
        <div className="explore-controls">
          <SearchBar value={query} onSearch={handleSearch} placeholder="Search by title or keyword" label="Search research projects" />
          <FilterPanel
            filters={filterConfig}
            values={filters}
            onChange={(name, value) => update({ [name]: value })}
            onClear={clearAll}
          />
        </div>

        <div className="explore-toolbar">
          <p className="result-count" aria-live="polite">
            {data && !loading ? `${data.total} ${data.total === 1 ? "project" : "projects"} found` : " "}
          </p>
          <div className="field">
            <label htmlFor="sort">Sort by</label>
            <select id="sort" className="input" value={sort} onChange={(e) => update({ sort: e.target.value })}>
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        {loading && <LoadingSpinner label="Loading projects..." />}
        {!loading && error && <ErrorState error={error} onRetry={retry} title="Projects could not be loaded" />}
        {!loading && !error && data?.items?.length === 0 && (
          <EmptyState
            title={hasFilters ? "No projects match your search" : "No projects have been published yet"}
            message={hasFilters ? "Try a different keyword, or clear the filters to see every project." : "Check back soon for new research opportunities."}
            action={
              hasFilters && (
                <button type="button" className="btn btn-secondary" style={{ marginTop: "var(--space-4)" }} onClick={clearAll}>
                  Clear all filters
                </button>
              )
            }
          />
        )}
        {!loading && !error && data?.items?.length > 0 && (
          <>
            <div className="grid-cards">
              {data.items.map((p) => (
                <ProjectCard key={p.id} project={p} bookmarked={Boolean(findProject(p.id))} onToggleBookmark={isAuthenticated ? toggleProject : undefined} />
              ))}
            </div>
            <div style={{ marginTop: "var(--space-6)" }}>
              <Pagination
                page={data.page}
                totalPages={data.total_pages}
                onChange={(p) => {
                  update({ page: p === 1 ? "" : String(p) }, { resetPage: false });
                  window.scrollTo({ top: 0 });
                }}
              />
            </div>
          </>
        )}
      </section>
    </>
  );
}
