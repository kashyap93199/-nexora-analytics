import { useState } from "react";
import { Link } from "react-router-dom";
import { DollarSign, Pencil, Plus, ShoppingBag, Target, Trash2, Users, Wallet } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useApi, useMutation } from "../../hooks/useApi";
import { useDocumentTitle } from "../../hooks/useUi";
import { useToast } from "../../contexts/ToastContext";
import { api } from "../../services/api";
import { PERMISSIONS, type Goal } from "../../types";
import { apiErrorMessage, formatCurrency as fc, formatDate, formatNumber } from "../../lib/utils";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Field, Input, Select } from "../../components/ui/Form";
import { Modal, ConfirmDialog } from "../../components/ui/Modal";
import { EmptyState, ErrorState, SkeletonRows } from "../../components/ui/Feedback";
import { PageHeader, ProgressBar } from "../../components/ui/base";
import { cn } from "../../lib/utils";

const TYPE_META: Record<Goal["type"], { icon: typeof Target; label: string; tone: string }> = {
  revenue: { icon: DollarSign, label: "Revenue", tone: "text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10" },
  orders: { icon: ShoppingBag, label: "Orders", tone: "text-blue-500 bg-blue-50 dark:bg-blue-500/10" },
  customers: { icon: Users, label: "Customers", tone: "text-violet-500 bg-violet-50 dark:bg-violet-500/10" },
  profit: { icon: Wallet, label: "Profit", tone: "text-amber-500 bg-amber-50 dark:bg-amber-500/10" },
};

export default function GoalsPage() {
  const { me, hasPermission } = useAuth();
  const currency = me?.organization.currency ?? "USD";
  useDocumentTitle("Goals");
  const toast = useToast();
  const canManage = hasPermission(PERMISSIONS.goalsManage);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Goal | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Goal | null>(null);
  const [filter, setFilter] = useState<"all" | Goal["type"]>("all");

  const { data, loading, error, refetch } = useApi<Goal[]>("/api/goals");

  const goals = (data ?? []).filter((g) => filter === "all" || g.type === filter);
  const activeGoals = (data ?? []).filter((g) => g.status === "active");

  const isMoney = (type: string) => type === "revenue" || type === "profit";
  const fmtValue = (type: string, v: number) => (isMoney(type) ? fc(v, currency) : formatNumber(v));

  const deleteMutation = useMutation(async () => api.delete(`/api/goals/${deleteTarget?.id}`));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Goals"
        description="Set targets for revenue, orders, customers and profit — progress is computed live from your data."
        actions={
          canManage && (
            <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>New goal</Button>
          )
        }
      />

      {error ? (
        <ErrorState message="Unable to load goals." onRetry={refetch} className="mt-6" />
      ) : loading ? (
        <SkeletonRows rows={5} className="mt-6" />
      ) : goals.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Target className="h-6 w-6" />}
            title={filter === "all" ? "No goals yet" : "No goals of this type"}
            message="Goals make numbers meaningful. Set your first target — progress updates automatically."
            action={canManage ? <Button size="sm" onClick={() => setCreateOpen(true)}>Create a goal</Button> : undefined}
          />
        </Card>
      ) : (
        <>
          {/* Filter chips */}
          <div className="flex flex-wrap items-center gap-2">
            {(["all", "revenue", "orders", "customers", "profit"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={cn("rounded-full px-3.5 py-1.5 text-[13px] font-medium capitalize transition", filter === t ? "bg-primary-600 text-white" : "border border-border bg-card text-muted hover:text-ink")}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {goals.map((goal) => {
              const meta = TYPE_META[goal.type];
              const done = (goal.progress_pct ?? 0) >= 100;
              const Icon = meta.icon;
              return (
                <Card key={goal.id} className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", meta.tone.split(" ").slice(1).join(" "))}>
                        <Icon className={cn("h-5 w-5", meta.tone.split(" ")[0])} />
                      </span>
                      <div>
                        <h3 className="font-semibold text-ink">{goal.name}</h3>
                        <p className="text-xs capitalize text-muted">{goal.period} · {goal.type} goal</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge tone={goal.status === "completed" ? "green" : goal.status === "archived" ? "gray" : done ? "green" : "blue"} dot>
                        {goal.status === "archived" ? "Archived" : done ? "Completed" : "Active"}
                      </Badge>
                      {canManage && (
                        <>
                          <button onClick={() => setEditTarget(goal)} className="rounded-md p-1.5 text-muted hover:bg-ink/[0.05] hover:text-ink dark:hover:bg-white/[0.08]" aria-label={`Edit ${goal.name}`}>
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setDeleteTarget(goal)} className="rounded-md p-1.5 text-muted hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400" aria-label={`Delete ${goal.name}`}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 flex items-end justify-between">
                    <div>
                      <p className="text-2xl font-bold text-ink tabular">{fmtValue(goal.type, goal.progress ?? 0)}</p>
                      <p className="text-xs text-muted">target {fmtValue(goal.type, goal.target)}</p>
                    </div>
                    <p className={cn("text-sm font-bold tabular", done ? "text-emerald-600 dark:text-emerald-400" : "text-ink")}>
                      {(goal.progress_pct ?? 0).toFixed(1)}%
                    </p>
                  </div>
                  <ProgressBar value={goal.progress_pct ?? 0} className="mt-3" />
                  <p className="mt-3 text-[11px] text-muted">
                    {formatDate(goal.starts_at)} → {formatDate(goal.ends_at)}
                    {isMoney(goal.type) && <span className="ml-2">· <Link to="/app/analytics" className="text-primary-600 hover:underline dark:text-primary-400">view trend</Link></span>}
                  </p>
                </Card>
              );
            })}
          </div>

          {activeGoals.length > 0 && (
            <Card>
              <CardHeader title="Overall progress" subtitle={`${activeGoals.filter((g) => (g.progress_pct ?? 0) >= 100).length} of ${activeGoals.length} active goals completed`} />
              <div className="grid gap-x-8 gap-y-4 p-5 md:grid-cols-2">
                {activeGoals.map((g) => (
                  <div key={g.id}>
                    <div className="mb-1 flex justify-between text-[13px]">
                      <span className="font-medium text-ink">{g.name}</span>
                      <span className="text-muted tabular">{(g.progress_pct ?? 0).toFixed(1)}%</span>
                    </div>
                    <ProgressBar value={g.progress_pct ?? 0} />
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      {createOpen && (
        <GoalFormModal
          mode="create"
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onDone={(msg) => { toast.success(msg); refetch(); }}
          onError={(err) => toast.error(apiErrorMessage(err))}
        />
      )}
      {editTarget && (
        <GoalFormModal
          mode="edit"
          open={Boolean(editTarget)}
          goal={editTarget}
          onClose={() => setEditTarget(null)}
          onDone={(msg) => { toast.success(msg); refetch(); }}
          onError={(err) => toast.error(apiErrorMessage(err))}
        />
      )}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete goal"
        message={<>Delete <strong>{deleteTarget?.name}</strong>? Progress history for this goal will be removed.</>}
        confirmLabel="Delete goal"
        loading={deleteMutation.loading}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() =>
          void deleteMutation
            .run(undefined)
            .then(() => { toast.success("Goal deleted"); setDeleteTarget(null); refetch(); })
            .catch((err) => toast.error(apiErrorMessage(err)))
        }
      />
    </div>
  );
}

function GoalFormModal({
  mode,
  open,
  onClose,
  goal,
  onDone,
  onError,
}: {
  mode: "create" | "edit";
  open: boolean;
  onClose: () => void;
  goal?: Goal;
  onDone: (msg: string) => void;
  onError: (err: unknown) => void;
}) {
  const [form, setForm] = useState({
    name: goal?.name ?? "",
    type: goal?.type ?? "revenue",
    target: goal ? String(goal.target) : "",
    period: goal?.period ?? "monthly",
    starts_at: goal ? goal.starts_at.slice(0, 10) : "",
    ends_at: goal ? goal.ends_at.slice(0, 10) : "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const mutation = useMutation(async (payload: Record<string, unknown>) => {
    if (mode === "create") return api.post<{ id: number }>("/api/goals", payload);
    return api.put<{ id: number }>(`/api/goals/${goal?.id}`, payload);
  });

  const submit = async () => {
    const next: Record<string, string> = {};
    if (form.name.trim().length < 2) next.name = "Give the goal a name.";
    if (!form.target || Number(form.target) <= 0) next.target = "Enter a positive target.";
    if (!form.starts_at || !form.ends_at || form.ends_at <= form.starts_at) next.dates = "End date must follow the start date.";
    setErrors(next);
    if (Object.keys(next).length) return;
    try {
      await mutation.run({
        name: form.name.trim(),
        type: form.type,
        target: Number(form.target),
        period: form.period,
        starts_at: `${form.starts_at}T00:00:00`,
        ends_at: `${form.ends_at}T23:59:59`,
      });
      onDone(mode === "create" ? "Goal created — progress is tracking live" : "Goal updated");
      onClose();
    } catch (err) {
      onError(err);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "create" ? "Create goal" : "Edit goal"}
      description="Progress is calculated from orders, customers and sales within the goal window."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.loading}>Cancel</Button>
          <Button onClick={() => void submit()} loading={mutation.loading}>{mode === "create" ? "Create goal" : "Save changes"}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Goal name" required error={errors.name}>
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Monthly revenue goal" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as Goal["type"] }))}>
              {(["revenue", "orders", "customers", "profit"] as Goal["type"][]).map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Target" required error={errors.target}>
            <Input type="number" min="0" value={form.target} onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))} placeholder="150000" />
          </Field>
        </div>
        <Field label="Period">
          <Select value={form.period} onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))}>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts" required>
            <Input type="date" value={form.starts_at} onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))} />
          </Field>
          <Field label="Ends" required error={errors.dates}>
            <Input type="date" value={form.ends_at} onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
