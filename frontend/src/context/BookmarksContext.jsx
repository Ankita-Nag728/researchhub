import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { bookmarkService } from "../services/applicationService";
import { toApiError } from "../services/apiClient";
import { useAuth } from "./AuthContext";
import { useToast } from "./ToastContext";

const BookmarksContext = createContext(null);
const EMPTY = { projects: [], papers: [] };

// Keeps the logged-in user's saved projects and papers in one place so every
// card and page shows the same bookmark state.
export function BookmarksProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const toast = useToast();
  const [saved, setSaved] = useState(EMPTY);

  const refresh = useCallback(async () => {
    try {
      setSaved(await bookmarkService.list());
    } catch {
      setSaved(EMPTY);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) refresh();
    else setSaved(EMPTY);
  }, [isAuthenticated, refresh]);

  const toggle = useCallback(
    async (kind, id, existing) => {
      try {
        if (existing) {
          await bookmarkService.remove(existing.bookmark_id, kind);
          toast.info("Removed from your saved items.");
        } else {
          await bookmarkService.add(kind === "project" ? { project_id: id } : { paper_id: id });
          toast.success("Saved.");
        }
        await refresh();
      } catch (err) {
        const apiError = toApiError(err);
        if (apiError.status === 409) await refresh();
        else toast.error(apiError.message);
      }
    },
    [refresh, toast],
  );

  const value = useMemo(
    () => ({
      saved,
      refresh,
      findProject: (id) => saved.projects.find((b) => b.project.id === id),
      findPaper: (id) => saved.papers.find((b) => b.paper.id === id),
      toggleProject: (project) => toggle("project", project.id, saved.projects.find((b) => b.project.id === project.id)),
      togglePaper: (paper) => toggle("paper", paper.id, saved.papers.find((b) => b.paper.id === paper.id)),
    }),
    [saved, refresh, toggle],
  );
  return <BookmarksContext.Provider value={value}>{children}</BookmarksContext.Provider>;
}

export function useBookmarks() {
  const ctx = useContext(BookmarksContext);
  if (!ctx) throw new Error("useBookmarks must be used inside <BookmarksProvider>");
  return ctx;
}
