import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "./Button";

export function Pagination({
  page,
  pages,
  total,
  onPageChange,
  className,
}: {
  page: number;
  pages: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  if (pages <= 1) return null;
  const start = (page - 1) * 25 + 1;
  const end = Math.min(page * 25, total);

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 px-1 py-3", className)}>
      <p className="text-xs text-muted tabular">
        Showing {start}–{end} of {total}
      </p>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="px-2 text-[13px] text-muted tabular">
          Page {page} of {pages}
        </span>
        <Button variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={page >= pages} aria-label="Next page">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
