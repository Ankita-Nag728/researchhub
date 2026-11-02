import { Link } from "react-router-dom";
import { ArrowRight, Compass, FileSearch, Send, ClipboardCheck, Layers, Search, BookOpenCheck } from "lucide-react";
import HeroIllustration from "../components/HeroIllustration";
import ProjectCard from "../components/ProjectCard";
import ResearchPaperCard from "../components/ResearchPaperCard";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorState from "../components/ErrorState";
import EmptyState from "../components/EmptyState";
import useApi from "../hooks/useApi";
import { useAuth } from "../context/AuthContext";
import { projectService } from "../services/projectService";
import { paperService } from "../services/paperService";
import { RESEARCH_DOMAINS } from "../utils/format";

const STEPS = [
  { icon: Compass, title: "Discover opportunities", text: "Browse open research projects across disciplines and institutions." },
  { icon: FileSearch, title: "Explore research", text: "Read project details, required skills and the papers behind the work." },
  { icon: Send, title: "Apply for projects", text: "Share your interest, background and experience in one structured form." },
  { icon: ClipboardCheck, title: "Track applications", text: "Follow each application from submitted to a final decision." },
];

// Featured block: handles loading, error (with retry) and empty states itself,
// so a failing request in one section never breaks the rest of the page.
function FeaturedProjects() {
  const { data, loading, error, retry } = useApi(
    () => projectService.list({ status: "open", sort: "deadline", page: 1, page_size: 3 }),
    [],
  );
  if (loading) return <LoadingSpinner label="Loading featured projects..." />;
  if (error) return <ErrorState error={error} onRetry={retry} title="Featured projects are unavailable" />;
  if (!data?.items?.length) {
    return (
      <EmptyState
        title="No open projects yet"
        message="New research opportunities will appear here as soon as they are published."
      />
    );
  }
  return (
    <div className="grid-cards">
      {data.items.map((p) => (
        <ProjectCard key={p.id} project={p} />
      ))}
    </div>
  );
}

function FeaturedPapers() {
  const { data, loading, error, retry } = useApi(() => paperService.list({ sort: "newest", page: 1, page_size: 3 }), []);
  if (loading) return <LoadingSpinner label="Loading research papers..." />;
  if (error) return <ErrorState error={error} onRetry={retry} title="Research papers are unavailable" />;
  if (!data?.items?.length) {
    return <EmptyState title="The paper library is empty" message="Publication records will appear here once they are added." />;
  }
  return (
    <div className="grid-cards">
      {data.items.map((p) => (
        <ResearchPaperCard key={p.id} paper={p} />
      ))}
    </div>
  );
}

export default function Landing() {
  const { isAuthenticated } = useAuth();

  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div className="container hero-grid">
          <div>
            <p className="eyebrow">Academic research platform</p>
            <h1 id="hero-title">
              Where Curiosity Meets <em>Discovery.</em>
            </h1>
            <p className="hero-lead">
              ResearchHub brings research projects, publications and student applications into one calm, organised place, so finding
              your next research opportunity is simple.
            </p>
            <div className="hero-actions">
              <Link to="/explore" className="btn btn-primary">
                Explore Research <ArrowRight size={16} aria-hidden="true" />
              </Link>
              {!isAuthenticated && (
                <Link to="/register" className="btn btn-secondary">
                  Join ResearchHub
                </Link>
              )}
            </div>
          </div>
          <HeroIllustration />
        </div>
      </section>

      <section className="section section-alt" aria-labelledby="intro-title">
        <div className="container">
          <div className="section-head">
            <div>
              <p className="eyebrow">The platform</p>
              <h2 id="intro-title">Everything a research journey needs, in one place</h2>
            </div>
          </div>
          <div className="intro-grid">
            <div className="intro-item">
              <Search size={24} aria-hidden="true" />
              <h3>Find the right project</h3>
              <p>Search and filter by domain, institution, status and deadline instead of trawling scattered notice boards.</p>
            </div>
            <div className="intro-item">
              <BookOpenCheck size={24} aria-hidden="true" />
              <h3>Read before you apply</h3>
              <p>A searchable library of publication details links to the original sources, so you can understand the work first.</p>
            </div>
            <div className="intro-item">
              <Layers size={24} aria-hidden="true" />
              <h3>Keep every application tidy</h3>
              <p>One profile, one form and one dashboard to see where each application stands.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="featured-projects-title">
        <div className="container">
          <div className="section-head">
            <div>
              <p className="eyebrow">Open now</p>
              <h2 id="featured-projects-title">Featured research projects</h2>
              <p>Opportunities closing soonest, straight from the project database.</p>
            </div>
            <Link to="/explore" className="btn btn-secondary btn-sm">
              View all projects <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <FeaturedProjects />
        </div>
      </section>

      <section className="section section-alt" aria-labelledby="categories-title">
        <div className="container">
          <div className="section-head">
            <div>
              <p className="eyebrow">Research areas</p>
              <h2 id="categories-title">Browse by discipline</h2>
            </div>
          </div>
          <ul className="category-list">
            {RESEARCH_DOMAINS.map((domain) => (
              <li key={domain}>
                <Link to={`/explore?domain=${encodeURIComponent(domain)}`}>
                  {domain}
                  <ArrowRight size={18} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section" aria-labelledby="how-title">
        <div className="container">
          <div className="section-head">
            <div>
              <p className="eyebrow">How it works</p>
              <h2 id="how-title">From curiosity to application in four steps</h2>
            </div>
          </div>
          <ol className="steps">
            {STEPS.map(({ icon: Icon, title, text }) => (
              <li key={title}>
                <Icon size={22} aria-hidden="true" style={{ color: "var(--rose-deep)", marginBottom: "var(--space-2)" }} />
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section section-alt" aria-labelledby="featured-papers-title">
        <div className="container">
          <div className="section-head">
            <div>
              <p className="eyebrow">Library</p>
              <h2 id="featured-papers-title">Recent research papers</h2>
              <p>Publication details with links to the original sources.</p>
            </div>
            <Link to="/papers" className="btn btn-secondary btn-sm">
              Browse the library <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <FeaturedPapers />
        </div>
      </section>

      <section className="section" aria-labelledby="cta-title">
        <div className="container">
          <div className="cta">
            <h2 id="cta-title">Ready to start your next research project?</h2>
            <p>Create a free profile, save the projects you like and apply when you are ready.</p>
            <div className="cta-actions">
              <Link to={isAuthenticated ? "/dashboard" : "/register"} className="btn btn-light">
                {isAuthenticated ? "Go to your dashboard" : "Create your profile"}
              </Link>
              <Link to="/explore" className="btn btn-outline-light">
                Explore Research
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
