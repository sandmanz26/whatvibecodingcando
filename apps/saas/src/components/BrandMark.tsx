/** The ourhunch mark: a pin (feedback placed on the page) holding a spark (the hunch). Same drawing as the favicon. */
export function BrandMark({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <path d="M16 3a11 11 0 0 1 11 11c0 8-11 15-11 15S5 22 5 14A11 11 0 0 1 16 3z" fill="#e4ff54" />
      <path d="M16 8.2l1.75 4.05 4.05 1.75-4.05 1.75L16 19.8l-1.75-4.05L10.2 14l4.05-1.75z" fill="#1535e6" />
    </svg>
  )
}
