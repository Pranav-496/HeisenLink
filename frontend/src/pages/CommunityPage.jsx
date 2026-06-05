import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { Hash, ArrowLeft, Trash2 } from "lucide-react";

import api from "../api/client.js";
import PostCard from "../components/PostCard.jsx";
import { SkeletonFeed } from "../components/SkeletonPost.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function CommunityPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [next, setNext] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [communityInfo, setCommunityInfo] = useState(null);
  const observer = useRef(null);

  const loadCommunity = useCallback(async () => {
    try {
      const { data } = await api.get(`/communities/${slug}/`);
      setCommunityInfo(data);
    } catch {}
  }, [slug]);

  const load = useCallback(async (url, reset = false) => {
    setLoading(true);
    try {
      const path = url || `/posts/?community=${encodeURIComponent(slug)}`;
      const { data } = await api.get(path);
      const results = data.results || (Array.isArray(data) ? data : []);
      setPosts((current) => (reset ? results : [...current, ...results]));
      setNext(data.next || null);
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, [slug]);

  useEffect(() => {
    setInitialLoad(true);
    setPosts([]);
    setNext(null);
    loadCommunity();
    load(null, true);
  }, [load, loadCommunity]);

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

  const handleDelete = async () => {
    if (window.confirm(`Are you sure you want to delete c/${slug}? This cannot be undone.`)) {
      try {
        await api.delete(`/communities/${slug}/`);
        navigate("/communities");
      } catch (err) {
        alert("Failed to delete community.");
      }
    }
  };

  return (
    <main className="hashtag-page">
      {/* Header */}
      <div className="hashtag-hero">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <Link to="/communities" className="hashtag-back" style={{ marginBottom: 0 }}>
            <ArrowLeft size={18} /> Back to Communities
          </Link>
          {user && communityInfo && user.id === communityInfo.creator && (
            <button onClick={handleDelete} className="icon-button" style={{ color: "#ff4a4a", background: "rgba(255, 74, 74, 0.1)" }}>
              <Trash2 size={18} />
            </button>
          )}
        </div>
        <div className="hashtag-hero-inner">
          <div className="hashtag-icon-lg">
            <Hash size={32} />
          </div>
          <div>
            <h1 className="hashtag-title">{communityInfo?.name || `c/${slug}`}</h1>
            <p className="hashtag-subtitle muted">
              c/{slug} • {communityInfo?.posts_count ?? (posts?.length || 0)} post{(communityInfo?.posts_count ?? (posts?.length || 0)) !== 1 ? "s" : ""}
            </p>
            {communityInfo?.description && (
              <p className="muted" style={{ marginTop: "8px", maxWidth: "600px" }}>{communityInfo.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Feed */}
      <div className="hashtag-feed">
        {initialLoad && <SkeletonFeed count={4} />}

        {!initialLoad && posts.length === 0 && (
          <div className="panel empty-state">
            <Hash size={40} className="empty-icon" />
            <p style={{ fontWeight: 700, fontSize: "18px" }}>No posts in c/{slug} yet</p>
            <p className="muted">Be the first to post here!</p>
          </div>
        )}

        {!initialLoad && posts.map((post, index) => (
          <div
            key={post.id}
            ref={index === posts.length - 1 ? lastRef : null}
            className="post-card-wrapper"
          >
            <PostCard post={post} onChange={updatePost} />
          </div>
        ))}

        {!initialLoad && loading && <SkeletonFeed count={2} />}
      </div>
    </main>
  );
}
