import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { FileBarChart2, Package, Search, ShoppingBag, UserRound } from "lucide-react";
import { api } from "../../services/api";
import { useDebounced } from "../../hooks/useUi";
import { formatCurrency, formatNumber } from "../../lib/utils";
import type { SearchResults } from "../../types";
import { useAuth } from "../../contexts/AuthContext";
import { Skeleton } from "../ui/Feedback";

function ResultIcon({ kind }: { kind: "customers" | "orders" | "products" | "reports" }) {
  const cls = "h-4 w-4 text-muted";
  if (kind === "customers") return <UserRound className={cls} />;
  if (kind === "orders") return <ShoppingBag className={cls} />;
  if (kind === "products") return <Package className={cls} />;
  return <FileBarChart2 className={cls} />;
}

export function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const debounced = useDebounced(query, 250);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { me } = useAuth();
  const currency = me?.organization.currency ?? "USD";

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults(null);
      return;
    }
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open || debounced.trim().length < 2) {
      setResults(null);
      return;
    }
    let active = true;
    setLoading(true);
    api
      .get<SearchResults>(`/api/search?q=${encodeURIComponent(debounced.trim())}`)
      .then((r) => {
        if (active) {
          setResults(r);
          setLoading(false);
        }
      })
      .catch(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [debounced, open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const go = (path: string) => {
    onClose();
    navigate(path);
  };

  const groups: { kind: "customers" | "orders" | "products" | "reports"; label: string; rows: { id: number; title: string; sub: string; extra?: string }[] }[] = [
    {
      kind: "customers",
      label: "Customers",
      rows: (results?.customers ?? []).map((c) => ({ id: c.id, title: c.name, sub: c.email, extra: c.segment })),
    },
    {
      kind: "orders",
      label: "Orders",
      rows: (results?.orders ?? []).map((o) => ({ id: o.id, title: o.order_number, sub: o.status, extra: formatCurrency(o.total, currency) })),
    },
    {
      kind: "products",
      label: "Products",
      rows: (results?.products ?? []).map((p) => ({ id: p.id, title: p.name, sub: `${p.sku} · ${formatNumber(p.stock)} in stock`, extra: formatCurrency(p.price, currency) })),
    },
    {
      kind: "reports",
      label: "Reports",
      rows: (results?.reports ?? []).map((r) => ({ id: r.id, title: r.name, sub: r.type })),
    },
  ];

  const hasAny = groups.some((g) => g.rows.length > 0);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Global search">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl animate-scale-in overflow-hidden rounded-2xl border border-border bg-card shadow-modal">
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="h-4.5 w-4.5 text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search customers, orders, products, reports…"
            className="h-13 w-full bg-transparent py-3.5 text-[15px] text-ink outline-none placeholder:text-muted/70"
            aria-label="Search query"
          />
          <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted">ESC</kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {loading && (
            <div className="space-y-2 p-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          )}
          {!loading && query.trim().length < 2 && (
            <p className="px-3 py-8 text-center text-sm text-muted">Type at least 2 characters to search across your workspace.</p>
          )}
          {!loading && query.trim().length >= 2 && !hasAny && (
            <p className="px-3 py-8 text-center text-sm text-muted">No results for “{query.trim()}”.</p>
          )}
          {!loading &&
            groups.map((group) =>
              group.rows.length > 0 ? (
                <div key={group.kind} className="mb-1">
                  <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted">{group.label}</p>
                  {group.rows.map((row) => (
                    <button
                      key={`${group.kind}-${row.id}`}
                      onClick={() => go(group.kind === "customers" ? `/app/customers/${row.id}` : group.kind === "orders" ? `/app/orders/${row.id}` : group.kind === "products" ? `/app/products` : `/app/reports`)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-ink/[0.04] dark:hover:bg-white/[0.06]"
                    >
                      <ResultIcon kind={group.kind} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-medium text-ink">{row.title}</span>
                        <span className="block truncate text-xs capitalize text-muted">{row.sub}</span>
                      </span>
                      {row.extra && <span className="shrink-0 text-xs font-medium capitalize text-muted">{row.extra}</span>}
                    </button>
                  ))}
                </div>
              ) : null
            )}
        </div>
      </div>
    </div>,
    document.body
  );
}
