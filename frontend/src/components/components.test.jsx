import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import FormInput from "./FormInput";
import Pagination from "./Pagination";
import ConfirmationModal from "./ConfirmationModal";
import StatusBadge from "./StatusBadge";
import ProjectCard from "./ProjectCard";
import ProtectedRoute from "./ProtectedRoute";
import { AuthProvider } from "../context/AuthContext";
import { toApiError } from "../services/apiClient";
import { authService } from "../services/authService";

function LoginState() {
  const { state } = useLocation();
  return <p>from: {state?.from}</p>;
}

describe("FormInput", () => {
  it("links the label, the control and the error message for screen readers", () => {
    render(<FormInput label="Email address" error="Enter a valid email address." type="email" />);
    const input = screen.getByLabelText("Email address");
    expect(input).toHaveAttribute("aria-invalid", "true");
    const error = screen.getByRole("alert");
    expect(error).toHaveTextContent("Enter a valid email address.");
    expect(input.getAttribute("aria-describedby")).toContain(error.id);
  });
});

describe("Pagination", () => {
  it("renders nothing for a single page", () => {
    const { container } = render(<Pagination page={1} totalPages={1} onChange={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("marks the current page, disables Previous on page 1 and calls onChange", async () => {
    const onChange = vi.fn();
    render(<Pagination page={1} totalPages={5} onChange={onChange} />);
    expect(screen.getByRole("button", { name: "Page 1" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(onChange).toHaveBeenCalledWith(2);
  });
});

describe("ConfirmationModal", () => {
  it("is hidden when closed and calls the right handlers when open", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const { rerender } = render(<ConfirmationModal open={false} title="Delete?" message="Sure?" onConfirm={onConfirm} onCancel={onCancel} />);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    rerender(<ConfirmationModal open title="Delete?" message="Sure?" confirmLabel="Delete" onConfirm={onConfirm} onCancel={onCancel} />);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalledOnce();
    await userEvent.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalled();
  });
});

describe("StatusBadge", () => {
  it("shows a readable label for known and unknown statuses", () => {
    const { rerender } = render(<StatusBadge status="under_review" kind="application" />);
    expect(screen.getByText("Under Review")).toBeInTheDocument();
    rerender(<StatusBadge status="mystery" />);
    expect(screen.getByText("mystery")).toBeInTheDocument();
  });
});

describe("ProjectCard", () => {
  const project = {
    id: 7, title: "Sample Project", short_description: "Short text", domain: "Data Science",
    institution: "Sample Institution", supervisor: "Sample Supervisor", status: "open", application_deadline: "2027-03-31",
  };

  it("links to the project details page and shows the required fields", () => {
    render(<MemoryRouter><ProjectCard project={project} /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "Sample Project" })).toHaveAttribute("href", "/projects/7");
    expect(screen.getByText("Sample Institution")).toBeInTheDocument();
    expect(screen.getByText("Sample Supervisor")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
  });

  it("only shows the bookmark button when a handler is provided", async () => {
    const onToggle = vi.fn();
    const { rerender } = render(<MemoryRouter><ProjectCard project={project} /></MemoryRouter>);
    expect(screen.queryByRole("button", { name: /save/i })).not.toBeInTheDocument();
    rerender(<MemoryRouter><ProjectCard project={project} onToggleBookmark={onToggle} /></MemoryRouter>);
    await userEvent.click(screen.getByRole("button", { name: /save sample project/i }));
    expect(onToggle).toHaveBeenCalledWith(project);
  });
});

describe("ProtectedRoute", () => {
  it("sends a logged-out visitor to /login and remembers where they were going", async () => {
    vi.spyOn(authService, "me").mockRejectedValue({ response: { status: 401 } });

    const { findByText } = render(
      <MemoryRouter initialEntries={["/dashboard/applications?tab=1"]}>
        <AuthProvider>
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard/applications" element={<p>secret</p>} />
            </Route>
            <Route path="/login" element={<LoginState />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(await findByText("from: /dashboard/applications?tab=1")).toBeInTheDocument();
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
  });
});

describe("toApiError", () => {
  it("maps FastAPI validation errors to field messages", () => {
    const err = toApiError({
      response: { status: 422, data: { detail: [{ loc: ["body", "email"], msg: "value is not a valid email address" }] } },
    });
    expect(err.status).toBe(422);
    expect(err.fieldErrors.email).toBe("value is not a valid email address");
  });

  it("returns a friendly message for network failures", () => {
    const err = toApiError({ message: "Network Error" });
    expect(err.isNetwork).toBe(true);
    expect(err.message).toMatch(/cannot reach the server/i);
  });

  it("passes through simple string errors", () => {
    expect(toApiError({ response: { status: 401, data: { detail: "Invalid email or password." } } }).message).toBe(
      "Invalid email or password.",
    );
  });
});
