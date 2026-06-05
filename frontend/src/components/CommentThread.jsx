import { Heart, Reply, ThumbsDown } from "lucide-react";
import { useState } from "react";

import api from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import MarkdownRenderer from "./MarkdownRenderer.jsx";

export default function CommentThread({ comments, postId, onAdded, onUpdated }) {
  return (
    <div className="comment-thread">
      {comments.map((comment) => (
        <CommentNode
          key={comment.id}
          comment={comment}
          postId={postId}
          onAdded={onAdded}
          onUpdated={onUpdated}
        />
      ))}
    </div>
  );
}

function CommentNode({ comment, postId, onAdded, onUpdated }) {
  const { user } = useAuth();
  const [replying, setReplying] = useState(false);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const vote = async (value) => {
    if (!user) return;
    const { data } = await api.post(`/comments/${comment.id}/vote/`, { value });
    onUpdated(comment.id, { score: data.score, user_vote: data.user_vote });
  };

  const submitReply = async (event) => {
    event.preventDefault();
    if (!body.trim()) return;
    setSubmitting(true);
    try {
      const { data } = await api.post(`/posts/${postId}/comment/`, { body, parent: comment.id });
      setBody("");
      setReplying(false);
      onAdded(data);
    } finally {
      setSubmitting(false);
    }
  };

  const relativeTime = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div className="comment-node">
      {/* Avatar column */}
      <div className="comment-avatar-col">
        <div className="comment-avatar">
          {comment.author_username?.[0]?.toUpperCase() || "?"}
        </div>
        {/* Thread line */}
        {(comment.replies?.length > 0 || replying) && (
          <div className="comment-thread-line" />
        )}
      </div>

      {/* Content */}
      <div className="comment-body">
        {/* Header */}
        <div className="comment-header">
          <strong className="comment-author">{comment.author_username}</strong>
          <span className="muted comment-time">{relativeTime(comment.created_at)}</span>
        </div>

        {/* Body — markdown */}
        <div className="comment-text">
          <MarkdownRenderer content={comment.body} />
        </div>

        {/* Actions */}
        <div className="comment-actions">
          <button
            className={`post-action-btn comment-action${comment.user_vote === 1 ? " liked" : ""}`}
            onClick={() => vote(comment.user_vote === 1 ? 0 : 1)}
            title="Like"
          >
            <Heart size={13} fill={comment.user_vote === 1 ? "currentColor" : "none"} />
            {comment.score > 0 && (
              <span className={comment.user_vote === 1 ? "" : "muted"}>{comment.score}</span>
            )}
          </button>

          <button
            className={`post-action-btn comment-action${comment.user_vote === -1 ? " disliked" : ""}`}
            onClick={() => vote(comment.user_vote === -1 ? 0 : -1)}
            title="Dislike"
          >
            <ThumbsDown size={13} fill={comment.user_vote === -1 ? "currentColor" : "none"} />
          </button>

          {user && (
            <button
              className="post-action-btn comment-action"
              onClick={() => setReplying((v) => !v)}
            >
              <Reply size={13} />
              <span className="muted">Reply</span>
            </button>
          )}
        </div>

        {/* Reply form */}
        {replying && (
          <form className="reply-form" onSubmit={submitReply}>
            <textarea
              required
              autoFocus
              placeholder={`Reply to @${comment.author_username}…`}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={3}
            />
            <div style={{ display: "flex", gap: "8px" }}>
              <button type="submit" disabled={submitting}>
                {submitting ? "Posting…" : "Reply"}
              </button>
              <button
                type="button"
                onClick={() => { setReplying(false); setBody(""); }}
                style={{ background: "transparent", border: "1px solid var(--line)", borderRadius: "999px", padding: "8px 14px" }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Nested replies */}
        {comment.replies?.length > 0 && (
          <CommentThread
            comments={comment.replies}
            postId={postId}
            onAdded={onAdded}
            onUpdated={onUpdated}
          />
        )}
      </div>
    </div>
  );
}
