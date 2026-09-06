import { useEffect, useState } from "react";
import { KeyRound, Monitor, Moon, ScrollText, Sun, UserRound } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useApi } from "../../hooks/useApi";
import { useDocumentTitle } from "../../hooks/useUi";
import { useToast } from "../../contexts/ToastContext";
import { api } from "../../services/api";
import { useTheme } from "../../contexts/ThemeContext";
import { PERMISSIONS, type AuditLogEntry } from "../../types";
import { apiErrorMessage, formatDateTime } from "../../lib/utils";
import { Button } from "../../components/ui/Button";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Avatar, PageHeader } from "../../components/ui/base";
import { Field, Input, Select } from "../../components/ui/Form";
import { SkeletonRows, EmptyState } from "../../components/ui/Feedback";
import { Badge } from "../../components/ui/Badge";
import { cn } from "../../lib/utils";
import { useMutation } from "../../hooks/useApi";
import { Pagination } from "../../components/ui/Pagination";

export default function SettingsPage() {
  useDocumentTitle("Settings");
  const { me, refreshMe } = useAuth();
  const { theme, preference, setPreference } = useTheme();
  const toast = useToast();
  const isOwner = me?.role === "owner";
  const canManageOrg = me?.permissions.includes(PERMISSIONS.orgManage) ?? false;

  const [profileName, setProfileName] = useState(me?.user.full_name ?? "");
  const [profileEmail, setProfileEmail] = useState(me?.user.email ?? "");
  const [passwords, setPasswords] = useState({ current_password: "", new_password: "" });
  const [orgForm, setOrgForm] = useState({
    name: me?.organization.name ?? "",
    currency: me?.organization.currency ?? "USD",
    low_stock_threshold: me?.organization.low_stock_threshold ?? 15,
  });

  useEffect(() => {
    if (me) {
      setProfileName(me.user.full_name);
      setProfileEmail(me.user.email);
      setOrgForm({
        name: me.organization.name,
        currency: me.organization.currency,
        low_stock_threshold: me.organization.low_stock_threshold ?? 15,
      });
    }
  }, [me]);

  const profileMutation = useMutation(async ({ name, email }: { name: string; email: string }) => {
    if (name !== me?.user.full_name) await api.put("/api/settings/profile", { full_name: name });
    // Only touch the email endpoint when it actually changed (avoids a needless
    // uniqueness round-trip and audit noise).
    if (email.toLowerCase() !== me?.user.email.toLowerCase()) await api.put("/api/settings/email", { email });
  });

  const saveProfile = async () => {
    try {
      await profileMutation.run({ name: profileName.trim(), email: profileEmail.trim() });
      await refreshMe();
      toast.success("Profile updated");
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  const passwordMutation = useMutation(async (payload: { current_password: string; new_password: string }) => api.put("/api/settings/password", payload));

  const changePassword = async () => {
    if (passwords.new_password.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    try {
      await passwordMutation.run(passwords);
      toast.success("Password changed");
      setPasswords({ current_password: "", new_password: "" });
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  type OrgPayload = { name: string; currency: string; low_stock_threshold: number };
  const orgMutation = useMutation(async (payload: OrgPayload) => api.put<OrgPayload>("/api/settings/organization", payload));

  const saveOrg = async () => {
    if (orgForm.name.trim().length < 2) {
      toast.error("Organization name must be at least 2 characters.");
      return;
    }
    try {
      const updated = await orgMutation.run({ ...orgForm, name: orgForm.name.trim() });
      toast.success("Organization updated");
      setOrgForm({ name: updated.name, currency: updated.currency, low_stock_threshold: updated.low_stock_threshold });
      await refreshMe();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Settings" description="Manage your profile, security, organization and appearance." />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* Profile card */}
        <Card className="flex-1">
          <CardHeader title="Profile" subtitle="How you appear across the workspace" />
          <CardBody className="space-y-5">
            <div className="flex items-center gap-4">
              <Avatar name={me?.user.full_name ?? "?"} size="lg" />
              <div>
                <p className="font-semibold text-ink">{me?.user.full_name}</p>
                <p className="text-sm text-muted">{me?.user.email}</p>
                <Badge tone="blue" className="mt-1">{me?.role}</Badge>
              </div>
            </div>
            <Field label="Full name">
              <Input value={profileName} onChange={(e) => setProfileName(e.target.value)} />
            </Field>
            <Field label="Email" hint="Changing your email is immediate.">
              <Input type="email" value={profileEmail} onChange={(e) => setProfileEmail(e.target.value)} />
            </Field>
            <Button onClick={() => void saveProfile()} loading={profileMutation.loading} leftIcon={<UserRound className="h-4 w-4" />}>
              Save profile
            </Button>
          </CardBody>
        </Card>

        {/* Appearance */}
        <Card className="w-full lg:w-80">
          <CardHeader title="Appearance" />
          <CardBody className="space-y-1.5">
            {([
              { value: "light", label: "Light", icon: Sun },
              { value: "dark", label: "Dark", icon: Moon },
              { value: "system", label: "System", icon: Monitor },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPreference(opt.value)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border px-3.5 py-2.5 text-sm font-medium transition",
                  preference === opt.value ? "border-primary-500 bg-primary-50/60 text-primary-700 dark:bg-primary-500/10 dark:text-primary-400" : "border-border text-ink hover:bg-ink/[0.03] dark:hover:bg-white/[0.05]"
                )}
                aria-pressed={preference === opt.value}
              >
                <opt.icon className="h-4 w-4" />
                {opt.label}
                <span className="ml-auto text-xs text-muted">{theme === opt.value && "active"}</span>
              </button>
            ))}
            <p className="pt-2 text-xs text-muted">Persisted on this device; charts adapt to both themes.</p>
          </CardBody>
        </Card>
      </div>

      {/* Security */}
      <Card>
        <CardHeader title="Security" subtitle="Change your password — sessions stay signed in" />
        <CardBody className="grid gap-4 md:grid-cols-2">
          <Field label="Current password">
            <Input type="password" value={passwords.current_password} onChange={(e) => setPasswords((p) => ({ ...p, current_password: e.target.value }))} placeholder="••••••••" autoComplete="current-password" />
          </Field>
          <Field label="New password" hint="Minimum 8 chars with a number and uppercase letter.">
            <Input type="password" value={passwords.new_password} onChange={(e) => setPasswords((p) => ({ ...p, new_password: e.target.value }))} placeholder="••••••••" autoComplete="new-password" />
          </Field>
          <div className="md:col-span-2">
            <Button variant="outline" onClick={() => void changePassword()} loading={passwordMutation.loading} leftIcon={<KeyRound className="h-4 w-4" />}>
              Update password
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Organization */}
      <Card>
        <CardHeader title="Organization" subtitle={canManageOrg ? "Owned by you — changes apply to everyone" : "Only the owner can change organization settings"} />
        <CardBody className="grid gap-4 md:grid-cols-2">
          <Field label="Organization name">
            <Input value={orgForm.name} onChange={(e) => setOrgForm((f) => ({ ...f, name: e.target.value }))} disabled={!canManageOrg} />
          </Field>
          <Field label="Currency">
            <Select value={orgForm.currency} onChange={(e) => setOrgForm((f) => ({ ...f, currency: e.target.value }))} disabled={!canManageOrg}>
              {["USD", "EUR", "GBP", "CAD", "AUD", "INR", "JPY", "BRL", "AED", "SGD"].map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Low-stock threshold" hint="Active products at or below this quantity are flagged on the dashboard and in Products.">
            <Input
              type="number"
              min={0}
              max={100000}
              value={orgForm.low_stock_threshold}
              onChange={(e) => setOrgForm((f) => ({ ...f, low_stock_threshold: Math.max(0, Number(e.target.value) || 0) }))}
              disabled={!canManageOrg}
            />
          </Field>
          <div className="md:col-span-2 flex items-center justify-between">
            <div className="text-sm text-muted">
              Plan <Badge tone="violet" className="ml-2 capitalize">{me?.organization.plan ?? "free"}</Badge>
              <p className="mt-0.5 text-xs">Workspace id {me?.organization.id} · slug <span className="font-mono">{me?.organization.slug}</span></p>
            </div>
            {canManageOrg && (
              <Button onClick={() => void saveOrg()} loading={orgMutation.loading}>Save organization</Button>
            )}
          </div>
        </CardBody>
      </Card>

      {isOwner && <AuditLogSection />}
    </div>
  );
}

function AuditLogSection() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState("");
  const params = new URLSearchParams({ page: String(page), page_size: "25" });
  if (actionFilter) params.set("action", actionFilter);
  const qs = params.toString();
  const { data, loading, error, refetch } = useApi<{ items: AuditLogEntry[]; total: number; page: number; pages: number }>(`/api/audit-logs?${qs}`, `${actionFilter}-${page}`);

  return (
    <Card>
      <CardHeader
        title="Audit log"
        subtitle="Owner-only trail of sensitive actions in your organization"
        actions={
          <div className="flex items-center gap-2">
            <Input value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1); }} placeholder="Filter by action…" className="h-8 w-48 text-xs" aria-label="Filter audit actions" />
          </div>
        }
      />
      {loading ? (
        <div className="p-5"><SkeletonRows rows={5} /></div>
      ) : error ? (
        <div className="p-6 text-center"><p className="text-sm text-muted">Unable to load audit logs.</p><Button variant="ghost" size="sm" onClick={refetch} className="mt-2">Retry</Button></div>
      ) : data && data.items.length > 0 ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted">
                  <th className="px-5 py-2.5 font-semibold">Action</th>
                  <th className="px-5 py-2.5 font-semibold">Actor</th>
                  <th className="px-5 py-2.5 font-semibold">Resource</th>
                  <th className="px-5 py-2.5 font-semibold">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {data.items.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-5 py-2.5">
                      <span className="font-mono text-xs font-medium text-ink">{entry.action}</span>
                    </td>
                    <td className="px-5 py-2.5 text-muted">{entry.user_name}</td>
                    <td className="px-5 py-2.5 text-muted">
                      {entry.resource_type} {entry.resource_id ? `#${entry.resource_id}` : ""}
                    </td>
                    <td className="px-5 py-2.5 text-muted">{formatDateTime(entry.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} pages={data.pages} total={data.total} onPageChange={setPage} />
        </>
      ) : (
        <EmptyState icon={<ScrollText className="h-6 w-6" />} title="No audit events" message="Sensitive actions like product deletion and role changes are recorded here." className="py-10" />
      )}
    </Card>
  );
}
