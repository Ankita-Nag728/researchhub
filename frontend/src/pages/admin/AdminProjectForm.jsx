import { useNavigate, useParams } from "react-router-dom";
import ResourceForm from "../../components/ResourceForm";
import LoadingSpinner from "../../components/LoadingSpinner";
import ErrorState from "../../components/ErrorState";
import useApi from "../../hooks/useApi";
import { useToast } from "../../context/ToastContext";
import { projectService } from "../../services/projectService";
import { PROJECT_STATUS, RESEARCH_DOMAINS } from "../../utils/format";

const FIELDS = [
  { name: "title", label: "Title", type: "text", required: true, full: true, maxLength: 200 },
  { name: "short_description", label: "Short description", type: "text", required: true, full: true, maxLength: 300, hint: "Shown on project cards." },
  { name: "full_description", label: "Full description", type: "textarea", required: true, rows: 6, maxLength: 8000 },
  { name: "research_objectives", label: "Research objectives", type: "textarea", required: true, maxLength: 4000 },
  { name: "domain", label: "Research domain", type: "text", required: true, hint: `For example: ${RESEARCH_DOMAINS.slice(0, 3).join(", ")}` },
  { name: "institution", label: "Institution", type: "text", required: true },
  { name: "supervisor", label: "Supervisor", type: "text", required: true },
  { name: "duration", label: "Duration", type: "text", required: true, hint: "e.g. 3 months" },
  { name: "available_positions", label: "Available positions", type: "number", required: true, min: 0, max: 500, default: 1 },
  { name: "application_deadline", label: "Application deadline", type: "datetime", hint: "Leave empty for no deadline. Uses your local time." },
  { name: "status", label: "Status", type: "select", default: "open", options: Object.entries(PROJECT_STATUS).map(([value, s]) => ({ value, label: s.label })) },
  { name: "required_skills", label: "Required skills", type: "list", hint: "Separate with commas." },
  { name: "eligibility", label: "Eligibility requirements", type: "textarea", required: true, maxLength: 3000 },
  { name: "application_instructions", label: "Application instructions", type: "textarea", maxLength: 3000 },
];

export default function AdminProjectForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const { data, loading, error, retry } = useApi(() => (editing ? projectService.get(id) : Promise.resolve(null)), [id]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState error={error} onRetry={retry} />;

  async function save(payload) {
    // Keep the "sample" label on records that were created as sample data.
    const body = { ...payload, is_sample: data?.is_sample ?? false };
    if (editing) await projectService.update(id, body);
    else await projectService.create(body);
    toast.success(editing ? "Project updated." : "Project created.");
    navigate("/admin/projects");
  }

  return (
    <div className="stack">
      <header className="page-header"><p className="eyebrow">Administration</p><h1>{editing ? "Edit project" : "New project"}</h1></header>
      <ResourceForm fields={FIELDS} initial={data} onSubmit={save} submitLabel={editing ? "Save changes" : "Create project"} cancelTo="/admin/projects" />
    </div>
  );
}
