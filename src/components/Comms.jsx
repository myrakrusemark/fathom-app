import { useState, useEffect } from "react";
import { listRooms, readRoom, getWorkspaceProfiles } from "../api/client.js";

function timeAgo(timestamp) {
  if (!timestamp) return "";
  const diff = Date.now() - new Date(timestamp * 1000).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function prettyName(slug) {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function displayRoomName(name) {
  if (name.startsWith("dm:")) {
    const participants = name.slice(3).split("+");
    return participants.map(prettyName).join(" · ");
  }
  if (name.startsWith("mentions:")) {
    return `@${name.slice(9)}`;
  }
  if (name.startsWith("notif-")) {
    return name;
  }
  return `#${name}`;
}

function roomType(name) {
  if (name.startsWith("dm:")) return "dm";
  if (name.startsWith("mentions:")) return "room";
  if (name.startsWith("notif-")) return "thread";
  return "room";
}

function RoomRow({ room, onSelect, showUnread = true }) {
  const unread = room.unread_count || 0;
  const isDM = room.name.startsWith("dm:");
  const isThread = room.name.startsWith("notif-");

  return (
    <button className={`room-row ${isThread ? "thread" : ""}`} onClick={() => onSelect(room.name)}>
      <div className="room-row-main">
        <span className="room-name">
          {isDM && <span className="room-type-badge dm">DM</span>}
          {isThread && (
            <span className="room-thread-count">{room.message_count || 0}</span>
          )}
          {displayRoomName(room.name)}
        </span>
        {room.description && <span className="room-desc">{room.description}</span>}
      </div>
      <div className="room-row-meta">
        {showUnread && unread > 0 && <span className="room-badge">{unread}</span>}
        <span className="room-ago">{timeAgo(room.last_activity)}</span>
      </div>
    </button>
  );
}

function RoomView({ roomName, perspective, onBack }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    readRoom(roomName, 1440, perspective === "all" ? null : perspective)
      .then((data) => setMessages(data.messages || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [roomName, perspective]);

  return (
    <div className="room-view">
      <button className="room-back-btn" onClick={onBack}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        {displayRoomName(roomName)}
      </button>
      <div className="room-messages">
        {loading && <div className="loading">loading...</div>}
        {!loading && messages.length === 0 && (
          <div className="empty-state">No messages in the last 24 hours.</div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className="room-message">
            <span className="room-msg-sender">{msg.sender}</span>
            <span className="room-msg-text">{msg.message}</span>
            <span className="room-msg-time">{timeAgo(msg.timestamp)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Comms() {
  const [rooms, setRooms] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [typeFilter, setTypeFilter] = useState("all"); // "all" | "room" | "dm" | "thread"
  const [perspective, setPerspective] = useState("all");

  function loadRooms(ws) {
    setLoading(true);
    listRooms(ws === "all" ? "*" : ws)
      .then((data) => setRooms(data.rooms || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadRooms(perspective);
    getWorkspaceProfiles()
      .then((data) => {
        const entries = Object.entries(data.workspaces || data.profiles || data)
          .filter(([, v]) => typeof v === "object" && v.type !== "human")
          .map(([name]) => name);
        setWorkspaces(entries);
      })
      .catch(() => {});
  }, []);

  function handlePerspectiveChange(ws) {
    setPerspective(ws);
    loadRooms(ws);
  }

  async function markAllRead() {
    if (!rooms) return;
    const unread = rooms.filter((r) => (r.unread_count || 0) > 0);
    await Promise.all(unread.map((r) => readRoom(r.name, 1, perspective)));
    loadRooms(perspective);
  }

  if (selectedRoom) {
    return <RoomView roomName={selectedRoom} perspective={perspective} onBack={() => { loadRooms(perspective); setSelectedRoom(null); }} />;
  }

  if (loading) return <div className="loading">loading...</div>;
  if (error) return <div className="empty-state">{error}</div>;
  if (!rooms || rooms.length === 0) {
    return <div className="empty-state">No rooms yet.</div>;
  }

  const filtered = rooms.filter((r) => {
    if (typeFilter === "all") return true;
    return roomType(r.name) === typeFilter;
  });

  const mentions = filtered.filter((r) => r.name.startsWith("mentions:"));
  const rest = filtered.filter((r) => !r.name.startsWith("mentions:"));
  const sorted = [
    ...mentions.sort((a, b) => (b.last_activity || 0) - (a.last_activity || 0)),
    ...rest.sort((a, b) => (b.last_activity || 0) - (a.last_activity || 0)),
  ];

  return (
    <div className="comms-list">
      <div className="comms-filter-bar">
        <div className="routines-filter-chips">
          {["all", "room", "dm", "thread"].map((t) => (
            <button
              key={t}
              className={`routines-chip ${typeFilter === t ? "active" : ""}`}
              onClick={() => setTypeFilter(t)}
            >
              {t === "all" ? "all" : t === "room" ? "rooms" : t === "dm" ? "DMs" : "threads"}
            </button>
          ))}
        </div>
        <select
          className="comms-perspective-select"
          value={perspective}
          onChange={(e) => handlePerspectiveChange(e.target.value)}
        >
          <option value="all">All</option>
          <option value="myra">Myra</option>
          {workspaces.map((ws) => (
            <option key={ws} value={ws}>{prettyName(ws)}</option>
          ))}
        </select>
      </div>
      {perspective !== "all" && rooms.some((r) => (r.unread_count || 0) > 0) && (
        <div style={{ textAlign: "center", padding: "8px 0" }}>
          <button className="routines-chip" onClick={markAllRead}>Mark all read</button>
        </div>
      )}
      {sorted.map((room) => (
        <RoomRow key={room.name} room={room} onSelect={setSelectedRoom} showUnread={perspective !== "all"} />
      ))}
      {sorted.length === 0 && (
        <div className="empty-state">No matching rooms</div>
      )}
    </div>
  );
}
