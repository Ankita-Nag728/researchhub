import { RefreshCw } from "lucide-react";
import EmptyState from "./EmptyState";

// Shown when an API call fails. Always offers a retry.
export default function ErrorState({ error, onRetry, title = "We could not load this" }) {
  return (
    <EmptyState
      title={title}
      message={error?.message || "Something went wrong. Please try again."}
      action={
        onRetry && (
          <button type="button" className="btn btn-secondary" style={{ marginTop: "var(--space-4)" }} onClick={onRetry}>
            <RefreshCw size={16} aria-hidden="true" /> Try again
          </button>
        )
      }
    />
  );
}
