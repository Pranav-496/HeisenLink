import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, Clock, Flame, Hash, TrendingUp } from "lucide-react";

import api from "../api/client.js";
import PostCard from "../components/PostCard.jsx";
import { SkeletonFeed } from "../components/SkeletonPost.jsx";

const WINDOWS = [
  { key: "day",   label: "Today",     icon: <Clock size={14} /> },
  { key: "week",  label: "This Week", icon: <TrendingUp size={14} /> },
  { key: "month", label: "This Month",icon: <Calendar size={14} /> },
];

export default function ExplorePage() {
  const [posts, setPosts]         = useState([]);
  const [next, setNext]           = useState(null);
  const [loading, setLoading]     = useState(false);
  const [initialLoad, setInit]    = useState(true);
  const [window, setWindow]       = useState("week");
  const [trending, setTrending]   = useState([]);
  const observer = useRef(null);

  // Fetch trending hashtags once
  useEffect(() => {
    api.get("/hashtags/trending/")
      .then(({ data }) => setTrending(data))
      .catch(() => {});
  }, []);

  const load = useCallback(async (url, reset = false) => {
    setLoading(true);
    try {
      const path = url || `/feed/trending/?window=${window}`;
      const { data } = await api.get(path);
      setPosts((p) => (reset ? data.results : [...p, ...data.results]));
      setNext(data.next);
    } finally {
      setLoading(false);
      setInit(false);
    }
  }, [window]);

  useEffect(() => {
    setInit(true);
    setPosts([]);
    setNext(null);
    load(null, true);
  }, [load]);

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

  const deletePost = (postId) =>
    setPosts((items) => items.filter((p) => p.id !== postId));

  return (
    <main className="explore-page-v2">

      {/* ── Hero ─────────────────────────────────── */}
      <div className="explore-hero-v2">
        <div className="explore-hero-left">
          <div className="explore-flame-wrap">
            <Flame size={28} />
          </div>
          <div>
            <h1 className="explore-title-v2">Explore</h1>
            <p className="muted explore-sub-v2">What's trending on HeisenLink</p>
          </div>
        </div>
        <div className="explore-windows-v2">
          {WINDOWS.map(({ key, label, icon }) => (
            <button
              key={key}
              className={`explore-win-btn${window === key ? " active" : ""}`}
              onClick={() => setWindow(key)}
            >
              {icon} {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Trending Tags Strip ──────────────────── */}
      {trending.length > 0 && (
        <div className="explore-tags-strip">
          <span className="explore-tags-label">
            <TrendingUp size={13} /> Trending
          </span>
          <div className="explore-tags-scroll">
            {trending.map((tag, i) => (
              <Link key={tag.id} to={`/hashtag/${tag.name}`} className="explore-tag-pill">
                <span className="explore-tag-rank">#{i + 1}</span>
                #{tag.name}
                <span className="explore-tag-cnt">{tag.post_count}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Feed ─────────────────────────────────── */}
      <div className="explore-feed-v2">
        {initialLoad && <SkeletonFeed count={5} />}

        {!initialLoad && posts.length === 0 && (
          <div className="panel empty-state">
            <Flame size={40} className="empty-icon" />
            <p style={{ fontWeight: 700, fontSize: "18px" }}>Nothing trending yet</p>
            <p className="muted">Try a wider time window or check back soon.</p>
          </div>
        )}

        {!initialLoad && posts.map((post, index) => (
          <div
            key={post.id}
            ref={index === posts.length - 1 ? lastRef : null}
            className="post-card-wrapper"
          >
            <PostCard post={post} onChange={updatePost} onDeleted={deletePost} />
          </div>
        ))}

        {!initialLoad && loading && <SkeletonFeed count={2} />}
      </div>
    </main>
  );
}
