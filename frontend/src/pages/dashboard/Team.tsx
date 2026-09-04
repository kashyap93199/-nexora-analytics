import { useState } from "react";
import { Check, Link2, MailPlus, Trash2, UserPlus, Users } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useApi, useMutation } from "../../hooks/useApi";
import { useDocumentTitle } from "../../hooks/useUi";
import { useToast } from "../../contexts/ToastContext";
import { api } from "../../services/api";
import { PERMISSIONS, type Member } from "../../types";
import { apiErrorMessage, timeAgo } from "../../lib/utils";
import { Button } from "../../components/ui/Button";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Badge, RoleBadge } from "../../components/ui/Badge";
import { Avatar, PageHeader } from "../../components/ui/base";
import { ConfirmDialog, Modal } from "../../components/ui/Modal";
import { EmptyState, ErrorState, SkeletonRows } from "../../components/ui/Feedback";

const ROLES: { value: string; label: string; description: string }[] = [
  { value: "owner", label: "Owner", description: "Full access, including organization settings and audit logs." },
  { value: "admin", label: "Admin", description: "Almost full access — cannot manage the organization or audit logs." },
  { value: "manager", label: "Manager", description: "Business and sales management: products, orders, customers, goals." },
  { value: "analyst", label: "Analyst", description: "Analytics, reports and exports — read access to business data." },
  { value: "viewer", label: "Viewer", description: "Read-only access across the dashboard." },
];

export default function TeamPage() {
  const { me, hasPermission } = useAuth();
  const toast = useToast();
  useDocumentTitle("Team");
  const canManage = hasPermission(PERMISSIONS.teamManage);
  const isOwner = me?.role === "owner";

  const [inviteOpen, setInviteOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null);

  const { data, loading, error, refetch } = useApi<Member[]>("/api/team");
  const roleMutation = useMutation(async ({ memberId, role }: { memberId: number; role: string }) => api.put(`/api/team/${memberId}/role`, { role }));
  const removeMutation = useMutation(async () => api.delete(`/api/team/${removeTarget?.id}`));

  const changeRole = async (memberId: number, role: string) => {
    try {
      await roleMutation.run({ memberId, role });
      toast.success("Role updated");
      refetch();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  const copyInvite = async (token: string) => {
    const url = `${window.location.origin}/register?invite=${token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Invite link copied");
    } catch {
      toast.info(`Invite link: ${url}`);
    }
  };

  const members = data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team"
        description="Manage who has access to this workspace and what they can do."
        actions={
          canManage && (
            <Button leftIcon={<UserPlus className="h-4 w-4" />} onClick={() => setInviteOpen(true)}>Invite member</Button>
          )
        }
      />

      {/* Role guide */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {ROLES.map((role) => (
          <div key={role.value} className={`rounded-xl border p-4 ${me?.role === role.value ? "border-primary-400/70 bg-primary-50/40 dark:bg-primary-500/[0.06]" : "border-border bg-card"}`}>
            <p className="text-sm font-semibold text-ink">{role.label}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">{role.description}</p>
          </div>
        ))}
      </div>

      {/* Members */}
      <Card>
        <CardHeader title={`Members (${members.filter((m) => m.status === "active").length})`} subtitle="Invitations appear as pending until the user registers" />
        {loading ? (
          <div className="p-5"><SkeletonRows rows={5} /></div>
        ) : error ? (
          <ErrorState message="Unable to load your team." onRetry={refetch} className="py-10" />
        ) : members.length === 0 ? (
          <EmptyState icon={<Users className="h-6 w-6" />} title="No members yet" message="Invite teammates to collaborate on your workspace." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted">
                  <th className="px-5 py-2.5 font-semibold">Member</th>
                  <th className="px-5 py-2.5 font-semibold">Role</th>
                  <th className="px-5 py-2.5 font-semibold">Status</th>
                  <th className="px-5 py-2.5 font-semibold">Last active</th>
                  {canManage && <th className="px-5 py-2.5" aria-label="Actions" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {members.map((member) => {
                  const self = member.user_id === me?.user.id;
                  const canEditRole = canManage && !self && member.role !== "owner";
                  const canRemove = canManage && !self && member.role !== "owner";
                  return (
                    <tr key={member.id} className="transition hover:bg-ink/[0.02] dark:hover:bg-white/[0.02]">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={member.full_name} />
                          <div>
                            <p className="font-medium text-ink">
                              {member.full_name}
                              {self && <span className="ml-2 text-xs text-muted">(you)</span>}
                            </p>
                            <p className="text-xs text-muted">{member.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        {canEditRole ? (
                          <select
                            value={member.role}
                            onChange={(e) => void changeRole(member.id, e.target.value)}
                            className="h-8 rounded-lg border border-border bg-card px-2 text-[13px] font-medium text-ink"
                            aria-label={`Role for ${member.full_name}`}
                          >
                            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                          </select>
                        ) : (
                          <RoleBadge role={member.role} />
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {member.status === "active" ? (
                          <Badge tone="green" dot>Active</Badge>
                        ) : (
                          <Badge tone="amber" dot>Pending invite</Badge>
                        )}
                      </td>
                      <td className="px-5 py-3 text-muted">{timeAgo(member.last_active_at)}</td>
                      {canManage && (
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {canRemove && (
                              <button onClick={() => setRemoveTarget(member)} className="rounded-md p-1.5 text-muted transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400" aria-label={`Remove ${member.full_name}`}>
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Permissions note */}
      <Card>
        <CardHeader title="How permissions work" />
        <CardBody className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
          <p className="w-full">
            Permissions are enforced server-side on every request. Owners and admins can change roles; owners alone manage the organization.
          </p>
          {!isOwner && (
            <p className="w-full rounded-lg bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
              You're signed in as <strong>{me?.role}</strong> — owners and admins can do more here.
            </p>
          )}
        </CardBody>
      </Card>

      {inviteOpen && <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} onInvited={() => { refetch(); }} toastError={(err) => toast.error(apiErrorMessage(err))} onCopy={copyInvite} />}
      <ConfirmDialog
        open={Boolean(removeTarget)}
        title="Remove member"
        message={<>Remove <strong>{removeTarget?.full_name}</strong> from this workspace? They will lose access immediately.</>}
        confirmLabel="Remove member"
        loading={removeMutation.loading}
        onClose={() => setRemoveTarget(null)}
        onConfirm={() =>
          void removeMutation
            .run(undefined)
            .then(() => { toast.success("Member removed"); setRemoveTarget(null); refetch(); })
            .catch((err) => toast.error(apiErrorMessage(err)))
        }
      />
    </div>
  );
}

function InviteModal({
  open,
  onClose,
  onInvited,
  toastError,
  onCopy,
}: {
  open: boolean;
  onClose: () => void;
  onInvited: (inviteToken: string | null) => void;
  toastError: (err: unknown) => void;
  onCopy: (token: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("analyst");
  const [inviteResult, setInviteResult] = useState<{ message: string; token: string | null; email: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const mutation = useMutation(async (payload: { email: string; role: string }) =>
    api.post<{ message: string; invite_token: string | null }>("/api/team/invite", payload)
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!/^\S+@\S+\.\S+$/.test(email)) next.email = "Enter a valid email address.";
    setErrors(next);
    if (Object.keys(next).length) return;
    try {
      const result = await mutation.run({ email: email.trim(), role });
      setInviteResult({ message: result.message, token: result.invite_token ?? null, email: email.trim() });
      onInvited(result.invite_token ?? null);
      setEmail("");
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => { onClose(); setInviteResult(null); }}
      title="Invite a teammate"
      description="They'll join with the role you choose — permissions apply instantly."
      footer={
        inviteResult?.token ? (
          <Button onClick={() => onCopy(inviteResult.token!)} leftIcon={<Link2 className="h-4 w-4" />}>Copy invite link</Button>
        ) : (
          <>
            <Button variant="outline" onClick={() => { onClose(); setInviteResult(null); }} disabled={mutation.loading}>Close</Button>
            <Button type="submit" form="invite-form" loading={mutation.loading} leftIcon={<MailPlus className="h-4 w-4" />}>Send invitation</Button>
          </>
        )
      }
    >
      {inviteResult ? (
        <div className="space-y-4 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15"><Check className="h-6 w-6" /></span>
          <div>
            <h3 className="font-semibold text-ink">{inviteResult.message}</h3>
            {inviteResult.token ? (
              <p className="mt-2 text-sm text-muted">
                <strong className="text-ink">{inviteResult.email}</strong> doesn't have an account yet. Share the invite link so they can register
                and join your workspace — or use the button below to copy it.
              </p>
            ) : (
              <p className="mt-2 text-sm text-muted"><strong className="text-ink">{inviteResult.email}</strong> already has an account and will see a notification on next login.</p>
            )}
          </div>
        </div>
      ) : (
        <form id="invite-form" onSubmit={(e) => void submit(e)} className="space-y-4" noValidate>
          <div>
            <label htmlFor="invite-email" className="mb-1.5 block text-[13px] font-medium text-ink">Email address <span className="text-red-500">*</span></label>
            <input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@company.com"
              className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-ink placeholder:text-muted/70"
            />
            {errors.email && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.email}</p>}
          </div>
          <div>
            <label htmlFor="invite-role" className="mb-1.5 block text-[13px] font-medium text-ink">Role</label>
            <select id="invite-role" value={role} onChange={(e) => setRole(e.target.value)} className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-ink">
              {ROLES.filter((r) => r.value !== "owner").map((r) => <option key={r.value} value={r.value}>{r.label} — {r.description}</option>)}
            </select>
          </div>
        </form>
      )}
    </Modal>
  );
}
