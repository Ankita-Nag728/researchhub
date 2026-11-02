import { useState } from "react";
import ProjectCard from "../components/ProjectCard";
import ResearchPaperCard from "../components/ResearchPaperCard";
import StatusBadge from "../components/StatusBadge";
import FormInput from "../components/FormInput";
import SearchBar from "../components/SearchBar";
import FilterPanel from "../components/FilterPanel";
import Pagination from "../components/Pagination";
import EmptyState from "../components/EmptyState";
import LoadingSpinner from "../components/LoadingSpinner";
import ConfirmationModal from "../components/ConfirmationModal";
import { useToast } from "../context/ToastContext";
import { RESEARCH_DOMAINS } from "../utils/format";

// Developer-only style guide (route exists only in `npm run dev`).
// The records below are SAMPLE data for previewing components, not real research.
const SAMPLE_PROJECT = {
  id: 0,
  title: "Sample Project: Explainable Models for Small Datasets",
  short_description: "Demonstration record used to preview how a project card looks.",
  domain: "Machine Learning",
  institution: "Sample Institution",
  supervisor: "Sample Supervisor",
  status: "open",
  application_deadline: "2027-03-31",
};
const SAMPLE_PAPER = {
  id: 0,
  title: "Sample Paper Title for Layout Preview",
  authors: "A. Author, B. Author",
  abstract: "Demonstration abstract text, used only to preview how a paper card handles several lines of content in the library layout.",
  publication_year: 2024,
  category: "Data Science",
  journal: "Sample Journal",
  doi: "10.0000/sample",
  external_url: "https://example.org",
};

const PALETTE = [
  ["Background", "--bg"], ["Alt background", "--bg-alt"], ["Baby pink", "--pink"],
  ["Rose", "--rose"], ["Deep rose", "--rose-deep"], ["Burgundy", "--burgundy"],
  ["Text", "--text"], ["Muted text", "--text-muted"], ["Border", "--border"],
];

export default function DesignSystem() {
  const toast = useToast();
  const [modal, setModal] = useState(false);
  const [page, setPage] = useState(3);
  const [filters, setFilters] = useState({});
  const [query, setQuery] = useState("");

  return (
    <div className="container stack" style={{ paddingBlock: "var(--space-7)" }}>
      <header className="page-header">
        <p className="eyebrow">Developer preview</p>
        <h1>ResearchHub design system</h1>
        <p className="muted">Every component the app is built from. This page only exists in development.</p>
      </header>

      <section aria-labelledby="ds-color">
        <h2 id="ds-color">Colour</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "var(--space-3)" }}>
          {PALETTE.map(([name, token]) => (
            <div key={token} className="card" style={{ padding: "var(--space-3)" }}>
              <div style={{ height: 48, borderRadius: 8, background: `var(${token})`, border: "1px solid var(--border)" }} />
              <p style={{ margin: "var(--space-2) 0 0", fontSize: "var(--text-xs)", fontWeight: 600 }}>{name}</p>
              <code style={{ fontSize: "var(--text-xs)" }}>{token}</code>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="ds-type">
        <h2 id="ds-type">Typography</h2>
        <div className="card">
          <p className="eyebrow">Eyebrow label</p>
          <h1>Where Curiosity Meets Discovery</h1>
          <h3>Editorial heading in Playfair Display</h3>
          <p>Body text is set in Inter for readability at small sizes, with generous line height.</p>
          <p className="muted">Secondary text uses the muted tone.</p>
        </div>
      </section>

      <section aria-labelledby="ds-buttons">
        <h2 id="ds-buttons">Buttons and badges</h2>
        <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" className="btn btn-primary" onClick={() => toast.success("Saved successfully")}>Primary</button>
          <button type="button" className="btn btn-secondary" onClick={() => toast.info("Just so you know")}>Secondary</button>
          <button type="button" className="btn btn-ghost" onClick={() => toast.error("Something went wrong")}>Ghost</button>
          <button type="button" className="btn btn-danger" onClick={() => setModal(true)}>Danger (opens modal)</button>
          <button type="button" className="btn btn-primary" disabled>Disabled</button>
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", marginTop: "var(--space-4)" }}>
          {["open", "ongoing", "completed", "closed"].map((s) => <StatusBadge key={s} status={s} />)}
          {["submitted", "under_review", "shortlisted", "accepted", "rejected"].map((s) => <StatusBadge key={s} status={s} kind="application" />)}
        </div>
      </section>

      <section aria-labelledby="ds-forms">
        <h2 id="ds-forms">Forms</h2>
        <div className="card" style={{ maxWidth: 520 }}>
          <FormInput label="Full name" placeholder="Your name" required hint="As it should appear on applications." />
          <FormInput label="Email address" type="email" defaultValue="not-an-email" error="Enter a valid email address." />
          <FormInput label="Statement of interest" as="textarea" placeholder="Why this project?" />
        </div>
      </section>

      <section aria-labelledby="ds-search">
        <h2 id="ds-search">Search and filters</h2>
        <div className="stack">
          <SearchBar value={query} onSearch={setQuery} placeholder="Search by title or keyword" label="Search projects" />
          <FilterPanel
            filters={[
              { name: "domain", label: "Domain", type: "select", options: RESEARCH_DOMAINS.map((d) => ({ value: d, label: d })) },
              { name: "status", label: "Status", type: "select", options: [{ value: "open", label: "Open" }, { value: "completed", label: "Completed" }] },
              { name: "deadline", label: "Deadline before", type: "date" },
            ]}
            values={filters}
            onChange={(name, value) => setFilters((f) => ({ ...f, [name]: value }))}
            onClear={() => setFilters({})}
          />
        </div>
      </section>

      <section aria-labelledby="ds-cards">
        <h2 id="ds-cards">Cards</h2>
        <div className="grid-cards">
          <ProjectCard project={SAMPLE_PROJECT} onToggleBookmark={() => toast.info("Bookmark toggled")} />
          <ResearchPaperCard paper={SAMPLE_PAPER} onToggleBookmark={() => toast.info("Bookmark toggled")} />
        </div>
      </section>

      <section aria-labelledby="ds-states">
        <h2 id="ds-states">States and pagination</h2>
        <LoadingSpinner label="Loading projects..." />
        <EmptyState title="No projects match your filters" message="Try a different keyword or clear the filters to see everything." />
        <div style={{ marginTop: "var(--space-5)" }}>
          <Pagination page={page} totalPages={12} onChange={setPage} />
        </div>
      </section>

      <ConfirmationModal
        open={modal}
        danger
        title="Delete this project?"
        message="This preview modal does nothing. Real deletions are confirmed like this."
        confirmLabel="Delete"
        onConfirm={() => setModal(false)}
        onCancel={() => setModal(false)}
      />
    </div>
  );
}
