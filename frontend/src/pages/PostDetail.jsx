import { Send } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import api from "../api/client.js";
import CommentThread from "../components/CommentThread.jsx";
import MarkdownRenderer from "../components/MarkdownRenderer.jsx";
import { SkeletonFeed } from "../components/SkeletonPost.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function PostDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [post, setPost] = useState(null);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/posts/${id}/`);
      setPost(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const submit = async (event) => {
    event.preventDefault();
    if (!body.trim()) return;
    setSubmitting(true);
    try {
      const { data } = await api.post(`/posts/${id}/comment/`, { body });
      setPost((current) => ({
        ...current,
        comments: [...current.comments, data],
        comment_count: current.comment_count + 1,
      }));
      setBody("");
    } finally {
      setSubmitting(false);
    }
  };

  const addNested = () => load();

  const updateComment = (commentId, changes) => {
    const walk = (comments) =>
      comments.map((comment) => {
        if (comment.id === commentId) return { ...comment, ...changes };
        return { ...comment, replies: walk(comment.replies || []) };
      });
    setPost((current) => ({ ...current, comments: walk(current.comments) }));
  };

  if (loading) {
    return (
      <main className="shell narrow">
        <SkeletonFeed count={1} />
        <div className="comments-panel" style={{ marginTop: "12px" }}>
          <SkeletonFeed count={3} />
        </div>
      </main>
    );
  }

  if (!post) {
    return (
      <main className="shell narrow">
        <div className="panel empty-state">Post not found.</div>
      </main>
    );
  }

  return (
    <main className="shell narrow post-detail-page">
      {/* Full post */}
      <article className="post-detail-card">
        {/* Meta */}
        <div className="post-meta">
          <Link to={`/users/${post.author}`} className="post-avatar-link">
            <span className="post-avatar">{post.author_username?.[0]?.toUpperCase() || "?"}</span>
          </Link>
          <div className="post-meta-text">
            <Link to={`/users/${post.author}`} className="post-author-name">
              {post.author_username}
            </Link>
            {post.community_slug && (
              <span className="post-community-badge">c/{post.community_slug}</span>
            )}
            <span className="muted post-time">
              {new Date(post.created_at).toLocaleDateString([], {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
        </div>

        {/* Title */}
        <h1 className="post-detail-title">{post.title}</h1>

        {/* Full markdown body */}
        <div className="post-detail-body">
          <MarkdownRenderer content={post.body} />
        </div>

        {/* Image */}
        {post.image_url && (
          <img className="post-image post-detail-image" src={post.image_url} alt="" />
        )}

        {/* Vote / action bar */}
        <div className="post-detail-actions">
          <button
            className={`post-action-btn${post.user_vote === 1 ? " liked" : ""}`}
            onClick={async () => {
              if (!user) return;
              const { data } = await api.post(`/posts/${post.id}/vote/`, {
                value: post.user_vote === 1 ? 0 : 1,
              });
              setPost((p) => ({ ...p, score: data.score, user_vote: data.user_vote }));
            }}
          >
            ❤ {post.score > 0 ? post.score : "Like"}
          </button>
          <span className="muted" style={{ fontSize: "14px" }}>
            {post.comment_count || 0} comments
          </span>
        </div>
      </article>

      {/* Comments section */}
      <section className="comments-panel">
        <h2 className="comments-heading">
          Comments <span className="muted">({post.comment_count || 0})</span>
        </h2>

        {user ? (
          <form className="reply-form top-reply" onSubmit={submit}>
            <textarea
              required
              placeholder="Share your thoughts…"
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
            <button type="submit" disabled={submitting}>
              <Send size={16} /> {submitting ? "Posting…" : "Comment"}
            </button>
          </form>
        ) : (
          <p className="panel" style={{ marginBottom: "12px" }}>
            <Link to="/auth">Login</Link> to comment.
          </p>
        )}

        <CommentThread
          comments={post.comments || []}
          postId={post.id}
          onAdded={addNested}
          onUpdated={updateComment}
        />
      </section>
    </main>
  );
}
