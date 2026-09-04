import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Mail, MapPin, Pencil, Phone, ShoppingBag, Trash2 } from "lucide-react";
import { useApi } from "../../hooks/useApi";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { api } from "../../services/api";
import { useDocumentTitle } from "../../hooks/useUi";
import { PERMISSIONS, type CustomerDetailResponse } from "../../types";
import { apiErrorMessage, formatCurrency as fc, formatDate, formatNumber } from "../../lib/utils";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { Avatar, PageHeader } from "../../components/ui/base";
import { SegmentBadge, OrderStatusBadge } from "../../components/ui/Badge";
import { ConfirmDialog, Modal } from "../../components/ui/Modal";
import { EmptyState, ErrorState, PageLoader } from "../../components/ui/Feedback";
import { Field, Input, Select } from "../../components/ui/Form";
import { useMutation } from "../../hooks/useApi";

const REGIONS = ["North America", "Europe", "Asia Pacific", "Latin America", "Middle East", "Africa"];

export default function CustomerDetailPage() {
  const { customerId } = useParams();
  const { me, hasPermission } = useAuth();
  const currency = me?.organization.currency ?? "USD";
  const toast = useToast();
  const navigate = useNavigate();
  const canManage = hasPermission(PERMISSIONS.customersManage);
  useDocumentTitle("Customer");

  const { data, loading, error, refetch } = useApi<CustomerDetailResponse>(`/api/customers/${customerId}`);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteMutation = useMutation(async () => api.delete(`/api/customers/${customerId}`));

  const customer = data?.customer;

  const stats = [
    { label: "Total spent", value: fc(customer?.total_spent ?? 0, currency) },
    { label: "Orders", value: formatNumber(customer?.order_count ?? 0) },
    { label: "Avg. order value", value: fc(customer && customer.order_count ? customer.total_spent! / customer.order_count : 0, currency) },
    { label: "Last purchase", value: formatDate(customer?.last_order_at) },
  ];

  if (loading) return <PageLoader label="Loading customer…" />;
  if (error || !data) {
    return (
      <div className="space-y-4">
        <Link to="/app/customers" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Customers</Link>
        <ErrorState message="Unable to load this customer." onRetry={refetch} className="mt-6" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to="/app/customers" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Customers
      </Link>

      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Avatar name={data.customer.name} size="lg" />
            {data.customer.name}
            <SegmentBadge segment={data.customer.segment} />
          </span>
        }
        description={data.customer.email}
        actions={
          canManage && (
            <>
              <Button variant="outline" leftIcon={<Pencil className="h-4 w-4" />} onClick={() => setEditOpen(true)}>Edit</Button>
              <Button variant="ghost" className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10" leftIcon={<Trash2 className="h-4 w-4" />} onClick={() => setDeleteOpen(true)}>
                Delete
              </Button>
            </>
          )
        }
      />

      {/* Contact card + stats */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <div className="border-b border-border px-5 py-4"><h3 className="text-sm font-semibold text-ink">Contact</h3></div>
          <ul className="space-y-3 p-5 text-sm">
            <li className="flex items-center gap-2.5 text-muted"><Mail className="h-4 w-4 shrink-0 text-muted" /> {data.customer.email}</li>
            <li className="flex items-center gap-2.5 text-muted"><Phone className="h-4 w-4 shrink-0 text-muted" /> {data.customer.phone ?? "—"}</li>
            <li className="flex items-center gap-2.5 text-muted"><MapPin className="h-4 w-4 shrink-0 text-muted" /> {[data.customer.city, data.customer.region].filter(Boolean).join(", ") || "—"}</li>
          </ul>
          <div className="border-t border-border px-5 py-3.5 text-xs text-muted">Joined {formatDate(data.customer.created_at)}</div>
        </Card>
        <div className="grid grid-cols-2 gap-4 lg:col-span-2">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted">{s.label}</p>
              <p className="mt-1 truncate text-xl font-bold text-ink tabular">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Purchase history */}
      <Card>
        <CardHeader title="Purchase history" subtitle={`${data.orders.length} orders recorded`} />
        {data.orders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted">
                  <th className="px-5 py-2.5 font-semibold">Order</th>
                  <th className="px-5 py-2.5 font-semibold">Date</th>
                  <th className="px-5 py-2.5 font-semibold">Channel</th>
                  <th className="px-5 py-2.5 font-semibold">Items</th>
                  <th className="px-5 py-2.5 font-semibold">Status</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {data.orders.map((o) => (
                  <tr key={o.id} className="transition hover:bg-ink/[0.02] dark:hover:bg-white/[0.02]">
                    <td className="px-5 py-3">
                      <Link to={`/app/orders/${o.id}`} className="flex items-center gap-1.5 font-medium text-primary-600 hover:underline dark:text-primary-400">
                        <ShoppingBag className="h-3.5 w-3.5" /> {o.order_number}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-muted">{formatDate(o.placed_at)}</td>
                    <td className="px-5 py-3 capitalize text-muted">{o.channel.replace("_", " ")}</td>
                    <td className="px-5 py-3 tabular text-ink">{o.items_count}</td>
                    <td className="px-5 py-3"><OrderStatusBadge status={o.status} /></td>
                    <td className="px-5 py-3 text-right font-semibold text-ink tabular">{fc(o.total, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No orders yet" message="This customer hasn't placed any orders." className="py-10" />
        )}
      </Card>

      <EditCustomerModal open={editOpen} onClose={() => setEditOpen(false)} customer={data.customer} onSaved={refetch} toast={(msg, kind) => (kind === "error" ? toast.error(msg) : toast.success(msg))} />
      <ConfirmDialog
        open={deleteOpen}
        title="Delete customer"
        message={<>This will permanently remove <strong>{data.customer.name}</strong> and their profile from your organization.</>}
        confirmLabel="Delete customer"
        loading={deleteMutation.loading}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() =>
          void deleteMutation
            .run(undefined)
            .then(() => { toast.success("Customer deleted"); navigate("/app/customers"); })
            .catch((err) => toast.error(apiErrorMessage(err)))
        }
      />
    </div>
  );
}

function EditCustomerModal({
  open,
  onClose,
  customer,
  onSaved,
  toast,
}: {
  open: boolean;
  onClose: () => void;
  customer: { id: number; name: string; email: string; phone: string | null; city: string | null; region: string | null; segment: string };
  onSaved: () => void;
  toast: (msg: string, kind: "success" | "error") => void;
}) {
  const [form, setForm] = useState({
    name: customer.name,
    email: customer.email,
    phone: customer.phone ?? "",
    city: customer.city ?? "",
    region: customer.region ?? "",
    segment: customer.segment,
  });
  const mutation = useMutation(async (payload: typeof form) => api.put(`/api/customers/${customer.id}`, payload));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await mutation.run(form);
      toast("Customer updated", "success");
      onSaved();
      onClose();
    } catch (err) {
      toast(apiErrorMessage(err), "error");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit customer"
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.loading}>Cancel</Button>
          <Button type="submit" form="edit-customer-form" loading={mutation.loading}>Save changes</Button>
        </>
      }
    >
      <form id="edit-customer-form" onSubmit={(e) => void submit(e)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Full name" required>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label="Email" required>
            <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </Field>
          <Field label="Phone">
            <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </Field>
          <Field label="Segment">
            <Select value={form.segment} onChange={(e) => setForm((f) => ({ ...f, segment: e.target.value }))}>
              {["new", "returning", "vip", "inactive"].map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="City">
            <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
          </Field>
          <Field label="Region">
            <Select value={form.region} onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}>
              <option value="">—</option>
              {REGIONS.map((r) => <option key={r}>{r}</option>)}
            </Select>
          </Field>
        </div>
      </form>
    </Modal>
  );
}
