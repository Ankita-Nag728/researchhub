// Original editorial line-art: an open book with a growing sprig and a magnifier.
// Purely decorative, so it is hidden from screen readers.
export default function HeroIllustration() {
  return (
    <svg viewBox="0 0 460 400" fill="none" aria-hidden="true" className="hero-art">
      <circle cx="230" cy="200" r="178" fill="#FFF1F3" />
      <circle cx="230" cy="200" r="178" stroke="#F0DDE3" strokeWidth="1.5" strokeDasharray="3 7" />
      {/* open book */}
      <path d="M90 262c46-18 96-18 140 6 44-24 94-24 140-6V150c-46-18-96-18-140 6-44-24-94-24-140-6v112z" fill="#FFFFFF" stroke="#743C53" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M230 156v112" stroke="#743C53" strokeWidth="2.5" />
      <path d="M118 182c28-8 58-6 84 6M118 206c28-8 58-6 84 6M118 230c28-8 58-6 84 6" stroke="#F0DDE3" strokeWidth="3" strokeLinecap="round" />
      <path d="M258 188c26-12 56-14 84-6M258 212c26-12 56-14 84-6" stroke="#F0DDE3" strokeWidth="3" strokeLinecap="round" />
      {/* sprig growing from the spine */}
      <path d="M230 156c0-28 2-52 10-76" stroke="#B85F7F" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M233 128c-18 2-30-8-34-24 18-2 30 8 34 24z" fill="#F8DCE3" stroke="#B85F7F" strokeWidth="2" strokeLinejoin="round" />
      <path d="M237 104c18 0 30-10 34-26-18 0-30 10-34 26z" fill="#F8DCE3" stroke="#B85F7F" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="241" cy="76" r="11" fill="#D987A2" />
      <circle cx="241" cy="76" r="4" fill="#FFF1F3" />
      {/* magnifier */}
      <circle cx="356" cy="292" r="30" fill="#FFFFFF" stroke="#743C53" strokeWidth="2.5" />
      <path d="M378 314l28 28" stroke="#743C53" strokeWidth="5" strokeLinecap="round" />
      <path d="M342 288c4-9 12-13 22-11" stroke="#D987A2" strokeWidth="2.5" strokeLinecap="round" />
      {/* small orbit dots */}
      <circle cx="96" cy="108" r="5" fill="#D987A2" />
      <circle cx="372" cy="116" r="3.5" fill="#B85F7F" />
      <circle cx="68" cy="300" r="3.5" fill="#B85F7F" />
    </svg>
  );
}
