import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Users, Plus, Hash } from "lucide-react";

import api from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { apiErrorMessage } from "../utils/errors.js";

export default function CommunitiesPage() {
  const { user } = useAuth();
  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({ name: "", description: "" });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    api.get("/communities/")
      .then(({ data }) => setCommunities(data.results || data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError("");
    try {
      const { data } = await api.post("/communities/", form);
      setCommunities((prev) => [data, ...prev]);
      setShowModal(false);
      setForm({ name: "", description: "" });
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to create community."));
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="explore-page-v2">
      <div className="explore-hero-v2" style={{ marginBottom: "24px" }}>
        <div className="explore-hero-left">
          <div className="explore-flame-wrap" style={{ background: "rgba(17, 91, 202, 0.1)", color: "#7b91ff" }}>
            <Users size={28} />
          </div>
          <div>
            <h1 className="explore-title-v2">Communities</h1>
            <p className="muted explore-sub-v2">Discover spaces for your interests</p>
          </div>
        </div>
        {user && (
          <button 
            className="follow-btn message" 
            style={{ display: "flex", alignItems: "center", gap: "8px", background: "var(--accent)", color: "white", border: "none" }}
            onClick={() => setShowModal(true)}
          >
            <Plus size={16} /> Create Community
          </button>
        )}
      </div>

      {showModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#111516", borderRadius: "16px", padding: "24px", width: "100%", maxWidth: "400px", border: "1px solid #363636" }}>
            <h2 style={{ margin: "0 0 24px 0", fontSize: "20px", fontWeight: "600" }}>Create Community</h2>
            <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "8px", fontWeight: "500" }}>
                Name
                <input required type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={{ padding: "12px", borderRadius: "12px", border: "1px solid #363636", background: "#1a1e1f", color: "white", outline: "none" }} placeholder="e.g. ScienceFiction" maxLength={80} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: "8px", fontWeight: "500" }}>
                Description
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={{ padding: "12px", borderRadius: "12px", border: "1px solid #363636", background: "#1a1e1f", color: "white", outline: "none", resize: "vertical", minHeight: "80px" }} placeholder="What is this community about?" />
              </label>
              {error && <p style={{ color: "#ff4a4a", margin: 0, fontSize: "14px" }}>{error}</p>}
              <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: "12px", borderRadius: "12px", background: "transparent", color: "white", border: "1px solid #363636", cursor: "pointer" }}>Cancel</button>
                <button type="submit" disabled={creating} style={{ flex: 1, padding: "12px", borderRadius: "12px", background: "var(--accent)", color: "white", border: "none", cursor: "pointer", fontWeight: "600" }}>{creating ? "Creating..." : "Create"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="panel" style={{ textAlign: "center", padding: "40px 0" }}>Loading communities...</div>
      ) : communities.length === 0 ? (
        <div className="panel" style={{ textAlign: "center", padding: "40px 0" }}>
          <p className="muted">No communities found.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
          {communities.map((community) => (
            <Link key={community.id} to={`/c/${community.slug}`} className="panel" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "12px", transition: "transform 0.2s", cursor: "pointer", textDecoration: "none", color: "inherit" }} onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"} onMouseLeave={e => e.currentTarget.style.transform = "none"}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "#262626", display: "flex", alignItems: "center", justifyContent: "center", color: "#a0a0a0" }}>
                  <Hash size={24} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "white" }}>{community.name}</h3>
                  <span className="muted" style={{ fontSize: "13px" }}>c/{community.slug}</span>
                </div>
              </div>
              {community.description && <p style={{ margin: 0, fontSize: "14px", color: "var(--text-muted)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{community.description}</p>}
              <div style={{ marginTop: "auto", paddingTop: "12px", display: "flex", alignItems: "center", gap: "16px", fontSize: "13px", color: "var(--text-muted)" }}>
                <span>{community.posts_count || 0} posts</span>
                <span>Created by @{community.creator_username}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
