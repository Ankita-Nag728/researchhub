import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AuthShell, { FormBanner } from "./AuthShell";
import FormInput from "../../components/FormInput";
import { useToast } from "../../context/ToastContext";
import { authService } from "../../services/authService";
import { toApiError } from "../../services/apiClient";
import { collectErrors, validatePassword } from "../../utils/validation";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({ password: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    const found = collectErrors({
      password: () => validatePassword(form.password),
      confirm: () => (form.confirm === form.password ? "" : "Passwords do not match."),
    });
    setErrors(found);
    setFormError("");
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      await authService.resetPassword({ token, new_password: form.password });
      toast.success("Password updated. Please log in.");
      navigate("/login", { replace: true });
    } catch (err) {
      const apiError = toApiError(err);
      setFormError(apiError.fieldErrors?.new_password || apiError.message);
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <AuthShell title="Reset link missing" footer={<Link to="/forgot-password">Request a new link</Link>}>
        <FormBanner message="This page needs the link from your reset email." />
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" footer={<Link to="/login">Back to login</Link>}>
      <form onSubmit={onSubmit} noValidate>
        <FormBanner message={formError} />
        <FormInput label="New password" type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} error={errors.password} hint="At least 10 characters." required />
        <FormInput label="Confirm new password" type="password" autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} error={errors.confirm} required />
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>{busy ? "Saving..." : "Update password"}</button>
      </form>
    </AuthShell>
  );
}
