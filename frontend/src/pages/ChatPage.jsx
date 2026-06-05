import { MessageSquare, Plus, Search, Users } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import api from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import ChatWindow from "../components/ChatWindow.jsx";

export default function ChatPage() {
  const { user } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState(id ? Number(id) : null);
  const [showNewDM, setShowNewDM] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);

  const fetchConversations = useCallback(async () => {
    try {
      const { data } = await api.get("/chat/conversations/");
      const list = Array.isArray(data) ? data : data.results || [];
      setConversations(list);
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  useEffect(() => {
    if (id) setActiveId(Number(id));
  }, [id]);

  const activeConv = conversations.find((c) => c.id === activeId);

  const openConv = (convId) => {
    setActiveId(convId);
    navigate(`/messages/${convId}`, { replace: true });
  };

  const onNewConversation = (conv) => {
    setConversations((prev) => {
      const exists = prev.find((c) => c.id === conv.id);
      return exists ? prev : [conv, ...prev];
    });
    openConv(conv.id);
    setShowNewDM(false);
    setShowNewGroup(false);
  };

  // Update conversation in list when a new message arrives (bubble it to top)
  const bumpConversation = (convId) => {
    setConversations((prev) => {
      const conv = prev.find((c) => c.id === convId);
      if (!conv) return prev;
      return [conv, ...prev.filter((c) => c.id !== convId)];
    });
  };

  if (!user) return <main className="shell"><div className="panel">Please log in to use messages.</div></main>;

  return (
    <main className="chat-page">
      {/* ── Sidebar ── */}
      <aside className="chat-sidebar">
        <div className="chat-sidebar-head">
          <h2>Messages</h2>
          <div className="chat-new-actions">
            <button className="icon-button" title="New DM" onClick={() => { setShowNewDM(true); setShowNewGroup(false); }}>
              <Plus size={18} />
            </button>
            <button className="icon-button" title="New Group" onClick={() => { setShowNewGroup(true); setShowNewDM(false); }}>
              <Users size={18} />
            </button>
          </div>
        </div>

        {showNewDM && (
          <NewDMPanel onCreated={onNewConversation} onClose={() => setShowNewDM(false)} currentUserId={user.id} />
        )}
        {showNewGroup && (
          <NewGroupPanel onCreated={onNewConversation} onClose={() => setShowNewGroup(false)} currentUserId={user.id} />
        )}

        {loading ? (
          <div className="chat-loading">Loading...</div>
        ) : conversations.length === 0 ? (
          <div className="chat-empty-list">
            <MessageSquare size={32} />
            <p>No messages yet</p>
            <p className="muted">Start a new conversation</p>
          </div>
        ) : (
          <ul className="conv-list">
            {conversations.map((conv) => (
              <li key={conv.id}>
                <button
                  className={`conv-item ${conv.id === activeId ? "active" : ""}`}
                  onClick={() => openConv(conv.id)}
                >
                  <div className="conv-avatar">
                    {conv.is_group ? (
                      <Users size={20} />
                    ) : (
                      getOtherParticipant(conv, user)?.username?.[0]?.toUpperCase() || "?"
                    )}
                  </div>
                  <div className="conv-info">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong className="conv-name">{getConvName(conv, user)}</strong>
                      {conv.unread_count > 0 && <span className="badge unread-badge">{conv.unread_count}</span>}
                    </div>
                    {conv.last_message && (
                      <span className="conv-preview muted">
                        {conv.last_message.sender?.username === user.username ? "You: " : ""}
                        {truncate(conv.last_message.body, 40)}
                      </span>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      {/* ── Chat Window ── */}
      <section className="chat-main">
        {activeId ? (
          <ChatWindow
            key={activeId}
            conversationId={activeId}
            currentUser={user}
            conversationMeta={activeConv}
            onMessageSent={() => bumpConversation(activeId)}
          />
        ) : (
          <div className="chat-welcome">
            <MessageSquare size={56} className="chat-welcome-icon" />
            <h2>Your Messages</h2>
            <p className="muted">Select a conversation or start a new one.</p>
          </div>
        )}
      </section>
    </main>
  );
}

// ── Helpers ──
function getOtherParticipant(conv, currentUser) {
  return conv.participants?.find((p) => p.id !== currentUser.id);
}

function getConvName(conv, currentUser) {
  if (conv.is_group) return conv.name || "Group";
  const other = getOtherParticipant(conv, currentUser);
  return other?.full_name || other?.username || "User";
}

function truncate(str, n) {
  return str?.length > n ? str.slice(0, n) + "..." : str;
}

// ── New DM panel ──
function NewDMPanel({ onCreated, onClose, currentUserId }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get(`/search/?q=${encodeURIComponent(query)}`);
        setResults((data.users || []).filter((u) => u.id !== currentUserId));
      } catch { setResults([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const start = async (userId) => {
    if (creating) return;
    setCreating(true);
    try {
      const { data } = await api.post("/chat/conversations/", {
        is_group: false,
        participant_ids: [userId],
      });
      onCreated(data);
    } finally { setCreating(false); }
  };

  return (
    <div className="new-conv-panel">
      <div className="new-conv-head">
        <span>New Message</span>
        <button className="icon-button" onClick={onClose}>✕</button>
      </div>
      <div className="new-conv-search">
        <Search size={15} />
        <input autoFocus placeholder="Search people..." value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <ul className="new-conv-results">
        {results.map((u) => (
          <li key={u.id}>
            <button className="new-conv-user" onClick={() => start(u.id)} disabled={creating}>
              <span className="user-list-avatar small">{u.username[0].toUpperCase()}</span>
              <span>
                <strong>{u.full_name || u.username}</strong>
                <span className="muted"> @{u.username}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── New Group panel ──
function NewGroupPanel({ onCreated, onClose, currentUserId }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState([]);
  const [groupName, setGroupName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get(`/search/?q=${encodeURIComponent(query)}`);
        setResults((data.users || []).filter((u) => u.id !== currentUserId));
      } catch { setResults([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const toggleSelect = (u) => {
    setSelected((prev) =>
      prev.find((s) => s.id === u.id) ? prev.filter((s) => s.id !== u.id) : [...prev, u]
    );
  };

  const create = async () => {
    if (!groupName.trim() || selected.length === 0 || creating) return;
    setCreating(true);
    try {
      const { data } = await api.post("/chat/conversations/", {
        is_group: true,
        name: groupName.trim(),
        participant_ids: selected.map((s) => s.id),
      });
      onCreated(data);
    } finally { setCreating(false); }
  };

  return (
    <div className="new-conv-panel">
      <div className="new-conv-head">
        <span>New Group</span>
        <button className="icon-button" onClick={onClose}>✕</button>
      </div>
      <input
        className="group-name-input"
        placeholder="Group name..."
        value={groupName}
        onChange={(e) => setGroupName(e.target.value)}
      />
      {selected.length > 0 && (
        <div className="selected-members">
          {selected.map((u) => (
            <span key={u.id} className="member-chip">
              @{u.username}
              <button onClick={() => toggleSelect(u)}>✕</button>
            </span>
          ))}
        </div>
      )}
      <div className="new-conv-search">
        <Search size={15} />
        <input placeholder="Add members..." value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <ul className="new-conv-results">
        {results.map((u) => {
          const isSelected = selected.find((s) => s.id === u.id);
          return (
            <li key={u.id}>
              <button className={`new-conv-user ${isSelected ? "selected" : ""}`} onClick={() => toggleSelect(u)}>
                <span className="user-list-avatar small">{u.username[0].toUpperCase()}</span>
                <span>
                  <strong>{u.full_name || u.username}</strong>
                  <span className="muted"> @{u.username}</span>
                </span>
                {isSelected && <span className="check-mark">✓</span>}
              </button>
            </li>
          );
        })}
      </ul>
      <button
        className="create-group-btn"
        onClick={create}
        disabled={!groupName.trim() || selected.length === 0 || creating}
      >
        {creating ? "Creating..." : `Create Group (${selected.length + 1} members)`}
      </button>
    </div>
  );
}
