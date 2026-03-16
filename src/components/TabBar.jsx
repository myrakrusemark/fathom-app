export default function TabBar({ tabs, active, onChange, className = "" }) {
  return (
    <div className={`tab-bar ${className}`}>
      {tabs.map((t) => (
        <button
          key={t.id}
          className={`tab-bar-item ${active === t.id ? "active" : ""}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
