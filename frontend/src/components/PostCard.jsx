import { Bookmark, Edit2, Heart, MessageCircle, MoreHorizontal, Share2, ThumbsDown, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import api from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import MarkdownRenderer from "./MarkdownRenderer.jsx";

export default function PostCard({ post, onChange, onUnbookmark, onDeleted }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [shareOpen, setShareOpen] = useState(false);
  const [shareQuery, setShareQuery] = useState("");
  const [shareResults, setShareResults] = useState([]);
  const [connectedUsers, setConnectedUsers] = useState([]);
  const [sharing, setSharing] = useState(false);
  const [bookmarked, setBookmarked] = useState(post.is_bookmarked || false);
  const [bookmarking, setBookmarking] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(post.title);
  const [editBody, setEditBody] = useState(post.body);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const shareRef = useRef(null);
  const menuRef = useRef(null);

  const isAuthor = user && user.id === post.author;

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (shareRef.current && !shareRef.current.contains(e.target)) {
        setShareOpen(false);
        setShareQuery("");
        setShareResults([]);
      }
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Vote
  const vote = async (value) => {
    if (!user) return;
    try {
      const { data } = await api.post(`/posts/${post.id}/vote/`, { value });
      onChange({ ...post, score: data.score, user_vote: data.user_vote });
    } catch {}
  };

  // Bookmark
  const toggleBookmark = async () => {
    if (!user || bookmarking) return;
    setBookmarking(true);
    try {
      if (bookmarked) {
        await api.delete(`/posts/${post.id}/bookmark/`);
        setBookmarked(false);
        onUnbookmark?.();
      } else {
        await api.post(`/posts/${post.id}/bookmark/`);
        setBookmarked(true);
      }
    } finally {
      setBookmarking(false);
    }
  };

  // Load connected users (following) when share opens
  const openShare = async () => {
    setShareOpen(true);
    if (connectedUsers.length === 0 && user) {
      try {
        const { data } = await api.get(`/users/${user.id}/following/`);
        const users = (data.results || data).filter((u) => u.id !== user.id);
        setConnectedUsers(users);
      } catch {}
    }
  };

  // Share user search
  const handleShareSearch = async (e) => {
    const q = e.target.value;
    setShareQuery(q);
    if (q.length < 2) { setShareResults([]); return; }
    try {
      const { data } = await api.get(`/search/?q=${encodeURIComponent(q)}`);
      setShareResults((data.users || []).filter((u) => u.id !== user?.id));
    } catch {
      setShareResults([]);
    }
  };

  // Share via DM
  const shareToUser = async (userId) => {
    if (sharing) return;
    setSharing(true);
    try {
      const { data: convData } = await api.post("/chat/conversations/", {
        is_group: false,
        participant_ids: [userId],
      });
      const postUrl = `${window.location.origin}/posts/${post.id}`;
      await api.post(`/chat/conversations/${convData.id}/messages/send/`, {
        body: `Check out this post: ${postUrl}`,
      });
      setShareOpen(false);
      setShareQuery("");
      setShareResults([]);
    } finally {
      setSharing(false);
    }
  };

  // Edit save
  const saveEdit = async () => {
    if (!editTitle.trim() || !editBody.trim()) return;
    setSaving(true);
    try {
      const payload = new FormData();
      payload.append("title", editTitle.trim());
      payload.append("body", editBody.trim());
      const { data } = await api.patch(`/posts/${post.id}/`, payload);
      onChange(data);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  // Delete
  const deletePost = async () => {
    if (!window.confirm("Delete this post? This action cannot be undone.")) return;
    setDeleting(true);
    try {
      await api.delete(`/posts/${post.id}/`);
      onDeleted ? onDeleted(post.id) : navigate("/");
    } finally {
      setDeleting(false);
    }
  };

  const relativeTime = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d`;
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <article className="post-card">
      {/* Author meta */}
      <div className="post-meta" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Link to={`/users/${post.author}`} className="post-avatar-link" style={{ display: "flex" }}>
            <div className="post-author-avatar" style={{ width: "40px", height: "40px", borderRadius: "50%", background: "#262626", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", color: "white", fontWeight: "bold" }}>
              {post.author_avatar_url ? (
                <img src={post.author_avatar_url} alt={post.author_username} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                post.author_username?.[0]?.toUpperCase() || "?"
              )}
            </div>
          </Link>
          <div className="post-meta-text" style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", fontSize: "14px" }}>
            <Link to={`/users/${post.author}`} className="post-author-name" style={{ fontWeight: "600", color: "white", textDecoration: "none" }}>
              {post.author_username}
            </Link>
            {post.community_slug && (
              <span className="post-community-badge" style={{ fontSize: "12px", background: "rgba(255,255,255,0.1)", padding: "2px 6px", borderRadius: "4px" }}>
                c/{post.community_slug}
              </span>
            )}
            <span className="muted post-time" style={{ fontSize: "13px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
              <span>•</span> {relativeTime(post.created_at)}
            </span>
          </div>
        </div>

        {/* Author context menu (3-dot button) */}
        {isAuthor && (
          <div className="post-author-menu" ref={menuRef} style={{ position: "relative" }}>
            <button
              className="icon-button post-menu-trigger"
              onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
              title="Post options"
              style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex", padding: "4px" }}
            >
              <MoreHorizontal size={20} />
            </button>
            {menuOpen && (
              <div className="post-menu-dropdown" style={{ position: "absolute", top: "100%", right: 0, background: "#1a1e1f", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "8px", display: "flex", flexDirection: "column", gap: "4px", minWidth: "150px", zIndex: 10, boxShadow: "0 10px 20px rgba(0,0,0,0.5)" }}>
                <button onClick={() => { setEditing(true); setMenuOpen(false); }} style={{ display: "flex", alignItems: "center", gap: "8px", background: "transparent", border: "none", color: "white", padding: "8px 12px", borderRadius: "6px", cursor: "pointer", textAlign: "left", width: "100%", transition: "background 0.2s" }} onMouseEnter={e => e.target.style.background = "rgba(255,255,255,0.05)"} onMouseLeave={e => e.target.style.background = "transparent"}>
                  <Edit2 size={16} /> Edit post
                </button>
                <button className="danger-item" onClick={deletePost} disabled={deleting} style={{ display: "flex", alignItems: "center", gap: "8px", background: "transparent", border: "none", color: "#ff4a4a", padding: "8px 12px", borderRadius: "6px", cursor: "pointer", textAlign: "left", width: "100%", transition: "background 0.2s" }} onMouseEnter={e => e.target.style.background = "rgba(255,74,74,0.1)"} onMouseLeave={e => e.target.style.background = "transparent"}>
                  <Trash2 size={16} /> {deleting ? "Deleting…" : "Delete post"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit mode */}
      {editing ? (
        <div className="post-edit-form">
          <input
            className="post-edit-title"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder="Post title…"
          />
          <textarea
            className="post-edit-body"
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
            placeholder="Post body…"
            rows={5}
          />
          <div className="post-edit-actions">
            <button onClick={saveEdit} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => { setEditing(false); setEditTitle(post.title); setEditBody(post.body); }}
              style={{ background: "transparent", border: "1px solid var(--line)", borderRadius: "999px", padding: "8px 16px" }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Title */}
          <Link className="post-title" to={`/posts/${post.id}`}>{post.title}</Link>

          {/* Body preview */}
          {post.body && (
            <div className="post-body-preview">
              <MarkdownRenderer content={post.body} preview />
            </div>
          )}

          {/* Hashtag chips */}
          {post.hashtags?.length > 0 && (
            <div className="post-hashtags">
              {post.hashtags.slice(0, 5).map((tag) => (
                <Link key={tag} to={`/hashtag/${tag}`} className="hashtag-chip">#{tag}</Link>
              ))}
            </div>
          )}

          {/* Image */}
          {post.image_url && (
            <Link to={`/posts/${post.id}`}>
              <img className="post-image" src={post.image_url} alt="" loading="lazy" />
            </Link>
          )}
        </>
      )}

      {/* Action bar */}
      {!editing && (
        <div className="post-actions-bar">
          {/* Upvote */}
          <button
            className={`post-action-btn${post.user_vote === 1 ? " liked" : ""}`}
            onClick={() => vote(post.user_vote === 1 ? 0 : 1)}
            title="Like"
          >
            <Heart size={16} fill={post.user_vote === 1 ? "currentColor" : "none"} />
            <span className={post.user_vote === 1 ? "" : "muted"}>
              {post.score > 0 ? post.score : "Like"}
            </span>
          </button>

          {/* Downvote */}
          <button
            className={`post-action-btn${post.user_vote === -1 ? " disliked" : ""}`}
            onClick={() => vote(post.user_vote === -1 ? 0 : -1)}
            title="Dislike"
          >
            <ThumbsDown size={16} fill={post.user_vote === -1 ? "currentColor" : "none"} />
          </button>

          {/* Comments */}
          <Link className="post-action-btn" to={`/posts/${post.id}`}>
            <MessageCircle size={16} />
            <span className="muted">{post.comment_count || 0}</span>
          </Link>

          {/* Share */}
          {user && (
            <div className="share-wrapper" ref={shareRef}>
              <button
                className={`post-action-btn${shareOpen ? " active-btn" : ""}`}
                onClick={(e) => { e.stopPropagation(); shareOpen ? setShareOpen(false) : openShare(); }}
              >
                <Share2 size={16} />
                <span className="muted">Share</span>
              </button>

              {shareOpen && (
                <div className="share-popover">
                  <div className="share-popover-head">
                    <strong>Share via DM</strong>
                    <button className="icon-button" onClick={() => setShareOpen(false)}><X size={15} /></button>
                  </div>
                  <input
                    type="text"
                    className="share-popover-search"
                    placeholder="Search user…"
                    value={shareQuery}
                    onChange={handleShareSearch}
                    autoFocus
                  />
                  {(() => {
                    const displayUsers = shareQuery.length >= 2 ? shareResults : connectedUsers;
                    const emptyMsg = shareQuery.length >= 2 ? "No users found." : "No connections yet.";
                    return displayUsers.length === 0 ? (
                      <p className="muted" style={{ padding: "8px 12px", fontSize: 13 }}>{emptyMsg}</p>
                    ) : (
                      <ul className="share-popover-list">
                        {displayUsers.map((u) => (
                          <li key={u.id}>
                            <button onClick={() => shareToUser(u.id)} disabled={sharing}>
                              <span className="share-user-avatar">{u.avatar_url ? <img src={u.avatar_url} alt={u.username} style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} /> : u.username[0].toUpperCase()}</span>
                              <span className="share-user-name">@{u.username}</span>
                              <span className="share-user-send">{sharing ? "…" : "Send"}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* Bookmark */}
          {user && (
            <button
              className={`post-action-btn${bookmarked ? " bookmarked" : ""}`}
              onClick={toggleBookmark}
              disabled={bookmarking}
              title={bookmarked ? "Remove bookmark" : "Bookmark"}
              style={{ marginLeft: "auto" }}
            >
              <Bookmark size={16} fill={bookmarked ? "currentColor" : "none"} />
            </button>
          )}
        </div>
      )}
    </article>
  );
}
