import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import FormInput from "../components/FormInput";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorState from "../components/ErrorState";
import { FormBanner } from "./auth/AuthShell";
import useApi from "../hooks/useApi";
import { useToast } from "../context/ToastContext";
import { projectService } from "../services/projectService";
import { applicationService } from "../services/applicationService";
import { toApiError } from "../services/apiClient";
import { formatDate, isDeadlinePassed } from "../utils/format";
import { collectErrors, minLength, validateUrl } from "../utils/validation";

export default function ApplyPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: project, loading, error, retry } = useApi(() => projectService.get(id), [id]);
  const [form, setForm] = useState({ statement_of_interest: "", relevant_skills: "", academic_background: "", experience: "", portfolio_url: "" });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));

  if (loading) return <LoadingSpinner label="Loading project..." />;
  if (error) return <div className="container" style={{ paddingBlock: "var(--space-7)" }}><ErrorState error={error} onRetry={retry} /></div>;

  const closed = project.status !== "open" ? "This project is not open for applications." : isDeadlinePassed(project.application_deadline) ? "The application deadline has passed." : "";

  async function onSubmit(e) {
    e.preventDefault();
    const found = collectErrors({
      statement_of_interest: () => minLength(form.statement_of_interest, 30, "Your statement"),
      relevant_skills: () => minLength(form.relevant_skills, 3, "Relevant skills"),
      academic_background: () => minLength(form.academic_background, 10, "Academic background"),
      experience: () => minLength(form.experience, 3, "Experience"),
      portfolio_url: () => validateUrl(form.portfolio_url),
    });
    setErrors(found);
    setFormError("");
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      await applicationService.submit({ project_id: project.id, ...form, portfolio_url: form.portfolio_url.trim() || null });
      toast.success("Application submitted. Good luck!");
      navigate("/dashboard/applications", { replace: true });
    } catch (err) {
      const apiError = toApiError(err);
      setErrors(apiError.fieldErrors || {});
      setFormError(apiError.message);
      setBusy(false);
    }
  }

  return (
    <div className="container detail-page" style={{ maxWidth: 760 }}>
      <Link to={`/projects/${project.id}`} className="back-link"><ArrowLeft size={16} aria-hidden="true" /> Back to project</Link>
      <header className="detail-header">
        <p className="eyebrow">Application</p>
        <h1>{project.title}</h1>
        <p className="muted">{project.institution} &middot; Deadline {formatDate(project.application_deadline)}</p>
      </header>

      {closed ? (
        <FormBanner tone="warning" message={closed} />
      ) : (
        <form className="card" onSubmit={onSubmit} noValidate>
          <FormBanner message={formError} />
          <FormInput as="textarea" label="Statement of interest" rows={6} value={form.statement_of_interest} onChange={set("statement_of_interest")} error={errors.statement_of_interest} maxLength={3000} hint="Why this project, and why you? At least 30 characters." required />
          <FormInput as="textarea" label="Relevant skills" rows={3} value={form.relevant_skills} onChange={set("relevant_skills")} error={errors.relevant_skills} maxLength={1000} required />
          <FormInput as="textarea" label="Academic background" rows={4} value={form.academic_background} onChange={set("academic_background")} error={errors.academic_background} maxLength={2000} required />
          <FormInput as="textarea" label="Relevant experience" rows={4} value={form.experience} onChange={set("experience")} error={errors.experience} maxLength={2000} hint='If you have none yet, say so, e.g. "No formal experience; keen to learn."' required />
          <FormInput label="Portfolio or GitHub link (optional)" type="url" value={form.portfolio_url} onChange={set("portfolio_url")} error={errors.portfolio_url} placeholder="https://github.com/your-name" maxLength={500} />
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Submitting..." : "Submit application"}</button>
        </form>
      )}
    </div>
  );
}
