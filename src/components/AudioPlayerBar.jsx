import { useState } from "react";
import { Play, Pause, X } from "lucide-react";
import { useAudioPlayer } from "../contexts/AudioPlayerContext.jsx";

export default function AudioPlayerBar() {
  const { track, playing, currentTime, duration, formatTime, play, pause, seek, close } = useAudioPlayer();
  const [exiting, setExiting] = useState(false);

  if (!track && !exiting) return null;

  function handleClose() {
    setExiting(true);
  }

  function handleAnimEnd(e) {
    if (e.animationName === "audio-player-slide-out") {
      close();
      setExiting(false);
    }
  }

  function handlePlayPause() {
    if (playing) {
      pause();
    } else {
      play(track.url, track.label, track.type);
    }
  }

  function handleSeek(e) {
    seek(Number(e.target.value));
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="audio-player-container">
      <div
        className={`audio-player-bar ${exiting ? "audio-player-exit" : ""}`}
        onAnimationEnd={handleAnimEnd}
      >
        <button className="audio-player-btn" onClick={handlePlayPause} aria-label={playing ? "Pause" : "Play"}>
          {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
        </button>

        <span className="audio-player-label">{track?.label}</span>

        <input
          className="audio-player-scrubber"
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={currentTime}
          onChange={handleSeek}
          style={{ "--progress": `${progress}%` }}
          aria-label="Seek"
        />

        <span className="audio-player-time">
          {formatTime(currentTime)}/{formatTime(duration)}
        </span>

        <button className="audio-player-close" onClick={handleClose} aria-label="Close player">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
