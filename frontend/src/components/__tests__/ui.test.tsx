import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge, OrderStatusBadge, SegmentBadge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Delta, ProgressBar } from "../ui/base";
import { StatCard } from "../dashboard/StatCard";

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
});
