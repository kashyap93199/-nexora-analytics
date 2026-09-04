import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Home } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Logo } from "../../components/layout/Logo";

export function ErrorPage({
  code,
  title,
  message,
  children,
}: {
  code: string;
  title: string;
  message: string;
  children?: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Logo />
          <Link to="/">
            <Button variant="ghost" size="sm" leftIcon={<Home className="h-4 w-4" />}>Home</Button>
          </Link>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-5 py-16">
        <div className="max-w-md text-center">
          <p className="text-7xl font-extrabold tracking-tight text-primary-600/90 dark:text-primary-500 tabular">{code}</p>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink">{title}</h1>
          <p className="mt-2 leading-relaxed text-muted">{message}</p>
          {children}
          <div className="mt-7 flex justify-center gap-3">
            <Button variant="outline" onClick={() => navigate(-1)} leftIcon={<ArrowLeft className="h-4 w-4" />}>Go back</Button>
            <Link to="/app/overview"><Button>Open dashboard</Button></Link>
          </div>
        </div>
      </main>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <ErrorPage
      code="404"
      title="This page went off the grid"
      message="The page you're looking for doesn't exist or has moved. Check the address or head back to your dashboard."
    />
  );
}

export function ForbiddenPage() {
  return (
    <ErrorPage
      code="403"
      title="You don't have access here"
      message="Your role doesn't include permission for this area. Ask an Owner or Admin to adjust your role, or return to a section you can view."
    />
  );
}

export function ServerErrorPage() {
  return (
    <ErrorPage
      code="500"
      title="Something broke on our side"
      message="An unexpected error occurred while processing your request. Please try again — if it keeps happening, contact support."
    />
  );
}
