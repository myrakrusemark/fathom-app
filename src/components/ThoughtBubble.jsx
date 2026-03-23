/** Shared thought-bubble icon used for memory operations (onboarding + chat). */
import { CloudCog } from "lucide-react";

export default function ThoughtBubble({ size = 12, color = "currentColor" }) {
  return <CloudCog size={size} color={color} strokeWidth={1.5} />;
}
