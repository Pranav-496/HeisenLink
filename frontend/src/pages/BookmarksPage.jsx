import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bookmark, ArrowLeft, Hash } from "lucide-react";

import api from "../api/client.js";
import PostCard from "../components/PostCard.jsx";
import { SkeletonFeed } from "../components/SkeletonPost.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function BookmarksPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [next, setNext] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const observer = useRef(null);

  const load = useCallback(async (url, reset = false) => {
    setLoading(true);
    try {
      const path = url || "/bookmarks/";
      const { data } = await api.get(path);
      setPosts((current) => (reset ? data.results : [...current, ...data.results]));
      setNext(data.next);
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, []);

  useEffect(() => {
    if (user) load(null, true);
  }, [user, load]);

  const lastRef = useCallback((node) => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && next) load(next);
    });
    if (node) observer.current.observe(node);
  }, [loading, next, load]);

  const updatePost = (updated) =>
    setPosts((items) => items.map((p) => (p.id === updated.id ? updated : p)));

  // When a post is unbookmarked from this page, remove it from the list
  const removeBookmark = (postId) =>
    setPosts((items) => items.filter((p) => p.id !== postId));

  if (!user) {
    return (
      <main className="shell narrow">
        <div className="panel empty-state">
          <Bookmark size={40} className="empty-icon" />
          <p style={{ fontWeight: 700 }}>Log in to see your bookmarks</p>
          <Link to="/auth" className="login-pill" style={{ marginTop: "12px" }}>
            Log In
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="bookmarks-page">
      {/* Header */}
      <div className="bookmarks-hero">
        <Link to="/" className="hashtag-back">
          <ArrowLeft size={18} /> Back
        </Link>
        <div className="bookmarks-hero-inner">
          <div className="bookmarks-icon-lg">
            <Bookmark size={28} />
          </div>
          <div>
            <h1 className="bookmarks-title">Saved Posts</h1>
            <p className="muted" style={{ margin: 0, fontSize: "14px" }}>
              Posts you've bookmarked for later
            </p>
          </div>
        </div>
      </div>

      {/* Feed */}
      <div className="bookmarks-feed">
        {initialLoad && <SkeletonFeed count={3} />}

        {!initialLoad && posts.length === 0 && (
          <div className="panel empty-state">
            <Bookmark size={40} className="empty-icon" />
            <p style={{ fontWeight: 700, fontSize: "18px" }}>No bookmarks yet</p>
            <p className="muted">Tap the bookmark icon on any post to save it here.</p>
          </div>
        )}

        {!initialLoad && posts.map((post, index) => (
          <div
            key={post.id}
            ref={index === posts.length - 1 ? lastRef : null}
            className="post-card-wrapper"
          >
            <PostCard
              post={{ ...post, is_bookmarked: true }}
              onChange={updatePost}
              onUnbookmark={() => removeBookmark(post.id)}
            />
          </div>
        ))}

        {!initialLoad && loading && <SkeletonFeed count={2} />}
      </div>
    </main>
  );
}
