import { useEffect, useState } from "react";
import api from "../api/client.js";
import { Plus } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import StoryViewer from "./StoryViewer.jsx";

export default function StoryTray() {
  const { user } = useAuth();
  const [groupedStories, setGroupedStories] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Viewer state
  const [viewingIndex, setViewingIndex] = useState(-1);

  const fetchStories = async () => {
    try {
      const { data } = await api.get("/stories/");
      setGroupedStories(data);
    } catch (err) {
      console.error("Failed to fetch stories", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchStories();
    }
  }, [user]);

  if (!user || loading) return null;

  const handleStoryClick = (index) => {
    setViewingIndex(index);
  };

  const handleCloseViewer = () => {
    setViewingIndex(-1);
    // Refresh stories to update viewed status
    fetchStories();
  };

  return (
    <>
      <div className="story-tray" style={{ 
        display: "flex", 
        gap: "16px", 
        overflowX: "auto", 
        padding: "16px 0",
        scrollbarWidth: "none", // Firefox
        msOverflowStyle: "none", // IE
      }}>
        {/* Create Story Button */}
        <div 
          className="story-item create-story" 
          onClick={() => setViewingIndex("create")}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", minWidth: "72px" }}
        >
          <div style={{
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            background: "#262626",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "2px solid #363636",
            position: "relative"
          }}>
            {user.profile?.avatar_url ? (
              <img src={user.profile.avatar_url} alt="You" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover", opacity: 0.7 }} />
            ) : (
              <span style={{ color: "#a0a0a0", fontSize: "24px" }}>{user.username[0].toUpperCase()}</span>
            )}
            <div style={{ position: "absolute", bottom: "-4px", right: "-4px", background: "var(--primary)", borderRadius: "50%", padding: "4px" }}>
              <Plus size={14} color="white" strokeWidth={3} />
            </div>
          </div>
          <span style={{ fontSize: "12px", marginTop: "8px", color: "var(--text-muted)" }}>Add Story</span>
        </div>

        {/* Story Rings */}
        {groupedStories.map((group, index) => {
          // A group is fully viewed if ALL stories inside it are viewed.
          const allViewed = group.stories.every(s => s.is_viewed);
          
          return (
            <div 
              key={group.user.id} 
              className="story-item"
              onClick={() => handleStoryClick(index)}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", minWidth: "72px" }}
            >
              <div style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                padding: "3px",
                background: allViewed ? "#363636" : "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
                <div style={{
                  width: "100%",
                  height: "100%",
                  background: "#1a1e1f", // match dark theme
                  borderRadius: "50%",
                  padding: "2px"
                }}>
                  {group.user.profile?.avatar_url ? (
                    <img src={group.user.profile.avatar_url} alt={group.user.username} style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: "#262626", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
                      {group.user.username[0].toUpperCase()}
                    </div>
                  )}
                </div>
              </div>
              <span style={{ fontSize: "12px", marginTop: "8px", color: "var(--text)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", maxWidth: "70px" }}>
                {group.user.username}
              </span>
            </div>
          );
        })}
      </div>

      {viewingIndex !== -1 && (
        <StoryViewer 
          groupedStories={groupedStories} 
          initialIndex={viewingIndex} 
          onClose={handleCloseViewer}
        />
      )}
    </>
  );
}
