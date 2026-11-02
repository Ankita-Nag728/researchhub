import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AuthShell, { FormBanner } from "./AuthShell";
import FormInput from "../../components/FormInput";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { toApiError } from "../../services/apiClient";
import { collectErrors, minLength, safeRedirect, validateEmail, validatePassword } from "../../utils/validation";

const YEARS = ["1st year", "2nd year", "3rd year", "4th year", "Master's", "PhD", "Faculty / staff", "Other"];

export default function Register() {
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const from = useLocation().state?.from;
  const [form, setForm] = useState({
    full_name: "", email: "", password: "", confirm_password: "", university: "", department: "", academic_year: "", role: "student",
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    const found = collectErrors({
      full_name: () => minLength(form.full_name, 2, "Your name"),
      email: () => validateEmail(form.email),
      password: () => validatePassword(form.password),
      confirm_password: () => (form.confirm_password === form.password ? "" : "Passwords do not match."),
      university: () => minLength(form.university, 2, "University"),
      department: () => minLength(form.department, 2, "Department"),
      academic_year: () => (form.academic_year ? "" : "Choose your academic year."),
    });
    setErrors(found);
    setFormError("");
    if (Object.keys(found).length) return;

    setBusy(true);
    try {
      await register({ ...form, full_name: form.full_name.trim(), email: form.email.trim() });
      toast.success("Welcome to ResearchHub! Your account is ready.");
      navigate(safeRedirect(from, "/dashboard"), { replace: true });
    } catch (err) {
      const apiError = toApiError(err);
      setErrors(apiError.fieldErrors || {});
      setFormError(apiError.message);
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Create your account" intro="Free for students and researchers." footer={<>Already registered? <Link to="/login" state={{ from }}>Log in</Link></>}>
      <form onSubmit={onSubmit} noValidate>
        <FormBanner message={formError} />
        <FormInput label="Full name" autoComplete="name" value={form.full_name} onChange={set("full_name")} error={errors.full_name} required />
        <FormInput label="Email address" type="email" autoComplete="email" value={form.email} onChange={set("email")} error={errors.email} required />
        <FormInput label="Password" type="password" autoComplete="new-password" value={form.password} onChange={set("password")} error={errors.password} hint="At least 10 characters. A short phrase works well." required />
        <FormInput label="Confirm password" type="password" autoComplete="new-password" value={form.confirm_password} onChange={set("confirm_password")} error={errors.confirm_password} required />
        <FormInput label="University" autoComplete="organization" value={form.university} onChange={set("university")} error={errors.university} required />
        <FormInput label="Department" value={form.department} onChange={set("department")} error={errors.department} required />
        <FormInput as="select" label="Academic year" value={form.academic_year} onChange={set("academic_year")} error={errors.academic_year} required>
          <option value="">Select...</option>
          {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
        </FormInput>
        <FormInput as="select" label="I am a" value={form.role} onChange={set("role")} error={errors.role}>
          <option value="student">Student</option>
          <option value="researcher">Researcher</option>
        </FormInput>
        <p className="muted small">By creating an account you agree to the <Link to="/terms">Terms</Link> and <Link to="/privacy">Privacy Policy</Link>.</p>
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? "Creating account..." : "Create account"}
        </button>
      </form>
    </AuthShell>
  );
}
