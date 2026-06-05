import { Search, User, FileText } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import api from "../api/client.js";
import PostCard from "../components/PostCard.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const q = searchParams.get("q") || "";
  const [results, setResults] = useState({ users: [], posts: [] });
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("all");

  useEffect(() => {
    if (!q || q.length < 2) {
      setResults({ users: [], posts: [] });
      return;
    }
    setLoading(true);
    api
      .get(`/search/?q=${encodeURIComponent(q)}`)
      .then(({ data }) => setResults(data))
      .catch(() => setResults({ users: [], posts: [] }))
      .finally(() => setLoading(false));
  }, [q]);

  const updatePost = (updated) =>
    setResults((r) => ({
      ...r,
      posts: r.posts.map((p) => (p.id === updated.id ? updated : p)),
    }));

  const showUsers = tab === "all" || tab === "people";
  const showPosts = tab === "all" || tab === "posts";
  const empty = results.users.length === 0 && results.posts.length === 0;

  return (
    <main className="shell">
      <div className="search-page">
        {/* Hero search bar */}
        <div className="search-hero">
          <div className="search-hero-bar">
            <Search size={20} className="search-hero-icon" />
            <input
              autoFocus
              defaultValue={q}
              placeholder="Search users, posts, topics..."
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const val = e.target.value.trim();
                  if (val) navigate(`/search?q=${encodeURIComponent(val)}`);
                }
              }}
            />
          </div>
        </div>

        {q && (
          <>
            {/* Tab bar */}
            <div className="search-tabs">
              {[
                { key: "all", label: "All" },
                { key: "people", label: `People (${results.users.length})` },
                { key: "posts", label: `Posts (${results.posts.length})` },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  className={tab === key ? "active" : ""}
                  onClick={() => setTab(key)}
                >
                  {label}
                </button>
              ))}
            </div>

            {loading && <div className="panel">Searching...</div>}

            {!loading && empty && (
              <div className="panel empty-state">
                <Search size={36} className="empty-icon" />
                <p>No results for <strong>"{q}"</strong></p>
                <p className="muted">Try different keywords or check the spelling.</p>
              </div>
            )}

            {/* People */}
            {showUsers && results.users.length > 0 && (
              <section className="search-section">
                <h2 className="search-section-title"><User size={16} /> People</h2>
                <div className="user-list">
                  {results.users.map((u) => (
                    <Link
                      key={u.id}
                      to={u.id === user?.id ? "/me" : `/users/${u.id}`}
                      className="user-list-item"
                    >
                      <div className="user-list-avatar">{u.username[0].toUpperCase()}</div>
                      <div className="user-list-info">
                        <strong>{u.full_name || u.username}</strong>
                        <span className="muted">@{u.username}</span>
                      </div>
                      {u.is_following && (
                        <span className="user-following-badge">Following</span>
                      )}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Posts */}
            {showPosts && results.posts.length > 0 && (
              <section className="search-section">
                <h2 className="search-section-title"><FileText size={16} /> Posts</h2>
                <div className="feed">
                  {results.posts.map((post) => (
                    <PostCard key={post.id} post={post} onChange={updatePost} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {!q && (
          <div className="panel empty-state">
            <Search size={40} className="empty-icon" />
            <p>Search HeisenLink</p>
            <p className="muted">Find people, posts, and topics.</p>
          </div>
        )}
      </div>
    </main>
  );
}
