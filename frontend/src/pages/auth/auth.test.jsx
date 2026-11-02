import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import Login from "./Login";
import Register from "./Register";
import ProtectedRoute from "../../components/ProtectedRoute";
import { AuthProvider } from "../../context/AuthContext";
import { BookmarksProvider } from "../../context/BookmarksContext";
import { ToastProvider } from "../../context/ToastContext";
import { authService } from "../../services/authService";

const student = { id: 1, full_name: "Sample Student", email: "s@example.org", role: "student" };
const admin = { ...student, id: 2, role: "admin" };

function Where() {
  const { pathname } = useLocation();
  return <output data-testid="where">{pathname}</output>;
}

function renderApp(initialEntries, routes) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <ToastProvider>
        <AuthProvider>
          <BookmarksProvider>
            <Routes>{routes}</Routes>
            <Where />
          </BookmarksProvider>
        </AuthProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

const authRoutes = (
  <>
    <Route path="/login" element={<Login />} />
    <Route path="/register" element={<Register />} />
    <Route path="*" element={<p>elsewhere</p>} />
  </>
);

beforeEach(() => {
  vi.spyOn(authService, "me").mockRejectedValue({ response: { status: 401 } });
});
afterEach(() => vi.restoreAllMocks());

describe("Login form", () => {
  it("validates before calling the API", async () => {
    const login = vi.spyOn(authService, "login");
    renderApp(["/login"], authRoutes);
    await userEvent.click(screen.getByRole("button", { name: /log in/i }));
    expect((await screen.findAllByRole("alert")).length).toBeGreaterThanOrEqual(2);
    expect(login).not.toHaveBeenCalled();
  });

  it("shows the server's message for wrong credentials and stays on the page", async () => {
    vi.spyOn(authService, "login").mockRejectedValue({ response: { status: 401, data: { detail: "Invalid email or password." } } });
    renderApp(["/login"], authRoutes);
    await userEvent.type(screen.getByLabelText(/email address/i), "s@example.org");
    await userEvent.type(screen.getByLabelText(/^password/i), "wrong-password-1");
    await userEvent.click(screen.getByRole("button", { name: /log in/i }));
    expect(await screen.findByText("Invalid email or password.")).toBeInTheDocument();
    expect(screen.getByTestId("where")).toHaveTextContent("/login");
  });

  it("explains rate limiting in plain words", async () => {
    vi.spyOn(authService, "login").mockRejectedValue({ response: { status: 429, data: { detail: "Too many requests." } } });
    renderApp(["/login"], authRoutes);
    await userEvent.type(screen.getByLabelText(/email address/i), "s@example.org");
    await userEvent.type(screen.getByLabelText(/^password/i), "whatever-pass-1");
    await userEvent.click(screen.getByRole("button", { name: /log in/i }));
    expect(await screen.findByText(/too many attempts/i)).toBeInTheDocument();
  });

  it("sends a student to the dashboard, and an admin to /admin", async () => {
    vi.spyOn(authService, "login").mockResolvedValue(student);
    const first = renderApp(["/login"], authRoutes);
    await userEvent.type(screen.getByLabelText(/email address/i), "s@example.org");
    await userEvent.type(screen.getByLabelText(/^password/i), "right-password-1");
    await userEvent.click(screen.getByRole("button", { name: /log in/i }));
    expect(await screen.findByText("elsewhere")).toBeInTheDocument();
    expect(screen.getByTestId("where")).toHaveTextContent("/dashboard");
    first.unmount();

    authService.login.mockResolvedValue(admin);
    renderApp(["/login"], authRoutes);
    await userEvent.type(screen.getByLabelText(/email address/i), "a@example.org");
    await userEvent.type(screen.getByLabelText(/^password/i), "right-password-1");
    await userEvent.click(screen.getByRole("button", { name: /log in/i }));
    expect(await screen.findByText("elsewhere")).toBeInTheDocument();
    expect(screen.getByTestId("where")).toHaveTextContent("/admin");
  });

  it("returns to the page the visitor wanted, but never to an outside address", async () => {
    vi.spyOn(authService, "login").mockResolvedValue(student);
    renderApp([{ pathname: "/login", state: { from: "/projects/7/apply" } }], authRoutes);
    await userEvent.type(screen.getByLabelText(/email address/i), "s@example.org");
    await userEvent.type(screen.getByLabelText(/^password/i), "right-password-1");
    await userEvent.click(screen.getByRole("button", { name: /log in/i }));
    expect(await screen.findByText("elsewhere")).toBeInTheDocument();
    expect(screen.getByTestId("where")).toHaveTextContent("/projects/7/apply");
  });

  it("ignores an open-redirect attempt", async () => {
    vi.spyOn(authService, "login").mockResolvedValue(student);
    renderApp([{ pathname: "/login", state: { from: "//evil.example" } }], authRoutes);
    await userEvent.type(screen.getByLabelText(/email address/i), "s@example.org");
    await userEvent.type(screen.getByLabelText(/^password/i), "right-password-1");
    await userEvent.click(screen.getByRole("button", { name: /log in/i }));
    expect(await screen.findByText("elsewhere")).toBeInTheDocument();
    expect(screen.getByTestId("where")).toHaveTextContent("/dashboard");
  });
});

describe("Register form", () => {
  it("does not call the API when the passwords differ", async () => {
    const register = vi.spyOn(authService, "register");
    renderApp(["/register"], authRoutes);
    await userEvent.type(screen.getByLabelText(/full name/i), "Sample Student");
    await userEvent.type(screen.getByLabelText(/email address/i), "s@example.org");
    const [pw, confirm] = document.querySelectorAll("input[type=password]");
    await userEvent.type(pw, "Student-Pass-8830");
    await userEvent.type(confirm, "Different-Pass-1");
    await userEvent.type(screen.getByLabelText(/university/i), "Sample University");
    await userEvent.type(screen.getByLabelText(/department/i), "Computer Science");
    await userEvent.selectOptions(screen.getByLabelText(/academic year/i), screen.getByLabelText(/academic year/i).querySelectorAll("option")[1]);
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));
    expect(await screen.findByText(/do not match/i)).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it("rejects a weak password with a clear message", async () => {
    renderApp(["/register"], authRoutes);
    const [pw] = document.querySelectorAll("input[type=password]");
    await userEvent.type(pw, "short1");
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));
    expect((await screen.findAllByText(/at least 10 characters/i)).length).toBeGreaterThanOrEqual(1);
  });

  it("offers no way to choose the administrator role", () => {
    renderApp(["/register"], authRoutes);
    const options = [...screen.getByLabelText(/i am a/i).querySelectorAll("option")].map((o) => o.value);
    expect(options).not.toContain("admin");
  });
});

describe("Route protection", () => {
  const guarded = (
    <>
      <Route element={<ProtectedRoute adminOnly />}>
        <Route path="/admin" element={<p>admin area</p>} />
      </Route>
      <Route path="/dashboard" element={<p>student area</p>} />
      <Route path="/login" element={<p>login page</p>} />
    </>
  );

  it("keeps students out of the admin area", async () => {
    authService.me.mockResolvedValue(student);
    renderApp(["/admin"], guarded);
    expect(await screen.findByText("student area")).toBeInTheDocument();
    expect(screen.queryByText("admin area")).not.toBeInTheDocument();
  });

  it("lets administrators in", async () => {
    authService.me.mockResolvedValue(admin);
    renderApp(["/admin"], guarded);
    expect(await screen.findByText("admin area")).toBeInTheDocument();
  });

  it("sends guests to login", async () => {
    renderApp(["/admin"], guarded);
    expect(await screen.findByText("login page")).toBeInTheDocument();
  });
});
