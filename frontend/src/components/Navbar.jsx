import { Bell, Bookmark, Compass, LogOut, MessageSquare, Search, User, X, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";

import api from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import useNotifications from "../hooks/useNotifications.js";

export default function Navbar() {
  const { user, logout } = useAuth();
  const { notifications, unreadCount, markAllRead } = useNotifications(user);
  const navigate = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [searchFocus, setSearchFocus] = useState(false);
  const searchRef = useRef(null);
  const suggestRef = useRef(null);
  const notifRef = useRef(null);

  useEffect(() => {
    document.documentElement.dataset.theme = "dark";
  }, []);

  // Live suggestion fetch with debounce
  useEffect(() => {
    if (query.trim().length < 2) { setSuggestions([]); return; }
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get(`/search/?q=${encodeURIComponent(query.trim())}`);
        setSuggestions([...data.users.slice(0, 4), ...data.posts.slice(0, 3)]);
      } catch {
        setSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (!searchRef.current?.contains(e.target) && !suggestRef.current?.contains(e.target)) {
        setSearchFocus(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const goSearch = (e) => {
    if (e.key === "Enter" && query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      setSearchFocus(false);
      setSuggestions([]);
      setQuery("");
    }
  };

  const clearSearch = () => {
    setQuery("");
    setSuggestions([]);
    searchRef.current?.querySelector("input")?.focus();
  };

  const showDropdown = searchFocus && suggestions.length > 0;

  return (
    <header className="topbar">
      <Link to="/" className="brand">HeisenLink</Link>

      {/* Search pill */}
      <div className="search-pill-wrap" ref={searchRef}>
        <div className={`search-pill ${searchFocus ? "focused" : ""}`}>
          <Search size={17} />
          <input
            placeholder="Search users, posts…"
            aria-label="Search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setSearchFocus(true)}
            onKeyDown={goSearch}
          />
          {query && (
            <button className="search-clear" onClick={clearSearch}><X size={14} /></button>
          )}
        </div>
        {showDropdown && (
          <div className="search-dropdown" ref={suggestRef}>
            {suggestions.map((item) =>
              item.username ? (
                <Link
                  key={`u-${item.id}`}
                  to={item.id === user?.id ? "/me" : `/users/${item.id}`}
                  className="search-suggest-item"
                  onClick={() => { setSearchFocus(false); setQuery(""); }}
                >
                  <span className="suggest-avatar">{item.username[0].toUpperCase()}</span>
                  <span className="suggest-info">
                    <span className="suggest-name">{item.full_name || item.username}</span>
                    <span className="suggest-sub muted">@{item.username}</span>
                  </span>
                  <span className="suggest-type muted">Person</span>
                </Link>
              ) : (
                <Link
                  key={`p-${item.id}`}
                  to={`/posts/${item.id}`}
                  className="search-suggest-item"
                  onClick={() => { setSearchFocus(false); setQuery(""); }}
                >
                  <span className="suggest-post-icon">📝</span>
                  <span className="suggest-info">
                    <span className="suggest-name">{item.title}</span>
                    <span className="suggest-sub muted">by @{item.author?.username}</span>
                  </span>
                  <span className="suggest-type muted">Post</span>
                </Link>
              )
            )}
            <Link
              to={`/search?q=${encodeURIComponent(query)}`}
              className="search-suggest-all"
              onClick={() => { setSearchFocus(false); setQuery(""); }}
            >
              See all results for <strong>"{query}"</strong>
            </Link>
          </div>
        )}
      </div>

      {/* Nav actions */}
      <nav className="nav-actions">
        {/* Explore — always visible */}
        <NavLink
          to="/explore"
          className={({ isActive }) => `icon-button nav-tooltip-wrap${isActive ? " active-nav" : ""}`}
          title="Explore"
        >
          <Compass size={18} />
          <span className="nav-tooltip">Explore</span>
        </NavLink>

        {/* Communities — always visible */}
        <NavLink
          to="/communities"
          className={({ isActive }) => `icon-button nav-tooltip-wrap${isActive ? " active-nav" : ""}`}
          title="Communities"
        >
          <Users size={18} />
          <span className="nav-tooltip">Communities</span>
        </NavLink>

        {user ? (
          <>
            {/* Notifications */}
            <div ref={notifRef} style={{ position: "relative" }}>
              <button
                className="icon-button notification-button nav-tooltip-wrap"
                title="Notifications"
                onClick={() => setNotifOpen((v) => !v)}
              >
                <Bell size={18} />
                {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
                <span className="nav-tooltip">Notifications</span>
              </button>
              {notifOpen && (
                <div className="notification-menu">
                  <div className="menu-head">
                    <strong>Notifications</strong>
                    <button className="mark-read-btn" onClick={markAllRead}>Mark read</button>
                  </div>
                  {notifications.length === 0 ? (
                    <p className="muted" style={{ padding: "8px 4px" }}>No notifications yet.</p>
                  ) : (
                    notifications.slice(0, 8).map((item) => (
                      <div className={`notification${item.is_read ? "" : " unread"}`} key={item.id} onClick={() => {
                        setNotifOpen(false);
                        if (item.target_url) navigate(item.target_url);
                      }}>
                        <div className="notif-avatar">
                          {item.actor_avatar_url ? (
                            <img src={item.actor_avatar_url} alt={item.actor_username} />
                          ) : (
                            item.actor_username[0].toUpperCase()
                          )}
                        </div>
                        <div className="notif-text">
                          <strong>{item.actor_username}</strong> {item.verb}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Bookmarks */}
            <NavLink
              to="/bookmarks"
              className={({ isActive }) => `icon-button nav-tooltip-wrap${isActive ? " active-nav" : ""}`}
              title="Bookmarks"
            >
              <Bookmark size={18} />
              <span className="nav-tooltip">Bookmarks</span>
            </NavLink>

            {/* Messages */}
            <NavLink
              to="/messages"
              className={({ isActive }) => `icon-button nav-tooltip-wrap${isActive ? " active-nav" : ""}`}
              title="Messages"
            >
              <MessageSquare size={18} />
              <span className="nav-tooltip">Messages</span>
            </NavLink>

            {/* Profile */}
            <NavLink
              to="/me"
              className={({ isActive }) => `icon-button nav-tooltip-wrap${isActive ? " active-nav" : ""}`}
              title="My Profile"
            >
              {user.profile?.avatar_url ? (
                <img src={user.profile.avatar_url} alt="Profile" style={{ width: 18, height: 18, borderRadius: "50%", objectFit: "cover" }} />
              ) : (
                <User size={18} />
              )}
              <span className="nav-tooltip">Profile</span>
            </NavLink>

            {/* Logout */}
            <button className="icon-button nav-tooltip-wrap" title="Log out" onClick={logout}>
              <LogOut size={18} />
              <span className="nav-tooltip">Log out</span>
            </button>
          </>
        ) : (
          <NavLink to="/auth" className="login-pill">Log In</NavLink>
        )}
      </nav>
    </header>
  );
}
