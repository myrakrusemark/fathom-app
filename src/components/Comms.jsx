import { useState, useEffect } from "react";
import { listRooms, readRoom } from "../api/client.js";

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

function RoomRow({ room, onSelect }) {
  const unread = room.unread_count || 0;

  return (
    <button className="room-row" onClick={() => onSelect(room.name)}>
      <div className="room-row-main">
        <span className="room-name">{room.name}</span>
        {room.description && <span className="room-desc">{room.description}</span>}
      </div>
      <div className="room-row-meta">
        {unread > 0 && <span className="room-badge">{unread}</span>}
        <span className="room-ago">{timeAgo(room.last_activity)}</span>
      </div>
    </button>
  );
}

function RoomView({ roomName, onBack }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    readRoom(roomName, 1440)
      .then((data) => setMessages(data.messages || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [roomName]);

  return (
    <div className="room-view">
      <button className="room-back-btn" onClick={onBack}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        {roomName}
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState(null);

  useEffect(() => {
    listRooms()
      .then((data) => setRooms(data.rooms || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (selectedRoom) {
    return <RoomView roomName={selectedRoom} onBack={() => setSelectedRoom(null)} />;
  }

  if (loading) return <div className="loading">loading...</div>;
  if (error) return <div className="empty-state">{error}</div>;
  if (!rooms || rooms.length === 0) {
    return <div className="empty-state">No rooms yet.</div>;
  }

  // Sort: rooms with unread first, then by last_activity
  const sorted = [...rooms].sort((a, b) => {
    if ((b.unread_count || 0) !== (a.unread_count || 0)) {
      return (b.unread_count || 0) - (a.unread_count || 0);
    }
    return (b.last_activity || 0) - (a.last_activity || 0);
  });

  return (
    <div className="comms-list">
      {sorted.map((room) => (
        <RoomRow key={room.name} room={room} onSelect={setSelectedRoom} />
      ))}
    </div>
  );
}
