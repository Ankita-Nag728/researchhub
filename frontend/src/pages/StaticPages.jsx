import { Link } from "react-router-dom";
import { Mail } from "lucide-react";
import EmptyState from "../components/EmptyState";

function PageShell({ eyebrow, title, intro, children }) {
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          {intro && <p>{intro}</p>}
        </div>
      </section>
      <section className="container" style={{ paddingBottom: "var(--space-7)" }}>
        <div className="prose">{children}</div>
      </section>
    </>
  );
}

export function About() {
  return (
    <PageShell
      eyebrow="About"
      title="A calmer way to find research"
      intro="ResearchHub is a platform for discovering academic research opportunities and publications."
    >
      <h2>Why it exists</h2>
      <p>
        Research opportunities are often scattered across departmental pages, email lists and notice boards. Students can miss
        projects that suit them, and supervisors struggle to reach the right applicants.
      </p>
      <h2>What you can do</h2>
      <ul>
        <li>Explore research projects and filter them by domain, institution, status and deadline.</li>
        <li>Browse publication details, with links to the original sources on publisher sites.</li>
        <li>Create a profile, apply to projects and follow each application&apos;s progress.</li>
        <li>For administrators: publish projects, manage the paper library and review applications.</li>
      </ul>
      <h2>About the content</h2>
      <p>
        ResearchHub stores publication metadata and links to legitimate sources; it does not host copyrighted papers. Any records
        marked as sample data are for demonstration only.
      </p>
      <p>
        <Link to="/explore" className="btn btn-primary">Explore Research</Link>
      </p>
    </PageShell>
  );
}

// The contact address comes from configuration so we never ship a made-up one.
export function Contact() {
  const email = import.meta.env.VITE_CONTACT_EMAIL;
  return (
    <PageShell eyebrow="Contact" title="Get in touch" intro="Questions about the platform, a project listing or your account.">
      {email ? (
        <p>
          <a className="btn btn-primary" href={`mailto:${email}`}>
            <Mail size={16} aria-hidden="true" /> {email}
          </a>
        </p>
      ) : (
        <EmptyState
          title="Contact details are not configured"
          message="The site owner needs to set VITE_CONTACT_EMAIL for this deployment."
        />
      )}
    </PageShell>
  );
}

export function Privacy() {
  return (
    <PageShell eyebrow="Legal" title="Privacy Policy" intro="What ResearchHub collects, why, and how it is protected.">
      <p className="notice" role="note">
        Draft policy: have it reviewed against the laws that apply to your institution and users before launch.
      </p>
      <h2>What we collect</h2>
      <ul>
        <li>Account details: name, email address and a password (stored only as a salted hash, never in plain text).</li>
        <li>Academic details you provide: university, department, academic year, skills, a short biography and optional LinkedIn or GitHub links.</li>
        <li>Application content: the statements and experience you submit when you apply to a project.</li>
        <li>Saved projects and papers.</li>
      </ul>
      <p>We do not ask for information we do not need.</p>
      <h2>Who can see it</h2>
      <ul>
        <li>Your profile and applications are private to you. They are not shown publicly.</li>
        <li>Platform administrators can view applications and accounts in order to run the service and review applications.</li>
      </ul>
      <h2>Cookies</h2>
      <p>
        We use a single secure session cookie to keep you signed in, and a companion security cookie that protects against forged
        requests. We do not use advertising or tracking cookies.
      </p>
      <h2>Your choices</h2>
      <p>You can edit your profile at any time. To ask for your account and data to be deleted, use the contact page.</p>
    </PageShell>
  );
}

export function Terms() {
  return (
    <PageShell eyebrow="Legal" title="Terms of Service" intro="The ground rules for using ResearchHub.">
      <p className="notice" role="note">
        Draft terms: have them reviewed by a qualified professional before launch.
      </p>
      <h2>Using the platform</h2>
      <ul>
        <li>Provide accurate information in your profile and applications.</li>
        <li>Keep your password private and do not share your account.</li>
        <li>Do not attempt to access other people&apos;s data or disrupt the service.</li>
      </ul>
      <h2>Applications</h2>
      <p>
        Submitting an application does not guarantee a place. Decisions are made by project supervisors and administrators, and
        ResearchHub does not guarantee any outcome.
      </p>
      <h2>Content and links</h2>
      <p>
        Publication records link to third-party sites, which are governed by their own terms. ResearchHub is not responsible for
        their content.
      </p>
      <h2>Changes</h2>
      <p>These terms may be updated. Continued use of the platform means you accept the current version.</p>
    </PageShell>
  );
}
