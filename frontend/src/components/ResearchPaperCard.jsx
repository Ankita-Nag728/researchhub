import { Bookmark, ExternalLink } from "lucide-react";

// Only metadata is shown; the paper itself is on the publisher's site.
export default function ResearchPaperCard({ paper, bookmarked = false, onToggleBookmark }) {
  return (
    <article className="card card-interactive paper-card">
      <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-3)", alignItems: "center", marginBottom: "var(--space-3)" }}>
        <span className="tag">{paper.category}</span>
        <span className="muted" style={{ fontSize: "var(--text-xs)" }}>{paper.publication_year}</span>
      </div>
      <h3>{paper.title}</h3>
      <p className="authors">{paper.authors}</p>
      <p className="abstract">{paper.abstract}</p>
      <div className="pub-meta">
        {paper.journal && <span>{paper.journal}</span>}
        {paper.doi && <span>DOI: {paper.doi}</span>}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "var(--space-4)", paddingTop: "var(--space-3)", borderTop: "1px solid var(--border)" }}>
        {paper.external_url ? (
          <a className="btn btn-secondary btn-sm" href={paper.external_url} target="_blank" rel="noopener noreferrer">
            Open source <ExternalLink size={15} aria-hidden="true" />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        ) : (
          <span />
        )}
        {onToggleBookmark && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            aria-pressed={bookmarked}
            aria-label={bookmarked ? `Remove ${paper.title} from saved papers` : `Save ${paper.title}`}
            onClick={() => onToggleBookmark(paper)}
          >
            <Bookmark size={18} aria-hidden="true" fill={bookmarked ? "currentColor" : "none"} />
          </button>
        )}
      </div>
    </article>
  );
}
