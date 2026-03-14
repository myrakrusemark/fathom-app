/** Shared thought-bubble icon used for memory operations (onboarding + chat). */
export default function ThoughtBubble({ size = 12, color = "currentColor" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <path d="M7.5 3.5a5.5 5.5 0 019.32 4.7A4 4 0 0118 16H6a4 4 0 01-.78-7.92A5.5 5.5 0 017.5 3.5z" />
      <circle cx="7" cy="19.5" r="1.2" />
      <circle cx="5" cy="22" r="0.8" />
    </svg>
  );
}
