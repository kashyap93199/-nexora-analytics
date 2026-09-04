import { useMemo, useState } from "react";
import { AlertTriangle, Package, PackagePlus, Pencil, Search, Trash2 } from "lucide-react";
import { useDateRange } from "../../contexts/DateRangeContext";
import { useAuth } from "../../contexts/AuthContext";
import { useApi, useMutation } from "../../hooks/useApi";
import { useDebounced, useDocumentTitle } from "../../hooks/useUi";
import { useToast } from "../../contexts/ToastContext";
import { api } from "../../services/api";
import { PERMISSIONS, type Category, type Product, type ProductPerformance } from "../../types";
import { apiErrorMessage, formatCurrency as fc, formatNumber } from "../../lib/utils";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Field, Input, Select, Textarea } from "../../components/ui/Form";
import { Modal, ConfirmDialog } from "../../components/ui/Modal";
import { EmptyState, ErrorState, SkeletonRows } from "../../components/ui/Feedback";
import { PageHeader } from "../../components/ui/base";
import { Pagination } from "../../components/ui/Pagination";
import { cn } from "../../lib/utils";

type ProductRow = ProductPerformance & {
  price: number;
  cost: number;
  status: string;
  sku: string;
  description: string;
};

export default function ProductsPage() {
  const { range } = useDateRange();
  const { me, hasPermission } = useAuth();
  const currency = me?.organization.currency ?? "USD";
  useDocumentTitle("Products");
  const toast = useToast();
  const canManage = hasPermission(PERMISSIONS.productsManage);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 350);
  const [categoryId, setCategoryId] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ProductRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductRow | null>(null);

  const qs = `start=${range.start}&end=${range.end}`;
  const analytics = useApi<{ performance: ProductPerformance[] }>(`/api/analytics/products?${qs}${categoryId ? `&category_id=${categoryId}` : ""}`, `${qs}-${categoryId}`);

  const catalog = useApi<{ items: (Product & { sku: string })[]; total: number; page: number; pages: number }>(
    `/api/products?search=${encodeURIComponent(debouncedSearch)}${categoryId ? `&category_id=${categoryId}` : ""}&page=${page}&page_size=25`,
    `${debouncedSearch}-${categoryId}-${page}`
  );
  const categories = useApi<Category[]>("/api/categories");

  const perfById = useMemo(() => new Map((analytics.data?.performance ?? []).map((p) => [p.id, p])), [analytics.data]);

  // Merge catalog rows with analytics performance for a single table.
  const rows: ProductRow[] = useMemo(
    () =>
      (catalog.data?.items ?? []).map((p) => {
        const perf = perfById.get(p.id);
        return {
          id: p.id,
          name: p.name,
          category: p.category_name,
          category_id: p.category_id,
          units_sold: perf?.units_sold ?? 0,
          revenue: perf?.revenue ?? 0,
          profit: perf?.profit ?? 0,
          margin: perf?.margin ?? 0,
          trend: perf?.trend ?? 0,
          stock: p.stock,
          status: p.status,
          price: p.price,
          cost: p.cost,
          sku: p.sku,
          description: p.description,
        };
      }),
    [catalog.data, perfById]
  );

  const totalUnits = rows.reduce((sum, r) => sum + r.units_sold, 0);
  const totalRevenue = rows.reduce((sum, r) => sum + r.revenue, 0);
  const lowStock = rows.filter((r) => r.stock <= 15 && r.status === "active").length;

  const refreshAll = () => {
    catalog.refetch();
    analytics.refetch();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="Catalog, inventory and performance — merged in one table."
        actions={
          canManage && (
            <Button leftIcon={<PackagePlus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
              Add product
            </Button>
          )
        }
      />

      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted">Products in catalog</p>
          <p className="mt-1 text-xl font-bold text-ink tabular">{formatNumber(catalog.data?.total ?? 0)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted">Units sold (period)</p>
          <p className="mt-1 text-xl font-bold text-ink tabular">{formatNumber(totalUnits)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted">Revenue (period)</p>
          <p className="mt-1 text-xl font-bold text-ink tabular">{fc(totalRevenue, currency)}</p>
        </div>
        <div className={cn("rounded-xl border p-4", lowStock > 0 ? "border-amber-300/60 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/5" : "border-border bg-card")}>
          <p className="flex items-center gap-1.5 text-xs text-muted"><AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Low stock (&le;15)</p>
          <p className="mt-1 text-xl font-bold text-ink tabular">{lowStock}</p>
        </div>
      </div>

      <Card>
        <CardHeader title="Product performance" subtitle="Best sellers, margins and trend vs the previous period" />
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 pb-3.5 pt-1">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search products or SKU…" className="pl-9" aria-label="Search products" />
          </div>
          <Select value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPage(1); }} className="w-52" aria-label="Filter by category">
            <option value="">All categories</option>
            {(categories.data ?? []).map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
          </Select>
        </div>

        {catalog.error || analytics.error ? (
          <ErrorState message="Unable to load products." onRetry={refreshAll} className="py-10" />
        ) : catalog.loading || analytics.loading ? (
          <div className="p-5"><SkeletonRows rows={8} /></div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Package className="h-6 w-6" />}
            title="No products found"
            message={debouncedSearch || categoryId ? "Try a different search or category." : "Add your first product to start tracking performance."}
            action={canManage && !debouncedSearch && !categoryId ? <Button size="sm" leftIcon={<PackagePlus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>Add product</Button> : undefined}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted">
                    <th className="px-5 py-2.5 font-semibold">Product</th>
                    <th className="px-5 py-2.5 font-semibold">Category</th>
                    <th className="px-5 py-2.5 text-right font-semibold">Units sold</th>
                    <th className="px-5 py-2.5 text-right font-semibold">Revenue</th>
                    <th className="px-5 py-2.5 text-right font-semibold">Profit</th>
                    <th className="px-5 py-2.5 text-right font-semibold">Margin</th>
                    <th className="px-5 py-2.5 text-right font-semibold">Trend</th>
                    <th className="px-5 py-2.5 text-right font-semibold">Stock</th>
                    {canManage && <th className="px-5 py-2.5" aria-label="Actions" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {rows.map((p) => (
                    <tr key={p.id} className="transition hover:bg-ink/[0.02] dark:hover:bg-white/[0.02]">
                      <td className="px-5 py-3">
                        <p className="font-medium text-ink">{p.name}</p>
                        <p className="text-xs text-muted">{p.sku ?? "—"}</p>
                      </td>
                      <td className="px-5 py-3 text-muted">{p.category ?? "Uncategorized"}</td>
                      <td className="px-5 py-3 text-right tabular text-ink">{formatNumber(p.units_sold)}</td>
                      <td className="px-5 py-3 text-right font-semibold text-ink tabular">{fc(p.revenue, currency)}</td>
                      <td className={cn("px-5 py-3 text-right font-medium tabular", p.profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>{fc(p.profit, currency)}</td>
                      <td className="px-5 py-3 text-right tabular text-ink">{p.margin.toFixed(1)}%</td>
                      <td className="px-5 py-3 text-right">
                        <span className={cn("inline-flex items-center gap-0.5 text-xs font-semibold tabular", p.trend >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                          {p.trend >= 0 ? "↑" : "↓"} {Math.abs(p.trend).toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {p.stock <= 15 && p.status === "active" ? (
                          <Badge tone="amber">{p.stock} left</Badge>
                        ) : p.status !== "active" ? (
                          <Badge tone="gray">{p.status}</Badge>
                        ) : (
                          <span className="text-xs tabular text-ink">{p.stock}</span>
                        )}
                      </td>
                      {canManage && (
                        <td className="px-5 py-3">
                          <div className="flex justify-end gap-1">
                            <button onClick={() => setEditTarget(p)} className="rounded-md p-1.5 text-muted transition hover:bg-ink/[0.05] hover:text-ink dark:hover:bg-white/[0.08]" aria-label={`Edit ${p.name}`}>
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button onClick={() => setDeleteTarget(p)} className="rounded-md p-1.5 text-muted transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400" aria-label={`Delete ${p.name}`}>
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={catalog.data?.page ?? 1} pages={catalog.data?.pages ?? 1} total={catalog.data?.total ?? 0} onPageChange={setPage} />
          </>
        )}
      </Card>

      {/* Modals */}
      {createOpen && (
        <ProductFormModal
          mode="create"
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          categories={categories.data ?? []}
          onDone={(msg) => { toast.success(msg); refreshAll(); }}
          onError={(err) => toast.error(apiErrorMessage(err))}
        />
      )}
      {editTarget && (
        <ProductFormModal
          mode="edit"
          open={Boolean(editTarget)}
          product={editTarget}
          categories={categories.data ?? []}
          onClose={() => setEditTarget(null)}
          onDone={(msg) => { toast.success(msg); refreshAll(); }}
          onError={(err) => toast.error(apiErrorMessage(err))}
        />
      )}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete product"
        message={<>This will permanently remove <strong>{deleteTarget?.name}</strong> from your catalog. Past orders keep their line-item history.</>}
        confirmLabel="Delete product"
        loading={false}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          void api
            .delete(`/api/products/${deleteTarget.id}`)
            .then(() => { toast.success("Product deleted"); setDeleteTarget(null); refreshAll(); })
            .catch((err) => toast.error(apiErrorMessage(err)));
        }}
      />
    </div>
  );
}

function ProductFormModal({
  mode,
  open,
  onClose,
  categories,
  product,
  onDone,
  onError,
}: {
  mode: "create" | "edit";
  open: boolean;
  onClose: () => void;
  categories: Category[];
  product?: ProductRow;
  onDone: (msg: string) => void;
  onError: (err: unknown) => void;
}) {
  const [form, setForm] = useState({
    name: product?.name ?? "",
    sku: product?.sku ?? "",
    description: product?.description ?? "",
    price: product ? String(product.price) : "",
    cost: product ? String(product.cost) : "",
    stock: product != null ? String(product.stock) : "",
    status: product?.status ?? "active",
    category_id: product?.category_id != null ? String(product.category_id) : "",
  });
  const mutation = useMutation(async (payload: Record<string, unknown>) => {
    if (mode === "create") return api.post<{ id: number }>("/api/products", payload);
    return api.put<{ id: number }>(`/api/products/${product?.id}`, payload);
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (form.name.trim().length < 2) next.name = "Name is required.";
    if (form.sku.trim().length < 2) next.sku = "SKU is required.";
    const price = Number(form.price);
    if (!Number.isFinite(price) || price <= 0) next.price = "Enter a valid price.";
    const cost = Number(form.cost);
    if (!Number.isFinite(cost) || cost < 0) next.cost = "Enter a valid cost.";
    setErrors(next);
    if (Object.keys(next).length) return;
    try {
      await mutation.run({
        name: form.name.trim(),
        sku: form.sku.trim(),
        description: form.description.trim(),
        price,
        cost,
        stock: Number(form.stock) || 0,
        status: form.status,
        category_id: form.category_id ? Number(form.category_id) : null,
      });
      onDone(mode === "create" ? "Product created" : "Product updated");
      onClose();
    } catch (err) {
      onError(err);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "create" ? "Add product" : `Edit ${product?.name}`}
      description="Products power your analytics — units sold, margins and inventory."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.loading}>Cancel</Button>
          <Button type="submit" form="product-form" loading={mutation.loading}>{mode === "create" ? "Create product" : "Save changes"}</Button>
        </>
      }
    >
      <form id="product-form" onSubmit={(e) => void submit(e)} className="space-y-4" noValidate>
        <Field label="Product name" required error={errors.name}>
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Aurora Wireless Earbuds" />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="SKU" required error={errors.sku}>
            <Input value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} placeholder="ELE-001" />
          </Field>
          <Field label="Price ($)" required error={errors.price}>
            <Input type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} placeholder="89.00" />
          </Field>
          <Field label="Cost ($)" required error={errors.cost}>
            <Input type="number" step="0.01" min="0" value={form.cost} onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))} placeholder="38.00" />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Stock">
            <Input type="number" min="0" value={form.stock} onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))} placeholder="120" />
          </Field>
          <Field label="Category">
            <Select value={form.category_id} onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}>
              <option value="">Uncategorized</option>
              {categories.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </Select>
          </Field>
        </div>
        <Field label="Description">
          <Textarea rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Short product description (optional)" />
        </Field>
      </form>
    </Modal>
  );
}
