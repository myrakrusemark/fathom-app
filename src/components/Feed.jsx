import { useState, useEffect } from "react";
import { getFeed, getWeather } from "../api/client.js";
import FeedItem from "./FeedItem.jsx";

function WeatherIcon({ icon }) {
  if (icon === "cloud-sun") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
        <path d="M12 3v1m0 16v1m8.66-13.66l-.71.71M4.05 19.95l-.71.71M21 12h-1M4 12H3m16.66 7.66l-.71-.71M4.05 4.05l-.71-.71" />
        <circle cx="12" cy="12" r="4" />
        <path d="M17.5 17a4.5 4.5 0 00-8.94-.5A3 3 0 006 19.5h11a2.5 2.5 0 00.5-5z" fill="rgba(255,255,255,0.4)" stroke="currentColor" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
      <path d="M19 16.9A5 5 0 0018 7h-1.26a8 8 0 10-11.62 9" />
    </svg>
  );
}

function groupByWorkspace(items) {
  const groups = new Map();
  const order = [];
  for (const item of items) {
    if (!groups.has(item.workspace)) {
      groups.set(item.workspace, []);
      order.push(item.workspace);
    }
    groups.get(item.workspace).push(item);
  }
  return order.map((ws) => groups.get(ws));
}

function renderGroups(groups, onOpenReceipt) {
  return groups.map((group) =>
    group.length > 1 ? (
      <div className="feed-cluster" key={group[0].workspace}>
        {group.map((item) => (
          <FeedItem key={item.id} item={item} onOpenReceipt={onOpenReceipt} />
        ))}
      </div>
    ) : (
      <FeedItem key={group[0].id} item={group[0]} onOpenReceipt={onOpenReceipt} />
    )
  );
}

export default function Feed({ onChatOpen, onOpenReceipt }) {
  const [newItems, setNewItems] = useState([]);
  const [earlierItems, setEarlierItems] = useState([]);
  const [earlierOpen, setEarlierOpen] = useState(false);
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getFeed().then((data) => {
        setNewItems(data.items);
        setEarlierItems(data.earlier || []);
      }),
      getWeather().then(setWeather).catch(() => {}),
    ])
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="page">
        <header className="page-header">
          <h1>fathom</h1>
        </header>
        <div className="loading">loading...</div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>fathom</h1>
        <span className="header-subtitle">what happened</span>
        {weather && (
          <div className="weather-pill">
            <WeatherIcon icon={weather.icon} />
            <span className="weather-temp">{weather.temp}°</span>
          </div>
        )}
      </header>
      <div className="feed-unread-banner" onClick={onChatOpen}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
          <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <span>4 new messages from fathom</span>
      </div>

      <div className="feed">
        {renderGroups(groupByWorkspace(newItems), onOpenReceipt)}
      </div>

      {earlierItems.length > 0 && (
        <div className="feed-earlier">
          <button
            className="feed-earlier-toggle"
            onClick={() => setEarlierOpen(!earlierOpen)}
          >
            <span className="feed-earlier-label">
              Earlier · {earlierItems.length}
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                width="14"
                height="14"
                className={`feed-earlier-chevron ${earlierOpen ? "open" : ""}`}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </span>
          </button>
          {earlierOpen && (
            <div className="feed feed-earlier-items">
              {renderGroups(groupByWorkspace(earlierItems), onOpenReceipt)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
