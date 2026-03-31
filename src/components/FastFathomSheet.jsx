import { X } from "lucide-react";

export default function FastFathomSheet({ open, onClose, url }) {
  return (
    <div className={`fast-fathom-backdrop ${open ? "open" : ""}`} onClick={onClose}>
      <div className={`fast-fathom-sheet ${open ? "open" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="fast-fathom-header">
          <span className="fast-fathom-title">Fast Fathom</span>
          <button className="fast-fathom-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        {open && url && (
          <iframe
            src={url}
            className="fast-fathom-iframe"
            allow="microphone; camera"
            title="Fast Fathom"
          />
        )}
      </div>
    </div>
  );
}
