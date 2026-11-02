// Small formatting helpers shared across pages.

export function formatDate(value) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function isDeadlinePassed(value, now = new Date()) {
  if (!value) return false;
  const deadline = new Date(value);
  if (Number.isNaN(deadline.getTime())) return false;
  return deadline.getTime() < now.getTime();
}

// Application and project statuses -> label + badge tone.
export const APPLICATION_STATUS = {
  submitted: { label: "Submitted", tone: "info" },
  under_review: { label: "Under Review", tone: "warning" },
  shortlisted: { label: "Shortlisted", tone: "neutral" },
  accepted: { label: "Accepted", tone: "success" },
  rejected: { label: "Rejected", tone: "error" },
};

export const PROJECT_STATUS = {
  open: { label: "Open", tone: "success" },
  ongoing: { label: "Ongoing", tone: "info" },
  completed: { label: "Completed", tone: "neutral" },
  closed: { label: "Closed", tone: "warning" },
  archived: { label: "Archived", tone: "neutral" },
};

export const RESEARCH_DOMAINS = [
  "Artificial Intelligence",
  "Machine Learning",
  "Data Science",
  "Cybersecurity",
  "Environmental Science",
  "Biotechnology",
  "Computer Science",
];
