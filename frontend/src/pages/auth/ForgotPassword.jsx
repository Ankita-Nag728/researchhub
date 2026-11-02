import { useState } from "react";
import { Link } from "react-router-dom";
import AuthShell, { FormBanner } from "./AuthShell";
import FormInput from "../../components/FormInput";
import { authService } from "../../services/authService";
import { toApiError } from "../../services/apiClient";
import { validateEmail } from "../../utils/validation";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    const problem = validateEmail(email);
    setError(problem);
    setFormError("");
    if (problem) return;
    setBusy(true);
    try {
      await authService.forgotPassword(email.trim());
      setDone(true);
    } catch (err) {
      setFormError(toApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Forgot your password?" intro="Enter your email and we will send a reset link." footer={<Link to="/login">Back to login</Link>}>
      {done ? (
        <FormBanner tone="success" message="If an account exists for that email, a reset link is on its way. It works once and expires in 30 minutes." />
      ) : (
        <form onSubmit={onSubmit} noValidate>
          <FormBanner message={formError} />
          <FormInput label="Email address" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={error} required />
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>{busy ? "Sending..." : "Send reset link"}</button>
        </form>
      )}
    </AuthShell>
  );
}
