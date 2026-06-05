import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import api from "../api/client.js";
import { apiErrorMessage } from "../utils/errors.js";

export default function SettingsPage() {
  const { user, setUser, forgotPassword, resetPassword } = useAuth();
  const [activeTab, setActiveTab] = useState("edit_profile");
  
  // Edit Profile State
  const [editForm, setEditForm] = useState({ username: "", full_name: "", bio: "", custom_status: "" });
  const [saveMsg, setSaveMsg] = useState("");
  const [saveErr, setSaveErr] = useState("");

  // Change Password State
  const [pwForm, setPwForm] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [pwMsg, setPwMsg] = useState("");
  const [pwErr, setPwErr] = useState("");

  // Forgot Password State
  const [forgotMode, setForgotMode] = useState(false);
  const [otpForm, setOtpForm] = useState({ otp: "", new_password: "", confirm_password: "" });
  const [otpMsg, setOtpMsg] = useState("");
  const [otpErr, setOtpErr] = useState("");

  useEffect(() => {
    if (user) {
      setEditForm({
        username: user.username || "",
        full_name: user.profile?.full_name || "",
        bio: user.profile?.bio || "",
        custom_status: user.profile?.custom_status || "",
      });
    }
  }, [user]);

  const saveProfile = async (e) => {
    e.preventDefault();
    setSaveMsg("");
    setSaveErr("");
    try {
      const payload = {
        username: editForm.username,
        profile: {
          full_name: editForm.full_name,
          bio: editForm.bio,
          custom_status: editForm.custom_status,
        },
      };
      const { data } = await api.patch("/me/", payload);
      setUser(data);
      setSaveMsg("Profile updated successfully!");
    } catch (err) {
      setSaveErr(apiErrorMessage(err));
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setPwMsg("");
    setPwErr("");
    if (pwForm.new_password !== pwForm.confirm_password) {
      setPwErr("New passwords do not match.");
      return;
    }
    try {
      await api.put("/auth/password/change/", {
        old_password: pwForm.current_password,
        new_password: pwForm.new_password,
      });
      setPwMsg("Password changed successfully.");
      setPwForm({ current_password: "", new_password: "", confirm_password: "" });
    } catch (err) {
      setPwErr(apiErrorMessage(err));
    }
  };

  const triggerForgotPassword = async () => {
    setPwErr("");
    setOtpMsg("Sending OTP to your email...");
    try {
      await forgotPassword(user.email);
      setForgotMode(true);
      setOtpMsg("An OTP has been sent to your email.");
      setOtpErr("");
    } catch (err) {
      setPwErr(apiErrorMessage(err, "Failed to send OTP."));
      setOtpMsg("");
    }
  };

  const submitResetPassword = async (e) => {
    e.preventDefault();
    setOtpMsg("");
    setOtpErr("");
    if (otpForm.new_password !== otpForm.confirm_password) {
      setOtpErr("New passwords do not match.");
      return;
    }
    try {
      await resetPassword({
        email: user.email,
        otp: otpForm.otp,
        new_password: otpForm.new_password,
      });
      setOtpMsg("Password successfully reset!");
      setForgotMode(false);
      setOtpForm({ otp: "", new_password: "", confirm_password: "" });
    } catch (err) {
      setOtpErr(apiErrorMessage(err));
    }
  };

  const removeAvatar = async () => {
    if (!confirm("Are you sure you want to remove your profile photo?")) return;
    try {
      const { data } = await api.delete("/auth/me/avatar/");
      setUser((u) => ({ ...u, profile: data }));
      setSaveMsg("Profile photo removed!");
      setTimeout(() => setSaveMsg(""), 3000);
    } catch (err) {
      setSaveErr(apiErrorMessage(err, "Failed to remove avatar."));
    }
  };

  const inputStyle = { padding: "14px", borderRadius: "20px", border: "1px solid #363636", background: "#1a1e1f", color: "white", fontSize: "15px", outline: "none", width: "100%", transition: "border 0.2s" };

  return (
    <main className="shell settings-page" style={{ display: "flex", gap: "32px", maxWidth: "900px", margin: "40px auto", padding: "0 24px" }}>
      {/* Sidebar */}
      <aside style={{ flex: "0 0 260px" }}>
        <h2 style={{ marginBottom: "24px", paddingLeft: "16px", fontSize: "24px", fontWeight: "700" }}>Settings</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <button 
            onClick={() => { setActiveTab("edit_profile"); setForgotMode(false); }}
            style={{ textAlign: "left", padding: "14px 20px", background: activeTab === "edit_profile" ? "#262626" : "transparent", border: "none", borderRadius: "9999px", color: activeTab === "edit_profile" ? "white" : "#a0a0a0", cursor: "pointer", fontWeight: activeTab === "edit_profile" ? "600" : "500", transition: "all 0.2s" }}
          >
            Edit Profile
          </button>
          <button 
            onClick={() => setActiveTab("password")}
            style={{ textAlign: "left", padding: "14px 20px", background: activeTab === "password" ? "#262626" : "transparent", border: "none", borderRadius: "9999px", color: activeTab === "password" ? "white" : "#a0a0a0", cursor: "pointer", fontWeight: activeTab === "password" ? "600" : "500", transition: "all 0.2s" }}
          >
            Password and Security
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <section style={{ flex: 1, background: "transparent", padding: "16px 0" }}>
        {activeTab === "edit_profile" && (
          <div style={{ maxWidth: "500px" }}>
            <h2 style={{ marginBottom: "32px", fontSize: "20px", fontWeight: "600" }}>Edit Profile</h2>
            
            {user?.profile?.avatar_url && (
              <div style={{ marginBottom: "24px", padding: "16px", background: "#1a1e1f", borderRadius: "16px", border: "1px solid #363636", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <img src={user.profile.avatar_url} alt="Avatar" style={{ width: "48px", height: "48px", borderRadius: "50%", objectFit: "cover" }} />
                  <div>
                    <p style={{ margin: 0, fontWeight: "600", fontSize: "15px" }}>Profile Photo</p>
                    <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)" }}>Visible to everyone</p>
                  </div>
                </div>
                <button onClick={removeAvatar} type="button" style={{ background: "rgba(255, 74, 74, 0.1)", color: "#ff4a4a", border: "none", padding: "8px 16px", borderRadius: "8px", fontWeight: "600", cursor: "pointer", fontSize: "14px", transition: "background 0.2s" }}>
                  Remove
                </button>
              </div>
            )}

            <form onSubmit={saveProfile} style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "8px", fontWeight: "500" }}>
                Username
                <input type="text" value={editForm.username} onChange={e => setEditForm({ ...editForm, username: e.target.value })} style={inputStyle} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: "8px", fontWeight: "500" }}>
                Full Name
                <input type="text" value={editForm.full_name} onChange={e => setEditForm({ ...editForm, full_name: e.target.value })} style={inputStyle} placeholder="Your display name" />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: "8px", fontWeight: "500" }}>
                Custom Status
                <input type="text" value={editForm.custom_status} onChange={e => setEditForm({ ...editForm, custom_status: e.target.value })} style={inputStyle} placeholder="e.g. 🎵 Listening to music" maxLength={100} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: "8px", fontWeight: "500" }}>
                Bio
                <textarea rows="4" value={editForm.bio} onChange={e => setEditForm({ ...editForm, bio: e.target.value })} style={{...inputStyle, borderRadius: "16px", resize: "none"}} placeholder="Tell us about yourself..." />
              </label>
              
              {saveMsg && <p style={{ color: "#4caf50", background: "rgba(76, 175, 80, 0.1)", padding: "12px", borderRadius: "12px", fontSize: "14px" }}>{saveMsg}</p>}
              {saveErr && <p style={{ color: "#ff4a4a", background: "rgba(255, 74, 74, 0.1)", padding: "12px", borderRadius: "12px", fontSize: "14px" }}>{saveErr}</p>}
              
              <button type="submit" className="follow-btn message" style={{ marginTop: "8px", alignSelf: "flex-end", padding: "12px 24px" }}>Save Profile</button>
            </form>
          </div>
        )}

        {activeTab === "password" && (
          <div style={{ maxWidth: "500px" }}>
            <h2 style={{ marginBottom: "32px", fontSize: "20px", fontWeight: "600" }}>Password and Security</h2>
            
            {!forgotMode ? (
              <form onSubmit={changePassword} style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "8px", fontWeight: "500" }}>
                  Current Password
                  <input type="password" required value={pwForm.current_password} onChange={e => setPwForm({ ...pwForm, current_password: e.target.value })} style={inputStyle} />
                </label>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button type="button" onClick={triggerForgotPassword} style={{ background: "transparent", border: "none", color: "#ff4500", cursor: "pointer", fontSize: "14px", fontWeight: "600", padding: 0 }}>Forgot your password?</button>
                </div>
                <label style={{ display: "flex", flexDirection: "column", gap: "8px", fontWeight: "500" }}>
                  New Password
                  <input type="password" required minLength={8} value={pwForm.new_password} onChange={e => setPwForm({ ...pwForm, new_password: e.target.value })} style={inputStyle} />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "8px", fontWeight: "500" }}>
                  Confirm New Password
                  <input type="password" required minLength={8} value={pwForm.confirm_password} onChange={e => setPwForm({ ...pwForm, confirm_password: e.target.value })} style={inputStyle} />
                </label>
                
                {pwMsg && <p style={{ color: "#4caf50", background: "rgba(76, 175, 80, 0.1)", padding: "12px", borderRadius: "12px", fontSize: "14px" }}>{pwMsg}</p>}
                {otpMsg && <p style={{ color: "#4caf50", background: "rgba(76, 175, 80, 0.1)", padding: "12px", borderRadius: "12px", fontSize: "14px" }}>{otpMsg}</p>}
                {pwErr && <p style={{ color: "#ff4a4a", background: "rgba(255, 74, 74, 0.1)", padding: "12px", borderRadius: "12px", fontSize: "14px" }}>{pwErr}</p>}
                
                <button type="submit" className="follow-btn message" style={{ marginTop: "8px", alignSelf: "flex-end", padding: "12px 24px" }}>Update Password</button>
              </form>
            ) : (
              <form onSubmit={submitResetPassword} style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                <div style={{ padding: "16px", background: "rgba(255, 69, 0, 0.1)", borderRadius: "16px", color: "white", fontSize: "14px", lineHeight: "1.5" }}>
                  We've sent a 6-digit OTP code to your registered email address (<strong>{user?.email}</strong>). Enter it below to reset your password.
                </div>
                
                <label style={{ display: "flex", flexDirection: "column", gap: "8px", fontWeight: "500" }}>
                  OTP Code
                  <input type="text" required value={otpForm.otp} onChange={e => setOtpForm({ ...otpForm, otp: e.target.value })} style={{...inputStyle, letterSpacing: "4px", textAlign: "center", fontSize: "20px"}} placeholder="------" maxLength={6} />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "8px", fontWeight: "500" }}>
                  New Password
                  <input type="password" required minLength={8} value={otpForm.new_password} onChange={e => setOtpForm({ ...otpForm, new_password: e.target.value })} style={inputStyle} />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "8px", fontWeight: "500" }}>
                  Confirm New Password
                  <input type="password" required minLength={8} value={otpForm.confirm_password} onChange={e => setOtpForm({ ...otpForm, confirm_password: e.target.value })} style={inputStyle} />
                </label>
                
                {otpErr && <p style={{ color: "#ff4a4a", background: "rgba(255, 74, 74, 0.1)", padding: "12px", borderRadius: "12px", fontSize: "14px" }}>{otpErr}</p>}
                
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
                  <button type="button" onClick={() => setForgotMode(false)} style={{ background: "transparent", border: "none", color: "#a0a0a0", cursor: "pointer", fontWeight: "600" }}>Cancel</button>
                  <button type="submit" className="follow-btn message" style={{ padding: "12px 24px" }}>Verify & Reset</button>
                </div>
              </form>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
