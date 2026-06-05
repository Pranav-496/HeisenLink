import {
  Copy, CornerDownLeft, Forward, Pin, Send, Smile, Trash2, Users, X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import api from "../api/client.js";

const EMOJI_LIST = ["👍", "❤️", "😂", "😮", "😢", "🔥", "🎉", "👏"];
const WS_BASE = import.meta.env.VITE_WS_URL || "ws://localhost:8000";

export default function ChatWindow({ conversationId, currentUser, conversationMeta, onMessageSent, onBack }) {
  const [messages, setMessages]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [body, setBody]             = useState("");
  const [replyTo, setReplyTo]       = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);
  const [emojiPickerFor, setEmojiPickerFor] = useState(null);
  const [pinnedMessage, setPinnedMessage]   = useState(conversationMeta?.pinned_message || null);
  const [forwardMsg, setForwardMsg] = useState(null);
  const wsRef          = useRef(null);
  const bottomRef      = useRef(null);
  const typingTimerRef = useRef(null);
  const inputRef       = useRef(null);

  useEffect(() => {
    setPinnedMessage(conversationMeta?.pinned_message || null);
  }, [conversationId, conversationMeta?.pinned_message?.id]);

  // ── Load history ──────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    api.get(`/chat/conversations/${conversationId}/messages/`)
      .then(({ data }) => {
        setMessages(Array.isArray(data) ? data : data.results || []);
        api.post(`/chat/conversations/${conversationId}/read/`).catch(() => {});
      })
      .finally(() => setLoading(false));
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUsers]);

  // ── WebSocket ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem("heisenlink_access");
    if (!token) return;
    const ws = new WebSocket(`${WS_BASE}/ws/chat/${conversationId}/?token=${token}`);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);

      if (data.type === "message") {
        setMessages((prev) =>
          prev.find((m) => m.id === data.message.id) ? prev : [...prev, data.message]
        );
        onMessageSent?.();

      } else if (data.type === "unsend") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === data.message_id ? { ...m, is_deleted: true, body: "", display_body: null } : m
          )
        );

      } else if (data.type === "pin") {
        setPinnedMessage(data.message || null);

      } else if (data.type === "reaction") {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== data.message_id) return m;
            const reactions = m.reactions || [];
            if (data.action === "added") {
              if (reactions.find((r) => r.user?.id === data.user_id && r.emoji === data.emoji)) return m;
              return { ...m, reactions: [...reactions, { id: Date.now(), user: { id: data.user_id, username: data.username }, emoji: data.emoji }] };
            }
            return { ...m, reactions: reactions.filter((r) => !(r.user?.id === data.user_id && r.emoji === data.emoji)) };
          })
        );

      } else if (data.type === "typing") {
        if (data.user_id === currentUser.id) return;
        setTypingUsers((prev) =>
          data.is_typing ? (prev.includes(data.username) ? prev : [...prev, data.username])
                         : prev.filter((u) => u !== data.username)
        );

      } else if (data.type === "read") {
        if (data.user_id === currentUser.id) return;
        setMessages((prev) =>
          prev.map((m) =>
            m.sender?.id === currentUser.id && !(m.read_by || []).includes(data.user_id)
              ? { ...m, read_by: [...(m.read_by || []), data.user_id] }
              : m
          )
        );
      }
    };

    ws.onclose = () => {};
    ws.onerror = () => {};
    return () => { ws.close(); wsRef.current = null; };
  }, [conversationId]);

  // ── Typing ────────────────────────────────────────────────────────────────
  const sendTyping = (isTyping) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: "typing", is_typing: isTyping }));
    }
  };

  const handleInputChange = (e) => {
    setBody(e.target.value);
    sendTyping(true);
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => sendTyping(false), 1500);
  };

  // ── Send ──────────────────────────────────────────────────────────────────
  const sendMessage = async () => {
    const text = body.trim();
    if (!text) return;
    const replyId = replyTo?.id ?? null;
    setBody("");
    setReplyTo(null);
    sendTyping(false);
    clearTimeout(typingTimerRef.current);
    inputRef.current?.focus();
    try {
      const { data } = await api.post(`/chat/conversations/${conversationId}/messages/send/`, {
        body: text, reply_to: replyId,
      });
      setMessages((prev) => prev.find((m) => m.id === data.id) ? prev : [...prev, data]);
      onMessageSent?.();
    } catch { setBody(text); }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  // ── Reactions ─────────────────────────────────────────────────────────────
  const sendReaction = async (messageId, emoji) => {
    setEmojiPickerFor(null);
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const reactions = m.reactions || [];
        const exists = reactions.find((r) => r.user?.id === currentUser.id && r.emoji === emoji);
        if (exists) return { ...m, reactions: reactions.filter((r) => !(r.user?.id === currentUser.id && r.emoji === emoji)) };
        return { ...m, reactions: [...reactions, { id: Date.now(), user: { id: currentUser.id, username: currentUser.username }, emoji }] };
      })
    );
    try { await api.post(`/chat/messages/${messageId}/react/`, { emoji }); } catch {}
  };

  // ── Unsend / Pin ──────────────────────────────────────────────────────────
  const handleUnsend = async (messageId) => {
    try {
      await api.delete(`/chat/messages/${messageId}/unsend/`);
      setMessages((prev) =>
        prev.map((m) => m.id === messageId ? { ...m, is_deleted: true, body: "", display_body: null } : m)
      );
    } catch {}
  };

  const handlePin = async (message) => {
    try {
      const { data } = await api.post(`/chat/messages/${message.id}/pin/`);
      setPinnedMessage(data.pinned ? data.message : null);
    } catch {}
  };

  // ── Date grouping ─────────────────────────────────────────────────────────
  const groupByDate = (msgs) => {
    const groups = [];
    let lastDate = null;
    msgs.forEach((msg) => {
      const date = new Date(msg.created_at).toDateString();
      if (date !== lastDate) { groups.push({ type: "date", label: formatDateLabel(date) }); lastDate = date; }
      groups.push({ type: "msg", msg });
    });
    return groups;
  };

  const otherUser = conversationMeta && !conversationMeta.is_group
    ? conversationMeta.participants?.find((p) => p.id !== currentUser.id)
    : null;

  const convName = conversationMeta
    ? conversationMeta.is_group
      ? conversationMeta.name || "Group"
      : otherUser?.full_name || otherUser?.username || "Chat"
    : "Chat";

  return (
    <div className="chat-window">

      {/* Header */}
      <div className="chat-win-header">
        {onBack && (
          <button className="icon-button mobile-only" onClick={onBack} style={{ marginRight: 8 }}>
            <CornerDownLeft size={18} />
          </button>
        )}
        {otherUser ? (
          <Link to={`/users/${otherUser.id}`} style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
            <WinAvatar name={convName} isGroup={conversationMeta?.is_group} />
            <WinMeta convName={convName} meta={conversationMeta} typingUsers={typingUsers} count={messages.length} />
          </Link>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
            <WinAvatar name={convName} isGroup={conversationMeta?.is_group} />
            <WinMeta convName={convName} meta={conversationMeta} typingUsers={typingUsers} count={messages.length} />
          </div>
        )}
      </div>

      {/* Pinned message banner */}
      {pinnedMessage && (
        <div className="pinned-banner">
          <Pin size={12} className="pin-icon-sm" />
          <div className="pinned-banner-body">
            <span className="pinned-banner-label">Pinned</span>
            <span className="pinned-banner-text">
              {truncate(pinnedMessage.display_body || pinnedMessage.body || "Message", 80)}
            </span>
          </div>
          <button className="pinned-banner-close icon-button" onClick={() => handlePin(pinnedMessage)}>
            <X size={12} />
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="chat-messages" onClick={() => setEmojiPickerFor(null)}>
        {loading && <div className="chat-loading">Loading messages…</div>}
        {!loading && messages.length === 0 && (
          <div className="chat-no-messages">
            <p className="muted">No messages yet. Say hello! 👋</p>
          </div>
        )}

        {groupByDate(messages).map((item, i) =>
          item.type === "date" ? (
            <div key={`date-${i}`} className="chat-date-divider"><span>{item.label}</span></div>
          ) : (
            <MessageBubble
              key={item.msg.id}
              message={item.msg}
              isOwn={item.msg.sender?.id === currentUser.id}
              isGroup={conversationMeta?.is_group}
              currentUser={currentUser}
              pinnedMessageId={pinnedMessage?.id}
              onReply={(msg) => { setReplyTo(msg); inputRef.current?.focus(); }}
              onReact={(msgId) => setEmojiPickerFor(emojiPickerFor === msgId ? null : msgId)}
              showEmojiPicker={emojiPickerFor === item.msg.id}
              onPickEmoji={(emoji) => sendReaction(item.msg.id, emoji)}
              onUnsend={handleUnsend}
              onPin={handlePin}
              onForward={(msg) => setForwardMsg(msg)}
            />
          )
        )}

        {typingUsers.length > 0 && (
          <div className="typing-indicator">
            <span className="typing-dots"><span /><span /><span /></span>
            <span className="muted">{typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing…</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Reply preview */}
      {replyTo && (
        <div className="reply-preview">
          <CornerDownLeft size={14} />
          <span>Replying to <strong>{replyTo.sender?.username}</strong>: {truncate(replyTo.display_body || replyTo.body, 60)}</span>
          <button className="reply-cancel" onClick={() => setReplyTo(null)}><X size={14} /></button>
        </div>
      )}

      {/* Input bar */}
      <div className="chat-input-bar">
        <textarea
          ref={inputRef}
          className="chat-input"
          placeholder="Message…"
          value={body}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          rows={1}
        />
        <button className="chat-send-btn" onClick={sendMessage} disabled={!body.trim()}>
          <Send size={18} />
        </button>
      </div>

      {/* Forward modal */}
      {forwardMsg && (
        <ForwardModal
          message={forwardMsg}
          currentConvId={conversationId}
          onClose={() => setForwardMsg(null)}
          onForwarded={() => setForwardMsg(null)}
        />
      )}
    </div>
  );
}

// ── Header helpers ────────────────────────────────────────────────────────────

function WinAvatar({ name, isGroup }) {
  return (
    <div className="chat-win-avatar" style={{ position: "relative" }}>
      {isGroup ? <Users size={20} /> : name?.[0]?.toUpperCase()}
      {!isGroup && (
        <div style={{ position: "absolute", bottom: 0, right: 0, width: 10, height: 10, background: "#4caf50", border: "2px solid var(--bg-surface)", borderRadius: "50%" }} />
      )}
    </div>
  );
}

function WinMeta({ convName, meta, typingUsers, count }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <strong style={{ color: "var(--text)" }}>{convName}</strong>
        <span className="muted" style={{ fontSize: 11 }}>{count} messages</span>
      </div>
      {typingUsers.length > 0 ? (
        <p style={{ margin: 0, fontSize: 12, color: "var(--accent)" }}>{typingUsers.join(", ")} is typing…</p>
      ) : meta?.is_group ? (
        <p className="muted" style={{ margin: 0, fontSize: 12 }}>{meta.participants?.length} members</p>
      ) : (
        <p className="muted" style={{ margin: 0, fontSize: 12 }}>Last active recently</p>
      )}
    </div>
  );
}

// ── MessageBubble ─────────────────────────────────────────────────────────────

function MessageBubble({
  message, isOwn, isGroup, currentUser, pinnedMessageId,
  onReply, onReact, showEmojiPicker, onPickEmoji,
  onUnsend, onPin, onForward,
}) {
  const [hovered, setHovered]           = useState(false);
  const [menuOpen, setMenuOpen]         = useState(false);
  const [showReactionModal, setShowRM]  = useState(null);
  const moreRef = useRef(null);

  // Close context menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => { if (!moreRef.current?.contains(e.target)) setMenuOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const reactionsByEmoji = {};
  (message.reactions || []).forEach((r) => {
    if (!reactionsByEmoji[r.emoji]) reactionsByEmoji[r.emoji] = [];
    reactionsByEmoji[r.emoji].push(r);
  });

  const isPinned = pinnedMessageId === message.id;

  const copyText = () => {
    navigator.clipboard.writeText(message.display_body || message.body || "");
    setMenuOpen(false);
  };

  // Layout: own messages → [actions | body], received → [body | actions]
  return (
    <div
      className={`chat-msg-row ${isOwn ? "own" : ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); }}
    >
      {/* Avatar — only for received */}
      {!isOwn && (
        <div className="chat-msg-avatar">
          {message.sender?.username?.[0]?.toUpperCase() || "?"}
        </div>
      )}

      {/* Action strip — LEFT of bubble for own messages */}
      {isOwn && !message.is_deleted && (
        <div className={`bubble-actions${hovered ? " visible" : ""}`}>
          <BubbleActions
            isOwn={isOwn}
            isPinned={isPinned}
            menuOpen={menuOpen}
            moreRef={moreRef}
            onReact={() => onReact(message.id)}
            onReply={() => onReply(message)}
            onMoreToggle={() => setMenuOpen((v) => !v)}
            onCopy={copyText}
            onForward={() => { onForward(message); setMenuOpen(false); }}
            onPin={() => { onPin(message); setMenuOpen(false); }}
            onUnsend={() => { onUnsend(message.id); setMenuOpen(false); }}
          />
        </div>
      )}

      {/* Body */}
      <div className="chat-msg-body-wrap">
        {!isOwn && <span className="chat-msg-sender">{message.sender?.username}</span>}

        {/* Reply quote */}
        {message.reply_to && (
          <div className="chat-reply-ref">
            <span className="muted">↩ {message.reply_to.sender?.username}: </span>
            {message.reply_to.is_deleted
              ? <em className="muted">Message unsent</em>
              : truncate(message.reply_to.display_body || message.reply_to.body, 60)}
          </div>
        )}

        {/* Bubble */}
        {message.is_deleted ? (
          <div className={`chat-bubble ${isOwn ? "own" : ""} unsent-bubble`}>
            🚫 Message unsent
          </div>
        ) : (
          <div className={`chat-bubble ${isOwn ? "own" : ""}${isPinned ? " pinned-bubble" : ""}`}>
            {message.display_body || message.body}
          </div>
        )}

        {/* Time + seen */}
        <div className={`msg-meta${isOwn ? " own" : ""}`}>
          <span className="chat-msg-time muted">{formatTime(message.created_at)}</span>
          {isOwn && (message.read_by?.length > 0) && (
            <span className="seen-indicator">Seen</span>
          )}
        </div>

        {/* Reactions */}
        {Object.keys(reactionsByEmoji).length > 0 && (
          <div className="chat-reactions">
            {Object.entries(reactionsByEmoji).map(([emoji, reacts]) => {
              const mine = reacts.some((r) => r.user?.id === currentUser.id);
              return (
                <button
                  key={emoji}
                  className={`reaction-pill${mine ? " active" : ""}`}
                  onClick={(e) => { e.stopPropagation(); setShowRM(emoji); }}
                >
                  <span className="emoji">{emoji}</span>
                  {isGroup && <span className="count">{reacts.length}</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Action strip — RIGHT of bubble for received messages */}
      {!isOwn && !message.is_deleted && (
        <div className={`bubble-actions${hovered ? " visible" : ""}`}>
          <BubbleActions
            isOwn={isOwn}
            isPinned={isPinned}
            menuOpen={menuOpen}
            moreRef={moreRef}
            onReact={() => onReact(message.id)}
            onReply={() => onReply(message)}
            onMoreToggle={() => setMenuOpen((v) => !v)}
            onCopy={copyText}
            onForward={() => { onForward(message); setMenuOpen(false); }}
            onPin={() => { onPin(message); setMenuOpen(false); }}
            onUnsend={null}  // received messages can't be unsent
          />
        </div>
      )}

      {/* Emoji picker */}
      {showEmojiPicker && (
        <div className={`emoji-picker ${isOwn ? "left" : "right"}`} onClick={(e) => e.stopPropagation()}>
          {EMOJI_LIST.map((e) => (
            <button key={e} className="emoji-btn" onClick={() => onPickEmoji(e)}>{e}</button>
          ))}
        </div>
      )}

      {/* Reaction viewer */}
      {showReactionModal && (
        <div className="reaction-modal-overlay" onClick={() => setShowRM(null)}>
          <div className="reaction-modal" onClick={(e) => e.stopPropagation()}>
            <div className="reaction-modal-head">
              <strong>Reactions {showReactionModal}</strong>
              <button className="icon-button" onClick={() => setShowRM(null)}><X size={16} /></button>
            </div>
            <div className="reaction-modal-body">
              {reactionsByEmoji[showReactionModal]?.map((r) => (
                <div key={r.id || r.user.id} className="reaction-user-row">
                  <div className="reaction-user-avatar">{r.user?.username?.[0]?.toUpperCase()}</div>
                  <div className="reaction-user-info">
                    <strong>{r.user?.username}</strong>
                    <span className="muted">{formatTime(r.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Action strip shared component ─────────────────────────────────────────────

function BubbleActions({ isOwn, isPinned, menuOpen, moreRef, onReact, onReply, onMoreToggle, onCopy, onForward, onPin, onUnsend }) {
  return (
    <div className="bubble-action-strip" ref={moreRef}>
      <button className="bact-btn" title="React" onClick={(e) => { e.stopPropagation(); onReact(); }}>
        <Smile size={14} />
      </button>
      <button className="bact-btn" title="Reply" onClick={() => onReply()}>
        <CornerDownLeft size={14} />
      </button>
      <button className={`bact-btn${menuOpen ? " bact-active" : ""}`} title="More" onClick={(e) => { e.stopPropagation(); onMoreToggle(); }}>
        ···
      </button>

      {menuOpen && (
        <div className={`bubble-menu ${isOwn ? "menu-left" : "menu-right"}`}>
          <button onClick={onCopy}>
            <Copy size={13} /> Copy
          </button>
          <button onClick={onForward}>
            <Forward size={13} /> Forward
          </button>
          <button onClick={onPin}>
            <Pin size={13} /> {isPinned ? "Unpin" : "Pin"}
          </button>
          {onUnsend && (
            <button className="danger-item" onClick={onUnsend}>
              <Trash2 size={13} /> Unsend
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Forward modal ─────────────────────────────────────────────────────────────

function ForwardModal({ message, currentConvId, onClose, onForwarded }) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [forwarding, setForwarding]       = useState(null);
  const [query, setQuery]                 = useState("");

  useEffect(() => {
    api.get("/chat/conversations/")
      .then(({ data }) => setConversations(Array.isArray(data) ? data : data.results || []))
      .finally(() => setLoading(false));
  }, []);

  const forward = async (convId) => {
    setForwarding(convId);
    try {
      await api.post(`/chat/messages/${message.id}/forward/`, { conversation_id: convId });
      onForwarded();
    } catch {} finally { setForwarding(null); }
  };

  const filtered = conversations.filter((c) => {
    if (c.id === parseInt(currentConvId)) return false;
    const name = c.is_group
      ? c.name
      : c.participants?.map((p) => p.username).join(", ");
    return !query || name?.toLowerCase().includes(query.toLowerCase());
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="forward-modal" onClick={(e) => e.stopPropagation()}>
        <div className="forward-modal-head">
          <strong>Forward Message</strong>
          <button className="icon-button" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="forward-preview">"{truncate(message.display_body || message.body, 70)}"</div>
        <input className="forward-search" placeholder="Search conversations…" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
        {loading ? (
          <p className="muted" style={{ padding: "12px 20px" }}>Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="muted" style={{ padding: "12px 20px" }}>No other conversations.</p>
        ) : (
          <ul className="forward-list">
            {filtered.map((c) => {
              const name = c.is_group ? c.name || "Group"
                : c.participants?.find((p) => p.id !== message.sender?.id)?.username || "Chat";
              return (
                <li key={c.id}>
                  <button onClick={() => forward(c.id)} disabled={!!forwarding}>
                    <span className="forward-avatar">{name[0]?.toUpperCase()}</span>
                    <span className="forward-name">{name}</span>
                    <span className="forward-send-btn">
                      {forwarding === c.id ? "Sending…" : <Send size={13} />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

// ── Utils ──────────────────────────────────────────────────────────────────────

function formatTime(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateLabel(dateStr) {
  const today     = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  if (dateStr === today) return "Today";
  if (dateStr === yesterday) return "Yesterday";
  return dateStr;
}

function truncate(str, n) {
  return str?.length > n ? str.slice(0, n) + "…" : str;
}
