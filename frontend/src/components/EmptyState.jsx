// A friendly empty/error state with a small line-art sprig and an optional action.
export default function EmptyState({ title, message, action }) {
  return (
    <div className="empty-state">
      <svg className="empty-art" viewBox="0 0 84 84" fill="none" aria-hidden="true">
        <circle cx="42" cy="42" r="40" fill="#FFF1F3" />
        <path d="M42 66V34" stroke="#B85F7F" strokeWidth="2" strokeLinecap="round" />
        <path d="M42 50c-8 0-13-5-13-12 8 0 13 5 13 12zM42 42c8 0 13-5 13-12-8 0-13 5-13 12z" stroke="#D987A2" strokeWidth="2" strokeLinejoin="round" />
        <path d="M34 66h16" stroke="#B85F7F" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {action}
    </div>
  );
}
