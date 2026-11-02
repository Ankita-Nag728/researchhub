import { APPLICATION_STATUS, PROJECT_STATUS } from "../utils/format";

// kind: "application" | "project". Unknown values fall back to a neutral badge.
export default function StatusBadge({ status, kind = "project" }) {
  const map = kind === "application" ? APPLICATION_STATUS : PROJECT_STATUS;
  const entry = map[status] || { label: String(status || "Unknown"), tone: "neutral" };
  return <span className={`badge badge-${entry.tone}`}>{entry.label}</span>;
}
