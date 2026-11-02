import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import Landing from "./Landing";
import Explore from "./Explore";
import { Contact } from "./StaticPages";
import { AuthProvider } from "../context/AuthContext";
import { BookmarksProvider } from "../context/BookmarksContext";
import { ToastProvider } from "../context/ToastContext";
import { authService } from "../services/authService";
import { projectService } from "../services/projectService";
import { paperService } from "../services/paperService";

const project = (id, extra = {}) => ({
  id,
  title: `Sample Project ${id}`,
  short_description: "Sample description",
  domain: "Data Science",
  institution: "Sample Institution",
  supervisor: "Sample Supervisor",
  status: "open",
  application_deadline: "2027-03-31",
  ...extra,
});
const paper = (id) => ({
  id, title: `Sample Paper ${id}`, authors: "A. Author", abstract: "Abstract", publication_year: 2024,
  category: "Data Science", journal: "Sample Journal", doi: null, external_url: "https://example.org",
});
const page = (items, extra = {}) => ({ items, total: items.length, page: 1, page_size: 9, total_pages: 1, ...extra });

function LocationProbe() {
  const { search } = useLocation();
  return <output data-testid="search">{search}</output>;
}

function renderAt(ui, path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <AuthProvider>
          <BookmarksProvider>
            <Routes>
              <Route path="*" element={<>{ui}<LocationProbe /></>} />
            </Routes>
          </BookmarksProvider>
        </AuthProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.spyOn(authService, "me").mockRejectedValue({ response: { status: 401 } }); // guest
  vi.spyOn(projectService, "filters").mockResolvedValue({ domains: ["Data Science"], institutions: ["Sample Institution"], statuses: [] });
});
afterEach(() => vi.restoreAllMocks());

describe("Landing page", () => {
  it("shows the headline, CTAs and backend data for projects and papers", async () => {
    vi.spyOn(projectService, "list").mockResolvedValue(page([project(1), project(2)]));
    vi.spyOn(paperService, "list").mockResolvedValue(page([paper(1)]));
    renderAt(<Landing />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Where Curiosity Meets Discovery.");
    // Appears in the hero and again in the closing call to action
    const exploreLinks = screen.getAllByRole("link", { name: /explore research/i });
    expect(exploreLinks.length).toBeGreaterThanOrEqual(2);
    exploreLinks.forEach((link) => expect(link).toHaveAttribute("href", "/explore"));
    expect(await screen.findByText("Sample Project 1")).toBeInTheDocument();
    expect(await screen.findByText("Sample Paper 1")).toBeInTheDocument();
    // Guests are invited to join
    expect(screen.getByRole("link", { name: "Join ResearchHub" })).toHaveAttribute("href", "/register");
  });

  it("links every research category to a filtered Explore page", async () => {
    vi.spyOn(projectService, "list").mockResolvedValue(page([]));
    vi.spyOn(paperService, "list").mockResolvedValue(page([]));
    renderAt(<Landing />);
    expect(screen.getByRole("link", { name: /Cybersecurity/ })).toHaveAttribute("href", "/explore?domain=Cybersecurity");
    expect(screen.getAllByRole("link", { name: /Biotechnology/ })).toHaveLength(1);
  });

  it("shows empty states instead of fake data when nothing is published", async () => {
    vi.spyOn(projectService, "list").mockResolvedValue(page([]));
    vi.spyOn(paperService, "list").mockResolvedValue(page([]));
    renderAt(<Landing />);
    expect(await screen.findByText("No open projects yet")).toBeInTheDocument();
    expect(await screen.findByText("The paper library is empty")).toBeInTheDocument();
  });

  it("shows a retry button when a section fails, and recovers", async () => {
    const list = vi.spyOn(projectService, "list").mockRejectedValueOnce({ message: "Network Error" }).mockResolvedValue(page([project(5)]));
    vi.spyOn(paperService, "list").mockResolvedValue(page([paper(1)]));
    renderAt(<Landing />);

    expect(await screen.findByText("Featured projects are unavailable")).toBeInTheDocument();
    // The rest of the page still works
    expect(await screen.findByText("Sample Paper 1")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByText("Sample Project 5")).toBeInTheDocument();
    expect(list).toHaveBeenCalledTimes(2);
  });
});

describe("Explore page", () => {
  it("sends URL filters to the API and lists the results", async () => {
    const list = vi.spyOn(projectService, "list").mockResolvedValue(page([project(1)], { total: 1 }));
    renderAt(<Explore />, "/explore?domain=Data%20Science&sort=deadline&q=graph");

    expect(await screen.findByText("Sample Project 1")).toBeInTheDocument();
    expect(await screen.findByText("1 project found")).toBeInTheDocument();
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ q: "graph", domain: "Data Science", sort: "deadline", page: 1, page_size: 9 }),
    );
    expect(screen.getByLabelText("Sort by")).toHaveValue("deadline");
  });

  it("updates the URL when a filter or sort changes", async () => {
    vi.spyOn(projectService, "list").mockResolvedValue(page([project(1)]));
    renderAt(<Explore />, "/explore");
    await screen.findByText("Sample Project 1");

    await userEvent.selectOptions(screen.getByLabelText("Status"), "completed");
    expect(screen.getByTestId("search")).toHaveTextContent("status=completed");
    await userEvent.selectOptions(screen.getByLabelText("Sort by"), "oldest");
    expect(screen.getByTestId("search")).toHaveTextContent("sort=oldest");
  });

  it("explains empty results and clears all filters", async () => {
    vi.spyOn(projectService, "list").mockResolvedValue(page([]));
    renderAt(<Explore />, "/explore?status=closed");

    expect(await screen.findByText("No projects match your search")).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("button", { name: /clear all filters/i })[0]);
    expect(screen.getByTestId("search")).toHaveTextContent(/^$/);
    expect(await screen.findByText("No projects have been published yet")).toBeInTheDocument();
  });

  it("shows an error with retry when the API is unreachable", async () => {
    const list = vi.spyOn(projectService, "list").mockRejectedValueOnce({ message: "Network Error" }).mockResolvedValue(page([project(9)]));
    renderAt(<Explore />, "/explore");

    expect(await screen.findByText("Projects could not be loaded")).toBeInTheDocument();
    expect(screen.getByText(/cannot reach the server/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByText("Sample Project 9")).toBeInTheDocument();
    expect(list).toHaveBeenCalledTimes(2);
  });

  it("paginates through the URL", async () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    vi.spyOn(projectService, "list").mockResolvedValue(page([project(1)], { total: 20, total_pages: 3 }));
    renderAt(<Explore />, "/explore");
    await screen.findByText("Sample Project 1");

    await userEvent.click(within(screen.getByRole("navigation", { name: "Pagination" })).getByRole("button", { name: "Page 2" }));
    expect(screen.getByTestId("search")).toHaveTextContent("page=2");
  });
});

describe("Contact page", () => {
  it("does not invent a contact address when none is configured", () => {
    renderAt(<Contact />, "/contact");
    expect(screen.getByText("Contact details are not configured")).toBeInTheDocument();
  });
});
