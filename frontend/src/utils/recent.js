// "Recently explored projects" are remembered in this browser only (never sent anywhere).
const KEY = "researchhub.recentProjects";

export function getRecentProjectIds() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((n) => Number.isInteger(n)).slice(0, 4) : [];
  } catch {
    return [];
  }
}

export function rememberProject(id) {
  try {
    const next = [id, ...getRecentProjectIds().filter((n) => n !== id)].slice(0, 4);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage can be blocked (private mode); the feature just does nothing */
  }
}
