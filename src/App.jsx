import { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Feed from "./components/Feed.jsx";
import Routines from "./components/Routines.jsx";
import ChatSheet from "./components/ChatSheet.jsx";
import NavBar from "./components/NavBar.jsx";
import ReceiptDetail from "./components/ReceiptDetail.jsx";

export default function App() {
  const [chatOpen, setChatOpen] = useState(false);
  const [pendingVoice, setPendingVoice] = useState("");
  const [receiptId, setReceiptId] = useState(null);

  function handleVoiceResult(text) {
    setPendingVoice(text);
    setChatOpen(true);
  }

  function consumeVoice() {
    const text = pendingVoice;
    setPendingVoice("");
    return text;
  }

  return (
    <div className="app">
      <Routes>
        <Route path="/" element={
          <Feed
            onChatOpen={() => setChatOpen(true)}
            onOpenReceipt={(id) => setReceiptId(id)}
          />
        } />
        <Route path="/routines" element={<Routines />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <NavBar
        onChatOpen={() => setChatOpen(true)}
        onVoiceResult={handleVoiceResult}
      />
      <ChatSheet
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        consumeVoice={consumeVoice}
        pendingVoice={pendingVoice}
      />
      <ReceiptDetail
        receiptId={receiptId}
        onClose={() => setReceiptId(null)}
      />
    </div>
  );
}
