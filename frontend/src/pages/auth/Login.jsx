import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AuthShell, { FormBanner } from "./AuthShell";
import FormInput from "../../components/FormInput";
import { useAuth } from "../../context/AuthContext";
import { toApiError } from "../../services/apiClient";
import { collectErrors, safeRedirect, validateEmail } from "../../utils/validation";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from;
  const [form, setForm] = useState({ email: "", password: "", remember_me: false });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    const found = collectErrors({
      email: () => validateEmail(form.email),
      password: () => (form.password ? "" : "Enter your password."),
    });
    setErrors(found);
    setFormError("");
    if (Object.keys(found).length) return;

    setBusy(true);
    try {
      const user = await login({ email: form.email.trim(), password: form.password, remember_me: form.remember_me });
      // Go back to where the visitor was heading (only to pages inside this app).
      navigate(safeRedirect(from, user.role === "admin" ? "/admin" : "/dashboard"), { replace: true });
    } catch (err) {
      const apiError = toApiError(err);
      setFormError(apiError.status === 429 ? "Too many attempts. Please wait a minute and try again." : apiError.message);
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      intro={from ? "Please log in to continue." : "Log in to apply, save projects and track applications."}
      footer={<>New here? <Link to="/register" state={{ from }}>Create an account</Link></>}
    >
      <form onSubmit={onSubmit} noValidate>
        <FormBanner message={formError} />
        <FormInput label="Email address" type="email" autoComplete="email" value={form.email} onChange={set("email")} error={errors.email} required />
        <FormInput label="Password" type="password" autoComplete="current-password" value={form.password} onChange={set("password")} error={errors.password} required />
        <div className="auth-row">
          <label className="check">
            <input type="checkbox" checked={form.remember_me} onChange={set("remember_me")} /> Keep me signed in for 30 days
          </label>
          <Link to="/forgot-password">Forgot password?</Link>
        </div>
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? "Logging in..." : "Log in"}
        </button>
      </form>
    </AuthShell>
  );
}
