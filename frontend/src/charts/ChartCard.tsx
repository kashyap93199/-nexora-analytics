import type { ReactNode } from "react";
import { Card, CardHeader } from "../components/ui/Card";
import { Skeleton } from "../components/ui/Feedback";

export function ChartCard({
  title,
  subtitle,
  actions,
  children,
  loading = false,
  height = 300,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  loading?: boolean;
  height?: number;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader title={title} subtitle={subtitle} actions={actions} />
      <div className="px-2 pb-3 pt-2 sm:px-3" style={{ height: loading ? height : undefined }}>
        {loading ? (
          <div className="flex h-full items-center justify-center px-3">
            <Skeleton className="h-full w-full" />
          </div>
        ) : (
          children
        )}
      </div>
    </Card>
  );
}
