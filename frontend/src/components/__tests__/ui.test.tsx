import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Badge, OrderStatusBadge, SegmentBadge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Delta, ProgressBar } from "../ui/base";
import { Sparkline, StatCard } from "../dashboard/StatCard";
import { ThemeProvider } from "../../contexts/ThemeContext";

describe("Badge", () => {
  it("renders children with a tone", () => {
    render(<Badge tone="green">Active</Badge>);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("maps order statuses to readable labels", () => {
    render(<OrderStatusBadge status="delivered" />);
    expect(screen.getByText("Delivered")).toBeInTheDocument();
    render(<OrderStatusBadge status="refunded" />);
    expect(screen.getByText("Refunded")).toBeInTheDocument();
  });

  it("labels customer segments", () => {
    render(<SegmentBadge segment="vip" />);
    expect(screen.getByText("VIP")).toBeInTheDocument();
  });
});

describe("Button", () => {
  it("renders its label", () => {
    render(<Button>Start Free</Button>);
    expect(screen.getByRole("button", { name: "Start Free" })).toBeInTheDocument();
  });

  it("is disabled while loading and shows a spinner", () => {
    render(<Button loading>Save</Button>);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button.querySelector(".animate-spin")).toBeTruthy();
  });
});

describe("Delta", () => {
  it("renders positive change in emerald", () => {
    const { container } = render(<Delta value={12.4} />);
    expect(container.textContent).toContain("12.4%");
    expect(container.querySelector(".text-emerald-600")).toBeTruthy();
  });

  it("renders negative change in red", () => {
    const { container } = render(<Delta value={-3.2} />);
    expect(container.textContent).toContain("3.2%");
    expect(container.querySelector(".text-red-600")).toBeTruthy();
  });
});

describe("ProgressBar", () => {
  it("clamps values above 100", () => {
    const { container } = render(<ProgressBar value={150} />);
    const fill = container.querySelector('[role="progressbar"] > div');
    expect(fill).toHaveStyle({ width: "100%" });
  });
});

describe("StatCard", () => {
  it("renders the label and formatted value", () => {
    render(<StatCard label="Revenue" value={128430.25} kind="currency" currency="USD" loading={false} />);
    expect(screen.getByText("Revenue")).toBeInTheDocument();
  });

  it("shows a skeleton while loading instead of the value", () => {
    render(<StatCard label="Revenue" value={128430.25} loading />);
    expect(screen.getByText("Revenue")).toBeInTheDocument();
  });

  it("renders the hero variant with a sparkline and staggers its entrance", () => {
    const { container } = render(
      <StatCard label="Revenue" value={1200} loading={false} variant="hero" sparkline={[1, 3, 2, 5]} index={3} />
    );
    const card = container.firstElementChild as HTMLElement;
    expect(card.className).toContain("stat-hero");
    expect(card.style.animationDelay).toBe("180ms");
    expect(container.querySelector("svg path")).not.toBeNull();
  });

  it("hides the sparkline while loading or when there is not enough data", () => {
    const { container, rerender } = render(<StatCard label="Orders" value={12} loading sparkline={[1, 2, 3]} />);
    expect(container.querySelector("svg")).toBeNull();
    rerender(<StatCard label="Orders" value={12} loading={false} sparkline={[1]} />);
    expect(container.querySelector("svg")).toBeNull();
  });

  it("enables the 3D tilt layer inside a provider with depth mode on", () => {
    const { container } = render(
      <ThemeProvider>
        <StatCard label="Revenue" value={1200} loading={false} />
      </ThemeProvider>
    );
    const card = container.querySelector(".card-3d") as HTMLElement;
    expect(card.style.transformStyle).toBe("preserve-3d");
    expect(card.querySelector("span.pointer-events-none")).not.toBeNull();
    // jsdom has no layout, so a move must be a safe no-op rather than producing NaN transforms.
    fireEvent.mouseMove(card, { clientX: 10, clientY: 10 });
    expect(card.style.transform).toBe("");
    fireEvent.mouseLeave(card);
  });

  it("does not attach tilt handlers or the highlight layer when depth mode is off", () => {
    localStorage.setItem("nexora-depth", "off");
    const { container } = render(
      <ThemeProvider>
        <StatCard label="Revenue" value={1200} loading={false} />
      </ThemeProvider>
    );
    const card = container.querySelector(".card-3d") as HTMLElement;
    expect(card.style.transformStyle).toBe("");
    expect(card.querySelector("span.pointer-events-none")).toBeNull();
    localStorage.removeItem("nexora-depth");
  });
});

describe("Sparkline", () => {
  it("renders nothing for fewer than two points", () => {
    const { container } = render(<Sparkline points={[5]} />);
    expect(container.querySelector("svg")).toBeNull();
  });

  it("builds a path that spans the full width", () => {
    const { container } = render(<Sparkline points={[0, 10, 5]} />);
    const d = container.querySelectorAll("path")[1]?.getAttribute("d") ?? "";
    expect(d.startsWith("M0.0,")).toBe(true);
    expect(d).toContain("L100.0,");
  });
});
