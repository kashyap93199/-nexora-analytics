import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import RegisterPage from "../Register";
import { AuthProvider } from "../../../contexts/AuthContext";
import { ThemeProvider } from "../../../contexts/ThemeContext";
import { ToastProvider } from "../../../contexts/ToastContext";

function renderRegister(path = "/register") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <RegisterPage />
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
}

describe("RegisterPage form validation", () => {
  it("shows field errors when submitting an empty form", () => {
    renderRegister();
    fireEvent.click(screen.getByRole("button", { name: /create workspace/i }));
    expect(screen.getByText("Please enter your full name.")).toBeInTheDocument();
    expect(screen.getByText("Email is required.")).toBeInTheDocument();
  });

  it("clears a field error once the user types into the field", () => {
    renderRegister();
    fireEvent.click(screen.getByRole("button", { name: /create workspace/i }));
    expect(screen.getByText("Please enter your full name.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "Alex" } });
    expect(screen.queryByText("Please enter your full name.")).not.toBeInTheDocument();
  });

  it("hides the organization field and does not require it when an invite token is present", () => {
    renderRegister("/register?invite=abc123");
    expect(screen.queryByLabelText(/organization/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /join workspace/i }));
    expect(screen.getByText("Please enter your full name.")).toBeInTheDocument();
    expect(screen.queryByText("Enter your company or organization name.")).not.toBeInTheDocument();
  });

  it("rejects a weak password with a specific hint", () => {
    renderRegister();
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "weak" } });
    fireEvent.click(screen.getByRole("button", { name: /create workspace/i }));
    expect(screen.getByText("Password must be at least 8 characters.")).toBeInTheDocument();
  });
});
