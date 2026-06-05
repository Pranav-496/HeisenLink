import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Hash, TrendingUp, ArrowLeft } from "lucide-react";

import api from "../api/client.js";
import PostCard from "../components/PostCard.jsx";
import { SkeletonFeed } from "../components/SkeletonPost.jsx";

export default function HashtagPage() {
  const { tag } = useParams();
  const [posts, setPosts] = useState([]);
  const [next, setNext] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [tagInfo, setTagInfo] = useState(null);
  const observer = useRef(null);

  const load = useCallback(async (url, reset = false) => {
    setLoading(true);
    try {
      const path = url || `/hashtags/${encodeURIComponent(tag)}/posts/`;
      const { data } = await api.get(path);
      setPosts((current) => (reset ? data.results : [...current, ...data.results]));
      setNext(data.next);
      // Grab tag info from first post's hashtag list
      if (reset && data.results.length > 0) {
        setTagInfo({ name: tag, post_count: data.count });
      }
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, [tag]);

  useEffect(() => {
    setInitialLoad(true);
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

  return (
    <main className="hashtag-page">
      {/* Header */}
      <div className="hashtag-hero">
        <Link to="/" className="hashtag-back">
          <ArrowLeft size={18} /> Back
        </Link>
        <div className="hashtag-hero-inner">
          <div className="hashtag-icon-lg">
            <Hash size={32} />
          </div>
          <div>
            <h1 className="hashtag-title">#{tag}</h1>
            {tagInfo && (
              <p className="hashtag-subtitle muted">
                {tagInfo.post_count ?? posts.length} post{(tagInfo.post_count ?? posts.length) !== 1 ? "s" : ""}
              </p>
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
            <p style={{ fontWeight: 700, fontSize: "18px" }}>No posts with #{tag} yet</p>
            <p className="muted">Be the first to use this hashtag!</p>
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
