import { useState } from "react";
import FormInput from "../../components/FormInput";
import { FormBanner } from "../auth/AuthShell";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { userService } from "../../services/applicationService";
import { toApiError } from "../../services/apiClient";
import { collectErrors, minLength, splitList, validatePassword, validateUrl } from "../../utils/validation";

function ProfileForm() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({
    full_name: user.full_name, university: user.university || "", department: user.department || "", academic_year: user.academic_year || "",
    bio: user.bio || "", skills: (user.skills || []).join(", "), github_url: user.github_url || "", linkedin_url: user.linkedin_url || "",
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    const found = collectErrors({
      full_name: () => minLength(form.full_name, 2, "Your name"),
      university: () => minLength(form.university, 2, "University"),
      department: () => minLength(form.department, 2, "Department"),
      academic_year: () => (form.academic_year.trim() ? "" : "Academic year is required."),
      github_url: () => validateUrl(form.github_url),
      linkedin_url: () => validateUrl(form.linkedin_url),
    });
    setErrors(found);
    setFormError("");
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      const updated = await userService.update({ ...form, skills: splitList(form.skills), bio: form.bio.trim() || null, github_url: form.github_url.trim() || null, linkedin_url: form.linkedin_url.trim() || null });
      setUser(updated);
      toast.success("Profile saved.");
    } catch (err) {
      const apiError = toApiError(err);
      setErrors(apiError.fieldErrors || {});
      setFormError(apiError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card" onSubmit={onSubmit} noValidate aria-labelledby="profile-title">
      <h2 id="profile-title">Your details</h2>
      <FormBanner message={formError} />
      <FormInput label="Email address" value={user.email} readOnly hint="Your email cannot be changed here." />
      <FormInput label="Full name" value={form.full_name} onChange={set("full_name")} error={errors.full_name} required />
      <FormInput label="University" value={form.university} onChange={set("university")} error={errors.university} required />
      <FormInput label="Department" value={form.department} onChange={set("department")} error={errors.department} required />
      <FormInput label="Academic year" value={form.academic_year} onChange={set("academic_year")} error={errors.academic_year} required />
      <FormInput as="textarea" label="Short biography" rows={4} value={form.bio} onChange={set("bio")} error={errors.bio} maxLength={1000} />
      <FormInput label="Skills" value={form.skills} onChange={set("skills")} error={errors.skills} hint="Separate with commas, e.g. Python, statistics, R" />
      <FormInput label="GitHub link" type="url" value={form.github_url} onChange={set("github_url")} error={errors.github_url} placeholder="https://github.com/your-name" />
      <FormInput label="LinkedIn link" type="url" value={form.linkedin_url} onChange={set("linkedin_url")} error={errors.linkedin_url} placeholder="https://www.linkedin.com/in/your-name" />
      <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Saving..." : "Save profile"}</button>
    </form>
  );
}

function PasswordForm() {
  const toast = useToast();
  const empty = { current_password: "", new_password: "", confirm: "" };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    const found = collectErrors({
      current_password: () => (form.current_password ? "" : "Enter your current password."),
      new_password: () => validatePassword(form.new_password),
      confirm: () => (form.confirm === form.new_password ? "" : "Passwords do not match."),
    });
    setErrors(found);
    setFormError("");
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      await userService.changePassword({ current_password: form.current_password, new_password: form.new_password });
      toast.success("Password updated. Other devices have been signed out.");
      setForm(empty);
    } catch (err) {
      const apiError = toApiError(err);
      setFormError(apiError.fieldErrors?.new_password || apiError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card" onSubmit={onSubmit} noValidate aria-labelledby="password-title">
      <h2 id="password-title">Change password</h2>
      <FormBanner message={formError} />
      <FormInput label="Current password" type="password" autoComplete="current-password" value={form.current_password} onChange={set("current_password")} error={errors.current_password} required />
      <FormInput label="New password" type="password" autoComplete="new-password" value={form.new_password} onChange={set("new_password")} error={errors.new_password} hint="At least 10 characters." required />
      <FormInput label="Confirm new password" type="password" autoComplete="new-password" value={form.confirm} onChange={set("confirm")} error={errors.confirm} required />
      <button type="submit" className="btn btn-secondary" disabled={busy}>{busy ? "Updating..." : "Update password"}</button>
    </form>
  );
}

export default function Profile() {
  return (
    <div className="stack" style={{ maxWidth: 640 }}>
      <header className="page-header">
        <p className="eyebrow">My profile</p>
        <h1>Profile and security</h1>
      </header>
      <ProfileForm />
      <PasswordForm />
    </div>
  );
}
