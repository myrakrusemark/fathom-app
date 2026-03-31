import { useRef, useEffect, forwardRef } from "react";

const ChatInput = forwardRef(function ChatInput(
  { value, onChange, onSubmit, placeholder, disabled, autoComplete, className, ...rest },
  ref
) {
  const localRef = useRef(null);
  const el = ref || localRef;

  useEffect(() => {
    const node = el.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = node.scrollHeight + "px";
    node.classList.toggle("scrollable", node.scrollHeight > node.clientHeight);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit?.();
    }
  };

  return (
    <textarea
      ref={el}
      className={`chat-input-grow${className ? ` ${className}` : ""}`}
      value={value}
      onChange={onChange}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      disabled={disabled}
      autoComplete={autoComplete}
      rows={1}
      {...rest}
    />
  );
});

export default ChatInput;
