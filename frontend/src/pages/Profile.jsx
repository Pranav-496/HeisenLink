import { ArrowRight, Bookmark, Camera, Check, Edit3, Flag, Image as ImageIcon, MessageSquare, Shield, Settings, UserMinus, UserPlus, Users, X, CircleSlash, MoreHorizontal, Menu, Grid, Star } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import api from "../api/client.js";
import PostCard from "../components/PostCard.jsx";
import StoryViewer from "../components/StoryViewer.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { apiErrorMessage } from "../utils/errors.js";

export default function Profile({ mine = false }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [highlights, setHighlights] = useState([]);
  const [viewingHighlights, setViewingHighlights] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ username: "", full_name: "", bio: "" });
  const [usernameStatus, setUsernameStatus] = useState(null); // null | "checking" | "available" | "taken" | "invalid"
  const [saveMsg, setSaveMsg] = useState("");
  const [saveErr, setSaveErr] = useState("");
  const [tab, setTab] = useState("posts"); // posts | followers | following
  const [followersList, setFollowersList] = useState([]);
  const [followingList, setFollowingList] = useState([]);
  const [pwForm, setPwForm] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [pwMsg, setPwMsg] = useState("");
  const [pwErr, setPwErr] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [blockedList, setBlockedList] = useState([]);
  const [statusForm, setStatusForm] = useState({ status: "online", custom_status: "" });
  const [reportModal, setReportModal] = useState(false);
  const [reportForm, setReportForm] = useState({ reason: "spam", description: "" });
  const [menuOpen, setMenuOpen] = useState(false);
  const targetId = mine ? user?.id : id;
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!targetId) return;
    api.get(`/users/${targetId}/`).then(({ data }) => setProfile(data));
    api.get(`/posts/?author=${targetId}`).then(({ data }) => setPosts(data.results || data));
    api.get(`/stories/user/${targetId}/highlights/`).then(({ data }) => setHighlights(data));
  }, [targetId]);

  // Load followers / following / blocked when tab changes
  useEffect(() => {
    if (!profile) return;
    if (tab === "followers") {
      api.get(`/users/${profile.id}/followers/`).then(({ data }) => setFollowersList(data));
    } else if (tab === "following") {
      api.get(`/users/${profile.id}/following/`).then(({ data }) => setFollowingList(data));
    } else if (tab === "blocked" && mine) {
      api.get("/me/blocked/").then(({ data }) => setBlockedList(data.results || data));
    }
  }, [tab, profile, mine]);

  // Username availability check with debounce
  useEffect(() => {
    if (!editing) return;
    const username = editForm.username.trim().toLowerCase();
    if (!username || username === profile?.username) {
      setUsernameStatus(null);
      return;
    }
    if (!/^[a-z0-9]+$/.test(username)) {
      setUsernameStatus("invalid");
      return;
    }
    setUsernameStatus("checking");
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get(`/auth/check-username/?username=${username}`);
        setUsernameStatus(data.available ? "available" : "taken");
      } catch {
        setUsernameStatus(null);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [editForm.username, editing]);

  const follow = async () => {
    const { data } = await api.post(`/users/${profile.id}/follow/`);
    setProfile((p) => ({
      ...p,
      is_following: data.following,
      followers_count: data.following ? p.followers_count + 1 : p.followers_count - 1,
    }));
  };

  const messageUser = async () => {
    if (!profile || !user) return;
    try {
      const { data } = await api.post("/chat/conversations/", {
        is_group: false,
        participant_ids: [profile.id],
      });
      navigate(`/messages/${data.id}`);
    } catch (err) {
      console.error("Failed to start conversation", err);
    }
  };

  const startEditing = () => {
    setEditing(true);
    setEditForm({
      username: profile.username,
      full_name: profile.profile?.full_name || "",
      bio: profile.profile?.bio || "",
    });
    setSaveMsg("");
    setSaveErr("");
  };

  const cancelEditing = () => {
    setEditing(false);
    setUsernameStatus(null);
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    setSaveMsg("");
    setSaveErr("");
    if (usernameStatus === "taken" || usernameStatus === "invalid") return;
    try {
      const { data } = await api.patch("/me/", {
        username: editForm.username.trim().toLowerCase(),
        profile: { full_name: editForm.full_name, bio: editForm.bio },
      });
      // Handle status if changed
      await api.patch("/me/status/", statusForm);
      const fullData = { ...data, profile: { ...data.profile, ...statusForm } };
      
      setProfile(fullData);
      setUser(fullData);
      setEditing(false);
      setSaveMsg("Profile updated!");
      setTimeout(() => setSaveMsg(""), 3000);
    } catch (err) {
      setSaveErr(apiErrorMessage(err, "Failed to save profile."));
    }
  };

  const uploadAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("avatar", file);
    try {
      const { data } = await api.patch("/auth/me/avatar/", formData);
      setProfile((p) => ({ ...p, profile: data }));
      setUser((u) => ({ ...u, profile: data }));
    } catch (err) {
      console.error("Avatar upload failed", err);
    }
  };

  const toggleBlock = async () => {
    try {
      const { data } = await api.post(`/users/${profile.id}/block/`);
      setProfile((p) => ({ ...p, is_blocked: data.blocked, is_following: false }));
    } catch (err) {
      console.error("Block failed", err);
    }
  };

  const submitReport = async (e) => {
    e.preventDefault();
    try {
      await api.post("/report/", {
        target_type: "user",
        target_id: profile.id,
        reason: reportForm.reason,
        description: reportForm.description,
      });
      setReportModal(false);
      setSaveMsg("User reported.");
      setTimeout(() => setSaveMsg(""), 3000);
    } catch (err) {
      console.error("Report failed", err);
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setPwMsg("");
    setPwErr("");
    try {
      const { data } = await api.post("/auth/me/password/", pwForm);
      setPwMsg(data.detail || "Password changed!");
      setPwForm({ current_password: "", new_password: "", confirm_password: "" });
      setTimeout(() => setPwMsg(""), 3000);
    } catch (err) {
      setPwErr(apiErrorMessage(err, "Failed to change password."));
    }
  };

  if (!profile)
    return (
      <main className="shell">
        <div className="panel">Loading...</div>
      </main>
    );

  const displayName = profile.profile?.full_name || profile.username;
  const isOnline = profile.profile?.is_online;
  const statusColor = isOnline ? "var(--success)" : "var(--text-muted)";

  return (
    <main className="shell profile-page">
      <div className="profile-container">
        {/* ── Profile Header ── */}
        <section className="profile-header">

          <div className="profile-header-main" style={{ justifyContent: "center", maxWidth: "800px", margin: "0 auto", gap: "40px" }}>
            <div className="profile-avatar-large-wrapper">
              <div className="profile-avatar-large">
                {profile.profile?.avatar_url ? (
                  <img src={profile.profile.avatar_url} alt={profile.username} />
                ) : (
                  <span>{profile.username[0].toUpperCase()}</span>
                )}
              </div>
              {mine && (
                <label className="avatar-upload-btn" style={{ position: "absolute", bottom: "0", right: "0", cursor: "pointer", background: "var(--accent)", color: "white", padding: "8px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 5px rgba(0,0,0,0.5)" }}>
                  <input type="file" accept="image/*" hidden onChange={uploadAvatar} />
                  <Camera size={16} />
                </label>
              )}
              <div className="online-indicator-large" style={{ backgroundColor: statusColor }} title={profile.profile?.status || "offline"} />
            </div>

            <div className="profile-info" style={{ flex: "0 1 auto", minWidth: "300px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap", marginBottom: "16px" }}>
                <h1 className="profile-display-name" style={{ margin: 0 }}>
                  {profile.username}
                </h1>
                
                <div className="profile-actions" style={{ display: "flex", alignItems: "center", gap: "8px", position: "static" }}>
                  {mine ? (
                    <>
                      <button className="follow-btn message" onClick={() => navigate("/settings")}>
                        Edit Profile
                      </button>
                      <div style={{ position: "relative" }} ref={menuRef}>
                        <button className="follow-btn message" style={{ padding: "8px", display: "flex" }} onClick={() => setMenuOpen(!menuOpen)}>
                          <Menu size={16} />
                        </button>
                        {menuOpen && (
                          <div className="post-menu-dropdown premium-dropdown" style={{ top: "100%", right: 0, width: "220px", zIndex: 10 }}>
                            <button onClick={() => { navigate("/settings"); setMenuOpen(false); }}>
                              <Settings size={16} /> Settings
                            </button>
                            <button onClick={() => { navigate("/bookmarks"); setMenuOpen(false); }}>
                              <Bookmark size={16} /> Saved
                            </button>
                            <button onClick={() => { setTab("blocked"); setMenuOpen(false); }}>
                              <Shield size={16} /> Blocked
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  ) : user && user.id !== profile.id ? (
                    <>
                      {profile.is_blocked ? (
                        <button className="danger-btn" onClick={toggleBlock}>
                          <Shield size={16} /> Unblock
                        </button>
                      ) : (
                        <>
                          <button className={`follow-btn ${profile.is_following ? "following" : ""}`} onClick={follow}>
                            {profile.is_following ? "Unfollow" : "Follow"}
                          </button>
                          <button className="follow-btn message" onClick={messageUser}>
                            Message
                          </button>
                          <div style={{ position: "relative" }} ref={menuRef}>
                            <button className="follow-btn message" style={{ padding: "8px", display: "flex" }} onClick={() => setMenuOpen(!menuOpen)}>
                              <MoreHorizontal size={16} />
                            </button>
                            {menuOpen && (
                              <div className="post-menu-dropdown premium-dropdown" style={{ top: "100%", right: 0, width: "180px", zIndex: 10 }}>
                                <button className="danger-item" onClick={() => { toggleBlock(); setMenuOpen(false); }}>
                                  <CircleSlash size={16} /> Block
                                </button>
                                <button className="danger-item" onClick={() => { setReportModal(true); setMenuOpen(false); }}>
                                  <Flag size={16} /> Report
                                </button>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </>
                  ) : null}
                </div>
              </div>
              
              <div className="profile-stats" style={{ justifyContent: "flex-start", gap: "24px", marginBottom: "16px" }}>
                <span><strong>{posts.length}</strong> posts</span>
                <span onClick={() => setTab("followers")} style={{ cursor: "pointer", transition: "opacity 0.2s" }} onMouseEnter={e => e.currentTarget.style.opacity = 0.7} onMouseLeave={e => e.currentTarget.style.opacity = 1}><strong>{profile.followers_count}</strong> followers</span>
                <span onClick={() => setTab("following")} style={{ cursor: "pointer", transition: "opacity 0.2s" }} onMouseEnter={e => e.currentTarget.style.opacity = 0.7} onMouseLeave={e => e.currentTarget.style.opacity = 1}><strong>{profile.following_count}</strong> following</span>
              </div>
              
              <p className="profile-display-name" style={{ fontSize: "16px", marginBottom: "4px" }}>
                {profile.profile?.full_name}
                {profile.profile?.custom_status && (
                  <span className="profile-custom-status"> 💬 {profile.profile.custom_status}</span>
                )}
              </p>
              <p className="profile-bio" style={{ margin: 0 }}>{profile.profile?.bio || "No bio yet."}</p>
              
              {/* ── Highlights ── */}
              {highlights.length > 0 && (
                <div className="profile-highlights" style={{ marginTop: "24px", display: "flex", gap: "16px", overflowX: "auto", scrollbarWidth: "none" }}>
                  <div 
                    onClick={() => setViewingHighlights(true)}
                    style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", cursor: "pointer" }}
                  >
                    <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "#1a1e1f", border: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", padding: "4px" }}>
                      <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: "#333", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Star size={20} color="#ffd700" />
                      </div>
                    </div>
                    <span style={{ fontSize: "12px", fontWeight: "500", color: "white" }}>Highlights</span>
                  </div>
                </div>
              )}

            </div>
          </div>
        </section>

        {saveMsg && <p className="success profile-toast">{saveMsg}</p>}



        {/* ── Report Modal ── */}
        {reportModal && (
          <div className="modal-overlay" onClick={() => setReportModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <h2>Report User</h2>
                <button className="icon-button" onClick={() => setReportModal(false)}><X size={20} /></button>
              </div>
              <form onSubmit={submitReport} className="report-form">
                <label>
                  Reason
                  <select value={reportForm.reason} onChange={e => setReportForm({ ...reportForm, reason: e.target.value })}>
                    <option value="spam">Spam or Bot</option>
                    <option value="harassment">Harassment or Bullying</option>
                    <option value="hate_speech">Hate Speech</option>
                    <option value="nsfw">Inappropriate Content</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label>
                  Additional Details
                  <textarea rows={3} value={reportForm.description} onChange={e => setReportForm({ ...reportForm, description: e.target.value })} placeholder="Provide more context..." />
                </label>
                <button type="submit" className="danger-btn w-full">Submit Report</button>
              </form>
            </div>
          </div>
        )}

        {viewingHighlights && (
          <StoryViewer 
            groupedStories={highlights} 
            initialIndex={0} 
            onClose={() => {
              setViewingHighlights(false);
              // Refresh highlights on close to reflect any deletes or updates
              if (targetId) {
                api.get(`/stories/user/${targetId}/highlights/`).then(({ data }) => setHighlights(data));
              }
            }} 
          />
        )}

        {/* ── Tabs ── */}
        <div className="profile-tabs" style={{ justifyContent: "center", borderTop: "1px solid var(--line)", marginTop: "24px" }}>
          <button className={tab === "posts" ? "active" : ""} onClick={() => setTab("posts")} style={{ padding: "16px", display: "flex", alignItems: "center", gap: "8px", background: "transparent", borderTop: tab === "posts" ? "1px solid white" : "1px solid transparent", borderRadius: 0, marginTop: "-1px", color: tab === "posts" ? "white" : "var(--text-muted)", cursor: "pointer", border: "none", borderTop: tab === "posts" ? "1px solid white" : "1px solid transparent", fontWeight: tab === "posts" ? "600" : "400" }}>
            <Grid size={16} /> POSTS
          </button>
          <button className={tab === "followers" ? "active" : ""} onClick={() => setTab("followers")} style={{ padding: "16px", display: "flex", alignItems: "center", gap: "8px", background: "transparent", borderTop: tab === "followers" ? "1px solid white" : "1px solid transparent", borderRadius: 0, marginTop: "-1px", color: tab === "followers" ? "white" : "var(--text-muted)", cursor: "pointer", border: "none", borderTop: tab === "followers" ? "1px solid white" : "1px solid transparent", fontWeight: tab === "followers" ? "600" : "400" }}>
            <Users size={16} /> FOLLOWERS
          </button>
          <button className={tab === "following" ? "active" : ""} onClick={() => setTab("following")} style={{ padding: "16px", display: "flex", alignItems: "center", gap: "8px", background: "transparent", borderTop: tab === "following" ? "1px solid white" : "1px solid transparent", borderRadius: 0, marginTop: "-1px", color: tab === "following" ? "white" : "var(--text-muted)", cursor: "pointer", border: "none", borderTop: tab === "following" ? "1px solid white" : "1px solid transparent", fontWeight: tab === "following" ? "600" : "400" }}>
            <UserPlus size={16} /> FOLLOWING
          </button>
        </div>

        {/* ── Tab Content ── */}
        {tab === "posts" && (
          <section className="profile-posts">
            {posts.length === 0 ? (
              <div className="panel empty-state">No posts yet.</div>
            ) : (
              posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onChange={(updated) =>
                    setPosts((items) => items.map((item) => (item.id === updated.id ? updated : item)))
                  }
                />
              ))
            )}
          </section>
        )}

        {tab === "followers" && (
          <section className="user-list">
            {followersList.length === 0 ? (
              <div className="panel empty-state">No followers yet.</div>
            ) : (
              followersList.map((u) => (
                <Link key={u.id} to={u.id === user?.id ? "/me" : `/users/${u.id}`} className="user-list-item">
                  <div className="user-list-avatar">
                    {u.avatar_url ? <img src={u.avatar_url} alt={u.username} /> : u.username[0].toUpperCase()}
                  </div>
                  <div className="user-list-info">
                    <strong>{u.full_name || u.username}</strong>
                    <span className="muted">@{u.username}</span>
                  </div>
                </Link>
              ))
            )}
          </section>
        )}

        {tab === "following" && (
          <section className="user-list">
            {followingList.length === 0 ? (
              <div className="panel empty-state">Not following anyone yet.</div>
            ) : (
              followingList.map((u) => (
                <Link key={u.id} to={u.id === user?.id ? "/me" : `/users/${u.id}`} className="user-list-item">
                  <div className="user-list-avatar">
                    {u.avatar_url ? <img src={u.avatar_url} alt={u.username} /> : u.username[0].toUpperCase()}
                  </div>
                  <div className="user-list-info">
                    <strong>{u.full_name || u.username}</strong>
                    <span className="muted">@{u.username}</span>
                  </div>
                </Link>
              ))
            )}
          </section>
        )}

        {tab === "blocked" && mine && (
          <section className="user-list">
            {blockedList.length === 0 ? (
              <div className="panel empty-state">No blocked users.</div>
            ) : (
              blockedList.map((b) => (
                <div key={b.id} className="user-list-item">
                  <div className="user-list-avatar">
                    {b.blocked_user.avatar_url ? <img src={b.blocked_user.avatar_url} alt={b.blocked_user.username} /> : b.blocked_user.username[0].toUpperCase()}
                  </div>
                  <div className="user-list-info">
                    <strong>{b.blocked_user.full_name || b.blocked_user.username}</strong>
                    <span className="muted">@{b.blocked_user.username}</span>
                  </div>
                  <button className="danger-btn" onClick={async () => {
                    await api.post(`/users/${b.blocked_user.id}/block/`);
                    setBlockedList(l => l.filter(x => x.id !== b.id));
                  }}>Unblock</button>
                </div>
              ))
            )}
          </section>
        )}
      </div>
    </main>
  );
}
