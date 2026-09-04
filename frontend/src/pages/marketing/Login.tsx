import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Sparkles } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { apiErrorMessage } from "../../lib/utils";
import { Button } from "../../components/ui/Button";
import { Field, Input } from "../../components/ui/Form";
import { AuthShell } from "./AuthShell";

const DEMO_EMAIL = "demo@nexora.app";
const DEMO_PASSWORD = "DemoPassword123!";

export default function LoginPage() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Welcome back 👋");
      navigate(location.state?.from ?? "/app/overview", { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = async () => {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    setError("");
    setLoading(true);
    try {
      await login(DEMO_EMAIL, DEMO_PASSWORD);
      toast.success("Signed in to the demo workspace");
      navigate("/app/overview", { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Welcome back">
      <button
        onClick={() => void fillDemo()}
        className="mb-5 flex w-full items-center justify-center gap-2 rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-700 transition hover:bg-primary-100 dark:border-primary-500/20 dark:bg-primary-500/10 dark:text-primary-400 dark:hover:bg-primary-500/20"
      >
        <Sparkles className="h-4 w-4" />
        Explore the live demo account
      </button>
      <div className="relative mb-5 text-center">
        <span className="relative z-10 bg-surface px-3 text-xs uppercase tracking-wider text-muted">or sign in with email</span>
        <span className="absolute inset-x-0 top-1/2 h-px bg-border" aria-hidden />
      </div>

      <form onSubmit={(e) => void submit(e)} className="space-y-4" noValidate>
        {error && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
            {error}
          </div>
        )}
        <Field label="Work email" htmlFor="email" required>
          <Input id="email" type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password" htmlFor="password" required>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>
        <Button type="submit" loading={loading} className="w-full" size="lg">
          Sign in
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Don't have an account?{" "}
        <Link to="/register" className="font-semibold text-primary-600 hover:underline dark:text-primary-400">
          Start free
        </Link>
      </p>
    </AuthShell>
  );
}
