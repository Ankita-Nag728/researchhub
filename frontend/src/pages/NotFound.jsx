import { Link } from "react-router-dom";
import EmptyState from "../components/EmptyState";

export default function NotFound() {
  return (
    <div className="container" style={{ paddingBlock: "var(--space-8)" }}>
      <EmptyState
        title="Page not found"
        message="The page you are looking for does not exist or has moved."
        action={<Link to="/" className="btn btn-primary" style={{ marginTop: "var(--space-4)" }}>Go to home</Link>}
      />
    </div>
  );
}
