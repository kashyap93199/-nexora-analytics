import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { apiErrorMessage } from "../../lib/utils";
import { validateRegistration, type RegistrationErrors, type RegistrationForm } from "../../lib/validation";
import { Button } from "../../components/ui/Button";
import { Field, Input } from "../../components/ui/Form";
import { AuthShell } from "./AuthShell";

const EMPTY: RegistrationForm = { full_name: "", email: "", password: "", organization_name: "" };

export default function RegisterPage() {
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const inviteToken = params.get("invite") ?? undefined;

  const [form, setForm] = useState<RegistrationForm>(EMPTY);
  const [errors, setErrors] = useState<RegistrationErrors>({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (key: keyof RegistrationForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
    setServerError("");
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const validation = validateRegistration(form);
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;
    setLoading(true);
    setServerError("");
    try {
      await register({ ...form, invite_token: inviteToken });
      toast.success(inviteToken ? "Welcome to your team workspace!" : "Your workspace is ready 🎉");
      navigate("/app/overview", { replace: true });
    } catch (err) {
      setServerError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title={inviteToken ? "Accept your invitation" : "Create your account"}>
      {inviteToken && (
        <p className="mb-5 rounded-lg border border-primary-200 bg-primary-50 px-3.5 py-2.5 text-[13px] text-primary-800 dark:border-primary-500/20 dark:bg-primary-500/10 dark:text-primary-300">
          You've been invited to a team. Sign up with the same email the invitation was sent to.
        </p>
      )}
      <form onSubmit={(e) => void submit(e)} className="space-y-4" noValidate>
        {serverError && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
            {serverError}
          </div>
        )}
        <Field label="Full name" htmlFor="full_name" required error={errors.full_name}>
          <Input id="full_name" autoComplete="name" placeholder="Alex Morgan" value={form.full_name} onChange={set("full_name")} />
        </Field>
        <Field label="Work email" htmlFor="email" required error={errors.email}>
          <Input id="email" type="email" autoComplete="email" placeholder="you@company.com" value={form.email} onChange={set("email")} />
        </Field>
        <Field label="Password" htmlFor="password" required error={errors.password} hint="Minimum 8 characters with a number and an uppercase letter.">
          <Input id="password" type="password" autoComplete="new-password" placeholder="••••••••" value={form.password} onChange={set("password")} />
        </Field>
        {!inviteToken && (
          <Field label="Organization name" htmlFor="organization_name" required error={errors.organization_name} hint="You'll be the Owner of this workspace.">
            <Input id="organization_name" autoComplete="organization" placeholder="Acme Inc" value={form.organization_name} onChange={set("organization_name")} />
          </Field>
        )}
        <Button type="submit" loading={loading} className="w-full" size="lg">
          {inviteToken ? "Join workspace" : "Create workspace"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link to="/login" className="font-semibold text-primary-600 hover:underline dark:text-primary-400">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
