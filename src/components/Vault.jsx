import { useState, useEffect, useRef, useCallback } from "react";
import { X } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import { feedSanitizeSchema } from "../lib/sanitize.js";
import {
  getVaultFiles,
  getVaultFile,
  searchVault,
  vaultRawUrl,
  getWorkspaceProfiles,
} from "../api/client.js";
import { timeAgo, prettyName } from "../lib/formatters.js";

function titleFromPath(path) {
  const parts = path.split("/");
  const filename = parts[parts.length - 1];
  return filename.replace(/\.md$/, "").replace(/[-_]/g, " ");
}

function folderFromPath(path) {
  const parts = path.split("/");
  if (parts.length <= 1) return "";
  return parts.slice(0, -1).join("/");
}

function FileRow({ file, onSelect, showScore }) {
  const title = file.title || titleFromPath(file.path);
  const folder = folderFromPath(file.path);
  const time = file.modified || file.last_opened;
  const score = file.activity_score ?? file.score;

  return (
    <button className="room-row vault-file-row" onClick={() => onSelect(file)}>
      <div className="room-row-main">
        <span className="room-name">{title}</span>
        {folder && <span className="vault-file-subtitle">{folder}</span>}
        {file.excerpt && <span className="vault-file-excerpt">{file.excerpt}</span>}
        {file.preview && !file.excerpt && <span className="vault-file-excerpt">{file.preview}</span>}
      </div>
      <div className="room-row-meta">
        {showScore && score != null && score > 0 && (
          <span className="vault-score">{score < 1 ? score.toFixed(2) : Math.round(score)}</span>
        )}
        <span className="room-ago">{timeAgo(time)}</span>
      </div>
    </button>
  );
}

function FilePanel({ file, workspace, onClose }) {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  useEffect(() => {
    setLoading(true);
    getVaultFile(file.path, workspace)
      .then((data) => setContent(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [file, workspace]);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 200);
  }

  const filePath = file.path;
  const title = content?.frontmatter?.title || file.title || titleFromPath(filePath);
  const folder = folderFromPath(filePath);
  const tags = content?.frontmatter?.tags || [];

  const markdownComponents = {
    img({ src, alt, ...rest }) {
      if (src && !src.startsWith("http")) {
        const dir = folderFromPath(filePath);
        const resolved = dir ? `${dir}/${src}` : src;
        return <img src={vaultRawUrl(resolved, workspace)} alt={alt} {...rest} />;
      }
      return <img src={src} alt={alt} {...rest} />;
    },
  };

  return (
    <div className={`feed-panel-backdrop ${visible ? "visible" : ""}`} onClick={handleClose}>
      <div className={`feed-panel ${visible ? "visible" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="feed-panel-scroll">
          <div className="feed-panel-top-actions">
            <button className="feed-panel-close" onClick={handleClose} aria-label="Close">
              <X size={20} />
            </button>
          </div>

          {folder && <span className="vault-file-path">{folder}</span>}
          <h2 className="feed-panel-title">{title}</h2>

          {tags.length > 0 && (
            <div className="vault-tags">
              {tags.map((tag) => (
                <span key={tag} className="vault-tag">{tag}</span>
              ))}
            </div>
          )}

          {loading && <div className="loading">loading...</div>}
          {!loading && content && (
            <div className="vault-detail-content">
              <Markdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw, [rehypeSanitize, feedSanitizeSchema]]}
                components={markdownComponents}
              >
                {content.body || content.content || ""}
              </Markdown>
            </div>
          )}
          {!loading && !content && <div className="empty-state">Could not load file.</div>}
        </div>
      </div>
    </div>
  );
}

export default function Vault() {
  const [workspace, setWorkspace] = useState("fathom");
  const [workspaces, setWorkspaces] = useState([]);
  const [sortMode, setSortMode] = useState("recent");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState(null);
  const debounceRef = useRef(null);

  // Load workspace list once
  useEffect(() => {
    getWorkspaceProfiles()
      .then((data) => {
        const entries = Object.entries(data.workspaces || data.profiles || data)
          .filter(([, v]) => typeof v === "object" && v.type !== "human")
          .map(([name]) => name);
        setWorkspaces(entries);
      })
      .catch(() => {});
  }, []);

  // Debounce search
  const handleSearchChange = useCallback((value) => {
    setSearchQuery(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(value), 300);
  }, []);

  // Fetch files when workspace, sort, or search changes
  useEffect(() => {
    setLoading(true);

    if (debouncedQuery.trim()) {
      searchVault(debouncedQuery, workspace)
        .then((data) => {
          const results = (data.results || []).map((r) => ({
            path: r.file,
            title: r.title,
            score: r.score,
            excerpt: r.excerpt,
          }));
          setFiles(results);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    } else {
      getVaultFiles(workspace, 200)
        .then((data) => {
          let items = data.files || [];
          if (sortMode === "active") {
            items = [...items].sort((a, b) => (b.activity_score || 0) - (a.activity_score || 0));
          }
          // Default "recent" is already sorted by modified from server
          setFiles(items);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [workspace, sortMode, debouncedQuery]);

  const isSearching = debouncedQuery.trim().length > 0;

  return (
    <div className="comms-list">
      <div className="routines-filter-bar">
        <input
          className="routines-filter"
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search vault..."
        />
        <div className="comms-filter-bar">
          {!isSearching && (
            <div className="routines-filter-chips">
              {["recent", "active"].map((mode) => (
                <button
                  key={mode}
                  className={`routines-chip ${sortMode === mode ? "active" : ""}`}
                  onClick={() => setSortMode(mode)}
                >
                  {mode}
                </button>
              ))}
            </div>
          )}
          <select
            className="comms-perspective-select"
            value={workspace}
            onChange={(e) => setWorkspace(e.target.value)}
          >
            {workspaces.map((ws) => (
              <option key={ws} value={ws}>{prettyName(ws)}</option>
            ))}
          </select>
        </div>
      </div>
      {loading && <div className="loading">loading...</div>}
      {!loading && files.length === 0 && (
        <div className="empty-state">{isSearching ? "No results" : "No files"}</div>
      )}
      {!loading &&
        files.map((file) => (
          <FileRow
            key={file.path}
            file={file}
            onSelect={setSelectedFile}
            showScore={sortMode === "active" || isSearching}
          />
        ))}
      {selectedFile && (
        <FilePanel
          file={selectedFile}
          workspace={workspace}
          onClose={() => setSelectedFile(null)}
        />
      )}
    </div>
  );
}
