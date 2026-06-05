import { useCallback, useEffect, useRef, useState } from "react";

import api from "../api/client.js";
import CreatePost from "../components/CreatePost.jsx";
import PostCard from "../components/PostCard.jsx";
import { SkeletonFeed } from "../components/SkeletonPost.jsx";
import StoryTray from "../components/StoryTray.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function Home() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [scope, setScope] = useState("global");
  const [sort, setSort] = useState("new");
  const [next, setNext] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const observer = useRef(null);

  const load = useCallback(
    async (url, reset = false) => {
      setLoading(true);
      try {
        const path = url || `/feed/?scope=${scope}&sort=${sort}`;
        const { data } = await api.get(path);
        setPosts((current) => (reset ? data.results : [...current, ...data.results]));
        setNext(data.next);
      } finally {
        setLoading(false);
        setInitialLoad(false);
      }
    },
    [scope, sort]
  );

  useEffect(() => {
    setInitialLoad(true);
    load(null, true);
  }, [load]);

  const lastPostRef = useCallback(
    (node) => {
      if (loading) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && next) load(next);
      });
      if (node) observer.current.observe(node);
    },
    [loading, next, load]
  );

  const updatePost = (updated) => {
    setPosts((items) => items.map((item) => (item.id === updated.id ? updated : item)));
  };

  const deletePost = (postId) => {
    setPosts((items) => items.filter((item) => item.id !== postId));
  };

  return (
    <main className="home-page">
      <section className="feed-section">
        {/* Stories Tray */}
        <StoryTray />

        {/* Create post box */}
        {user && <CreatePost onCreated={(post) => setPosts((items) => [post, ...items])} />}

        {/* Feed controls */}
        <div className="feed-controls">
          <button className={scope === "global" ? "active" : ""} onClick={() => setScope("global")}>
            🌐 Global
          </button>
          <button disabled={!user} className={scope === "following" ? "active" : ""} onClick={() => setScope("following")}>
            👥 Following
          </button>
          <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
            <button className={sort === "new" ? "active" : ""} onClick={() => setSort("new")}>🕐 New</button>
            <button className={sort === "top" ? "active" : ""} onClick={() => setSort("top")}>🔥 Top</button>
          </div>
        </div>

        {/* Initial skeleton */}
        {initialLoad && <SkeletonFeed count={5} />}

        {/* Posts */}
        {!initialLoad && posts.map((post, index) => (
          <div
            ref={index === posts.length - 1 ? lastPostRef : null}
            key={post.id}
            className="post-card-wrapper"
          >
            <PostCard post={post} onChange={updatePost} onDeleted={deletePost} />
          </div>
        ))}

        {/* Load-more skeleton (infinite scroll) */}
        {!initialLoad && loading && <SkeletonFeed count={2} />}

        {/* Empty state */}
        {!initialLoad && !loading && posts.length === 0 && (
          <div className="panel empty-state">
            <p style={{ fontSize: "40px", margin: "0 0 8px" }}>✨</p>
            <p style={{ fontWeight: 700, fontSize: "18px" }}>No posts yet</p>
            <p className="muted">
              {scope === "following" ? "Follow some people to see their posts here." : "Be the first to post!"}
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
