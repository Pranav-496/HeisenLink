import { useState, useEffect, useRef } from "react";
import { X, Send, Camera, Image as ImageIcon, Trash2, Star, AtSign, Palette, Video as VideoIcon } from "lucide-react";
import api from "../api/client.js";
import { apiErrorMessage } from "../utils/errors.js";
import { useAuth } from "../context/AuthContext.jsx";

const STORY_DURATION = 15000;
const PRESET_BACKGROUNDS = [
  "#1a1e1f",
  "linear-gradient(45deg, #ff9a9e 0%, #fecfef 99%, #fecfef 100%)",
  "linear-gradient(120deg, #a1c4fd 0%, #c2e9fb 100%)",
  "linear-gradient(to right, #4facfe 0%, #00f2fe 100%)",
  "linear-gradient(to top, #cfd9df 0%, #e2ebf0 100%)",
  "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
  "linear-gradient(to right, #fa709a 0%, #fee140 100%)"
];

export default function StoryViewer({ groupedStories, initialIndex, onClose }) {
  const { user } = useAuth();
  const [isCreating, setIsCreating] = useState(initialIndex === "create");
  const [groupIndex, setGroupIndex] = useState(isCreating ? 0 : initialIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const progressTimer = useRef(null);
  const videoRef = useRef(null);

  // Creation State
  const [text, setText] = useState("");
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [isVideo, setIsVideo] = useState(false);
  const [bgColor, setBgColor] = useState(PRESET_BACKGROUNDS[0]);
  
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Advanced Creation UI States
  const [showPalette, setShowPalette] = useState(false);
  
  // Mentions
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionResults, setMentionResults] = useState([]);
  const [selectedMentions, setSelectedMentions] = useState([]);
  
  // Camera
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isCameraStarting, setIsCameraStarting] = useState(false);
  const [stream, setStream] = useState(null);
  const cameraVideoRef = useRef(null);
  
  // Video Recording
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  const currentGroup = !isCreating ? groupedStories[groupIndex] : null;
  const currentStory = currentGroup ? currentGroup.stories[storyIndex] : null;

  const markViewed = async (storyId) => {
    try {
      await api.post(`/stories/${storyId}/view/`);
    } catch (e) {}
  };

  const advance = () => {
    if (isCreating) return;
    if (!currentGroup) return;

    if (storyIndex < currentGroup.stories.length - 1) {
      setStoryIndex(s => s + 1);
      setProgress(0);
    } else if (groupIndex < groupedStories.length - 1) {
      setGroupIndex(g => g + 1);
      setStoryIndex(0);
      setProgress(0);
    } else {
      onClose();
    }
  };

  const goBack = () => {
    if (isCreating) return;
    if (storyIndex > 0) {
      setStoryIndex(s => s - 1);
      setProgress(0);
    } else if (groupIndex > 0) {
      setGroupIndex(g => g - 1);
      setStoryIndex(groupedStories[groupIndex - 1].stories.length - 1);
      setProgress(0);
    }
  };

  useEffect(() => {
    if (isCreating || !currentStory) return;

    if (!currentStory.is_viewed) {
      markViewed(currentStory.id);
      currentStory.is_viewed = true;
    }

    const isCurrentVideo = currentStory.media && currentStory.media.match(/\.(mp4|webm|ogg)$/i);

    if (!isPaused && !isCurrentVideo) {
      progressTimer.current = setInterval(() => {
        setProgress(p => {
          if (p >= 100) { advance(); return 0; }
          return p + (100 / (STORY_DURATION / 50));
        });
      }, 50);
    } else if (isCurrentVideo && !isPaused && videoRef.current) {
      videoRef.current.play().catch(e => console.log("Autoplay prevented:", e));
    } else if (isCurrentVideo && isPaused && videoRef.current) {
      videoRef.current.pause();
    }

    return () => clearInterval(progressTimer.current);
  }, [groupIndex, storyIndex, isPaused, isCreating]);

  // Clean up camera stream on close
  useEffect(() => {
    return () => stopCamera();
  }, []);

  const handleVideoTimeUpdate = () => {
    if (!videoRef.current || isPaused) return;
    const p = (videoRef.current.currentTime / videoRef.current.duration) * 100;
    setProgress(p);
  };

  const handleCreate = async () => {
    setUploading(true);
    const formData = new FormData();
    formData.append("text", text);
    formData.append("bg_color", bgColor);
    if (mediaFile) {
      formData.append("media", mediaFile);
    }
    selectedMentions.forEach(m => formData.append("mentions", m.username));

    try {
      await api.post("/stories/create/", formData);
      onClose();
    } catch (e) {
      alert(apiErrorMessage(e));
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this story?")) return;
    try {
      await api.delete(`/stories/${currentStory.id}/`);
      onClose();
    } catch (e) {
      alert(apiErrorMessage(e));
    }
  };

  const toggleHighlight = async () => {
    try {
      const { data } = await api.post(`/stories/${currentStory.id}/highlight/`);
      currentStory.is_highlight = data.is_highlight;
      setProgress(p => p + 0.001); 
    } catch (e) {
      alert(apiErrorMessage(e));
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setMediaFile(file);
      setMediaPreview(URL.createObjectURL(file));
      setIsVideo(file.type.startsWith('video/'));
      stopCamera();
    }
  };

  const startCamera = async () => {
    setIsCameraStarting(true);
    setMediaPreview(null);
    setMediaFile(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: true });
      setStream(s);
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = s;
        cameraVideoRef.current.onloadedmetadata = () => {
          setIsCameraActive(true);
          setIsCameraStarting(false);
        };
      } else {
        setIsCameraActive(true);
        setIsCameraStarting(false);
      }
    } catch (err) {
      alert("Unable to access camera: " + err.message);
      setIsCameraActive(false);
      setIsCameraStarting(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCameraActive(false);
  };

  const handleCaptureStart = () => {
    if (!stream) return;
    recordedChunksRef.current = [];
    try {
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = () => {
        if (recordedChunksRef.current.length > 0) {
          const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
          const file = new File([blob], "capture.webm", { type: "video/webm" });
          setMediaFile(file);
          setMediaPreview(URL.createObjectURL(file));
          setIsVideo(true);
          stopCamera();
        } else {
          // It was a short tap, take a photo
          capturePhoto();
        }
      };
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("MediaRecorder error", err);
    }
  };

  const handleCaptureEnd = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    } else {
      capturePhoto(); // Fallback if recorder failed
    }
  };

  const capturePhoto = () => {
    if (!cameraVideoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = cameraVideoRef.current.videoWidth;
    canvas.height = cameraVideoRef.current.videoHeight;
    canvas.getContext("2d").drawImage(cameraVideoRef.current, 0, 0);
    
    canvas.toBlob((blob) => {
      const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
      setMediaFile(file);
      setMediaPreview(URL.createObjectURL(file));
      setIsVideo(false);
      stopCamera();
    }, "image/jpeg", 0.9);
  };

  const searchMentions = async (query) => {
    setMentionQuery(query);
    if (!query.trim()) {
      setMentionResults([]);
      return;
    }
    try {
      const { data } = await api.get(`/search/?q=${query}`);
      setMentionResults(data.users || []);
    } catch (e) {
      console.error("Mention search failed", e);
    }
  };

  const toggleMention = (user) => {
    if (selectedMentions.find(m => m.id === user.id)) {
      setSelectedMentions(selectedMentions.filter(m => m.id !== user.id));
    } else {
      setSelectedMentions([...selectedMentions, user]);
    }
    setMentionQuery("");
    setMentionResults([]);
  };

  return (
    <div className="story-modal-overlay" style={{
      position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
      background: "rgba(0,0,0,0.95)", zIndex: 9999, display: "flex", justifyContent: "center", alignItems: "center", backdropFilter: "blur(10px)"
    }}>
      <button onClick={onClose} style={{ position: "absolute", top: "24px", right: "24px", background: "rgba(255,255,255,0.1)", borderRadius: "50%", padding: "12px", border: "none", color: "white", cursor: "pointer", zIndex: 10, transition: "background 0.2s" }}>
        <X size={24} />
      </button>

      {isCreating ? (
        <div style={{ width: "100%", maxWidth: "450px", height: "85vh", background: (mediaPreview || isCameraActive || isCameraStarting) ? "#000" : bgColor, borderRadius: "24px", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden", boxShadow: "0 20px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.1)", transition: "background 0.3s ease" }}>
          
          {isCameraStarting && (
            <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 5 }}>
              <div style={{ width: "40px", height: "40px", border: "4px solid rgba(255,255,255,0.2)", borderTopColor: "white", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
              <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {isCameraActive || isCameraStarting ? (
            <video ref={cameraVideoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", top: 0, left: 0, transform: "scaleX(-1)", opacity: isCameraStarting ? 0 : 1, transition: "opacity 0.3s" }} />
          ) : mediaPreview ? (
            isVideo ? (
              <video src={mediaPreview} autoPlay loop playsInline style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", top: 0, left: 0 }} />
            ) : (
              <img src={mediaPreview} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", top: 0, left: 0 }} />
            )
          ) : (
            <textarea 
              value={text} 
              onChange={e => setText(e.target.value)} 
              placeholder="What's on your mind?" 
              style={{ width: "100%", height: "100%", background: "transparent", border: "none", color: "white", fontSize: "32px", fontWeight: "600", textAlign: "center", padding: "40px", resize: "none", outline: "none", zIndex: 2, fontFamily: "var(--font-ui)" }}
            />
          )}

          {/* Mentions & Palette Popovers */}
          <div style={{ position: "absolute", top: "24px", left: "24px", right: "24px", zIndex: 15, display: "flex", flexDirection: "column", gap: "8px" }}>
            {showMentions && (
              <div style={{ background: "rgba(30,30,30,0.8)", backdropFilter: "blur(12px)", borderRadius: "16px", padding: "12px", border: "1px solid rgba(255,255,255,0.1)" }}>
                <input 
                  autoFocus
                  type="text" 
                  placeholder="Search to mention..." 
                  value={mentionQuery}
                  onChange={e => searchMentions(e.target.value)}
                  style={{ width: "100%", background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "white", padding: "8px 12px", outline: "none", marginBottom: "8px" }}
                />
                {mentionResults.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "150px", overflowY: "auto" }}>
                    {mentionResults.map(u => (
                      <div key={u.id} onClick={() => toggleMention(u)} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px", borderRadius: "8px", cursor: "pointer", background: selectedMentions.find(m => m.id === u.id) ? "rgba(255,255,255,0.2)" : "transparent" }}>
                        {u.profile?.avatar_url ? <img src={u.profile.avatar_url} style={{ width: "24px", height: "24px", borderRadius: "50%" }} /> : <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "#555" }} />}
                        <span style={{ color: "white", fontSize: "14px" }}>@{u.username}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {showPalette && !mediaPreview && !isCameraActive && (
              <div style={{ display: "flex", gap: "8px", background: "rgba(0,0,0,0.5)", padding: "12px", borderRadius: "999px", backdropFilter: "blur(12px)" }}>
                {PRESET_BACKGROUNDS.map((bg, i) => (
                  <button key={i} onClick={() => setBgColor(bg)} style={{ width: "32px", height: "32px", borderRadius: "50%", background: bg, border: bgColor === bg ? "2px solid white" : "2px solid transparent", cursor: "pointer" }} />
                ))}
              </div>
            )}
          </div>

          {/* Display Selected Mentions overlay */}
          <div style={{ position: "absolute", top: "50%", left: "0", width: "100%", display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "8px", padding: "0 16px", zIndex: 10, pointerEvents: "none" }}>
            {selectedMentions.map(m => (
              <span key={m.id} style={{ background: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)", padding: "8px 16px", borderRadius: "999px", color: "white", fontSize: "16px", fontWeight: "600", boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>
                @{m.username}
              </span>
            ))}
          </div>
          
          {/* Bottom Controls */}
          <div style={{ position: "absolute", bottom: "0", left: "0", width: "100%", padding: "24px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", zIndex: 15, background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)" }}>
            
            <input type="file" accept="image/*,video/*" ref={fileInputRef} onChange={handleFileChange} style={{ display: "none" }} />
            
            {isCameraActive || isCameraStarting ? (
              <div style={{ width: "100%", display: "flex", justifyContent: "center", opacity: isCameraStarting ? 0.5 : 1, pointerEvents: isCameraStarting ? "none" : "auto", transition: "opacity 0.3s" }}>
                <button 
                  onMouseDown={handleCaptureStart} 
                  onMouseUp={handleCaptureEnd}
                  onTouchStart={handleCaptureStart}
                  onTouchEnd={handleCaptureEnd}
                  style={{ width: "72px", height: "72px", borderRadius: "50%", background: "transparent", border: isRecording ? "4px solid #ff4a4a" : "4px solid white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}
                >
                  <div style={{ width: isRecording ? "40px" : "56px", height: isRecording ? "40px" : "56px", borderRadius: isRecording ? "8px" : "50%", background: isRecording ? "#ff4a4a" : "white", transition: "all 0.2s" }} />
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ display: "flex", gap: "12px" }}>
                    <button onClick={() => fileInputRef.current.click()} style={{ width: "48px", height: "48px", borderRadius: "50%", background: "rgba(255,255,255,0.15)", border: "none", color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }} title="Upload Media">
                      <ImageIcon size={20} />
                    </button>
                    <button onClick={startCamera} style={{ width: "48px", height: "48px", borderRadius: "50%", background: "rgba(255,255,255,0.15)", border: "none", color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }} title="Open Camera">
                      <Camera size={20} />
                    </button>
                  </div>
                  <div style={{ display: "flex", gap: "12px" }}>
                    <button onClick={() => { setShowMentions(!showMentions); setShowPalette(false); }} style={{ width: "48px", height: "48px", borderRadius: "50%", background: showMentions ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.15)", border: "none", color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }} title="Mention Someone">
                      <AtSign size={20} />
                    </button>
                    {!mediaPreview && (
                      <button onClick={() => { setShowPalette(!showPalette); setShowMentions(false); }} style={{ width: "48px", height: "48px", borderRadius: "50%", background: showPalette ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.15)", border: "none", color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }} title="Change Background">
                        <Palette size={20} />
                      </button>
                    )}
                  </div>
                </div>

                <button onClick={handleCreate} disabled={uploading || (!text && !mediaFile)} style={{ background: "white", color: "black", border: "none", borderRadius: "9999px", padding: "14px 28px", fontSize: "16px", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px", cursor: (uploading || (!text && !mediaFile)) ? "not-allowed" : "pointer", opacity: (uploading || (!text && !mediaFile)) ? 0.5 : 1 }}>
                  {uploading ? "Posting..." : "Share"} <Send size={18} />
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div 
          style={{ width: "100%", maxWidth: "450px", height: "85vh", background: currentStory?.bg_color || "#000", borderRadius: "24px", position: "relative", overflow: "hidden", boxShadow: "0 20px 40px rgba(0,0,0,0.5)" }}
          onMouseDown={() => setIsPaused(true)}
          onMouseUp={() => setIsPaused(false)}
          onTouchStart={() => setIsPaused(true)}
          onTouchEnd={() => setIsPaused(false)}
        >
          {/* Progress Bars */}
          <div style={{ position: "absolute", top: "12px", left: "12px", right: "12px", display: "flex", gap: "6px", zIndex: 15 }}>
            {currentGroup.stories.map((s, i) => (
              <div key={s.id} style={{ flex: 1, height: "4px", background: "rgba(255,255,255,0.3)", borderRadius: "2px", overflow: "hidden", backdropFilter: "blur(4px)" }}>
                <div style={{ 
                  height: "100%", 
                  background: "white", 
                  width: i < storyIndex ? "100%" : i === storyIndex ? `${progress}%` : "0%",
                  transition: "width 50ms linear"
                }} />
              </div>
            ))}
          </div>

          {/* User Info Header */}
          <div style={{ position: "absolute", top: "24px", left: "16px", right: "16px", display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 15 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              {currentGroup.user.profile?.avatar_url ? (
                <img src={currentGroup.user.profile.avatar_url} alt="avatar" style={{ width: "36px", height: "36px", borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(255,255,255,0.2)" }} />
              ) : (
                <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#363636", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", border: "2px solid rgba(255,255,255,0.2)" }}>
                  {currentGroup.user.username[0].toUpperCase()}
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ color: "white", fontWeight: "700", fontSize: "15px", textShadow: "0 2px 4px rgba(0,0,0,0.8)" }}>{currentGroup.user.username}</span>
                <span style={{ color: "rgba(255,255,255,0.8)", fontSize: "12px", textShadow: "0 2px 4px rgba(0,0,0,0.8)" }}>
                  {new Date(currentStory.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </span>
              </div>
            </div>
            
            {/* Story Owner Controls */}
            {currentGroup.user.id === user?.id && (
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={(e) => { e.stopPropagation(); toggleHighlight(); }} style={{ background: "rgba(0,0,0,0.4)", border: "none", borderRadius: "50%", padding: "8px", color: currentStory.is_highlight ? "#ffd700" : "white", cursor: "pointer", backdropFilter: "blur(4px)" }} title="Add to Highlights">
                  <Star size={18} fill={currentStory.is_highlight ? "#ffd700" : "none"} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(); }} style={{ background: "rgba(0,0,0,0.4)", border: "none", borderRadius: "50%", padding: "8px", color: "#ff4a4a", cursor: "pointer", backdropFilter: "blur(4px)" }} title="Delete Story">
                  <Trash2 size={18} />
                </button>
              </div>
            )}
          </div>

          {/* Story Content */}
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
            {currentStory?.media ? (
              currentStory.media.match(/\.(mp4|webm|ogg)$/i) ? (
                <video 
                  ref={videoRef}
                  src={currentStory.media} 
                  playsInline 
                  muted={false}
                  onTimeUpdate={handleVideoTimeUpdate}
                  onEnded={() => advance()}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }} 
                />
              ) : (
                <img src={currentStory.media} alt="story" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              )
            ) : null}
            
            {currentStory?.text && (
              <div style={{ position: "absolute", zIndex: 10, padding: "32px", width: "100%" }}>
                <h2 style={{ color: "white", textAlign: "center", fontWeight: "700", fontSize: "32px", textShadow: "0 4px 12px rgba(0,0,0,0.6)", lineHeight: "1.3" }}>
                  {currentStory.text}
                </h2>
              </div>
            )}

            {/* Mentions Display */}
            {currentStory?.mentions?.length > 0 && (
              <div style={{ position: "absolute", bottom: "32px", left: "0", width: "100%", display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "8px", padding: "0 16px", zIndex: 10 }}>
                {currentStory.mentions.map(m => (
                  <span key={m.id} style={{ background: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)", padding: "6px 12px", borderRadius: "999px", color: "white", fontSize: "14px", fontWeight: "600", boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>
                    @{m.username}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Navigation Click Areas */}
          <div onClick={goBack} style={{ position: "absolute", top: "100px", left: 0, width: "30%", height: "calc(100% - 100px)", zIndex: 20, cursor: "w-resize" }} />
          <div onClick={advance} style={{ position: "absolute", top: "100px", right: 0, width: "70%", height: "calc(100% - 100px)", zIndex: 20, cursor: "e-resize" }} />
        </div>
      )}
    </div>
  );
}
