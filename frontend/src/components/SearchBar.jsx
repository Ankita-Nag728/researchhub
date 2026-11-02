import { useEffect, useState } from "react";
import { Search } from "lucide-react";

// Controlled search box. It waits 350ms after typing stops before calling
// onSearch, so we do not hit the API on every keystroke.
export default function SearchBar({ value = "", onSearch, placeholder = "Search...", label = "Search", delay = 350 }) {
  const [text, setText] = useState(value);

  useEffect(() => setText(value), [value]);

  useEffect(() => {
    if (text === value) return undefined;
    const timer = setTimeout(() => onSearch(text.trim()), delay);
    return () => clearTimeout(timer);
  }, [text, value, delay, onSearch]);

  return (
    <form className="searchbar" role="search" onSubmit={(e) => { e.preventDefault(); onSearch(text.trim()); }}>
      <label htmlFor="searchbar-input" className="sr-only">{label}</label>
      <Search size={18} aria-hidden="true" />
      <input
        id="searchbar-input"
        type="search"
        className="input"
        value={text}
        placeholder={placeholder}
        maxLength={120}
        onChange={(e) => setText(e.target.value)}
      />
    </form>
  );
}
