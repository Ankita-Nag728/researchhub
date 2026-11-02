import { Link } from "react-router-dom";
import ProjectCard from "../../components/ProjectCard";
import ResearchPaperCard from "../../components/ResearchPaperCard";
import EmptyState from "../../components/EmptyState";
import { useBookmarks } from "../../context/BookmarksContext";

export default function Saved() {
  const { saved, toggleProject, togglePaper } = useBookmarks();
  return (
    <div className="stack">
      <header className="page-header">
        <p className="eyebrow">Saved</p>
        <h1>Saved projects and papers</h1>
      </header>
      <section aria-labelledby="sp">
        <h2 id="sp">Projects</h2>
        {saved.projects.length ? (
          <div className="grid-cards">{saved.projects.map((b) => <ProjectCard key={b.bookmark_id} project={b.project} bookmarked onToggleBookmark={toggleProject} />)}</div>
        ) : (
          <EmptyState title="No saved projects" message="Use the bookmark icon on a project to keep it here." action={<Link to="/explore" className="btn btn-secondary" style={{ marginTop: "var(--space-4)" }}>Explore research</Link>} />
        )}
      </section>
      <section aria-labelledby="spp">
        <h2 id="spp">Papers</h2>
        {saved.papers.length ? (
          <div className="grid-cards">{saved.papers.map((b) => <ResearchPaperCard key={b.bookmark_id} paper={b.paper} bookmarked onToggleBookmark={togglePaper} />)}</div>
        ) : (
          <EmptyState title="No saved papers" message="Bookmark papers in the library to read them later." action={<Link to="/papers" className="btn btn-secondary" style={{ marginTop: "var(--space-4)" }}>Browse papers</Link>} />
        )}
      </section>
    </div>
  );
}
