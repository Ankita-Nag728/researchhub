import { useNavigate, useParams } from "react-router-dom";
import ResourceForm from "../../components/ResourceForm";
import LoadingSpinner from "../../components/LoadingSpinner";
import ErrorState from "../../components/ErrorState";
import useApi from "../../hooks/useApi";
import { useToast } from "../../context/ToastContext";
import { paperService } from "../../services/paperService";

const FIELDS = [
  { name: "title", label: "Title", type: "text", required: true, full: true, maxLength: 300 },
  { name: "authors", label: "Authors", type: "textarea", required: true, rows: 2, maxLength: 2000 },
  { name: "abstract", label: "Abstract or summary", type: "textarea", required: true, rows: 6, maxLength: 6000, hint: "Write your own summary if you do not have permission to reproduce the abstract." },
  { name: "publication_year", label: "Publication year", type: "number", required: true, min: 1800, max: 2200 },
  { name: "category", label: "Research category", type: "text", required: true },
  { name: "journal", label: "Journal or conference", type: "text", maxLength: 200 },
  { name: "doi", label: "DOI", type: "text", hint: "Like 10.1000/example. Optional." },
  { name: "external_url", label: "Link to the original source", type: "url", required: true, full: true, hint: "Publisher, DOI or preprint page. Papers themselves are not hosted here." },
];

export default function AdminPaperForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const { data, loading, error, retry } = useApi(() => (editing ? paperService.get(id) : Promise.resolve(null)), [id]);
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState error={error} onRetry={retry} />;

  async function save(payload) {
    const body = { ...payload, is_sample: data?.is_sample ?? false };
    if (editing) await paperService.update(id, body);
    else await paperService.create(body);
    toast.success(editing ? "Paper updated." : "Paper added.");
    navigate("/admin/papers");
  }

  return (
    <div className="stack">
      <header className="page-header"><p className="eyebrow">Administration</p><h1>{editing ? "Edit paper" : "Add paper"}</h1></header>
      <ResourceForm fields={FIELDS} initial={data} onSubmit={save} submitLabel={editing ? "Save changes" : "Add paper"} cancelTo="/admin/papers" />
    </div>
  );
}
