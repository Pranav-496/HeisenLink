import { Navigate, Route, Routes } from "react-router-dom";

import Navbar from "./components/Navbar.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import BookmarksPage from "./pages/BookmarksPage.jsx";
import ChatPage from "./pages/ChatPage.jsx";
import CommunitiesPage from "./pages/CommunitiesPage.jsx";
import ExplorePage from "./pages/ExplorePage.jsx";
import ForgotPasswordPage from "./pages/ForgotPasswordPage.jsx";
import HashtagPage from "./pages/HashtagPage.jsx";
import Home from "./pages/Home.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import PostDetail from "./pages/PostDetail.jsx";
import Profile from "./pages/Profile.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import ResetPasswordPage from "./pages/ResetPasswordPage.jsx";
import SearchPage from "./pages/SearchPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import VerifyEmailPage from "./pages/VerifyEmailPage.jsx";

function RequireAuth({ children }) {
  const { user, booting } = useAuth();
  if (booting) return <main className="shell"><div className="panel">Loading…</div></main>;
  return user ? children : <Navigate to="/auth" replace />;
}

export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        {/* Public */}
        <Route path="/" element={<Home />} />
        <Route path="/auth" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/posts/:id" element={<PostDetail />} />
        <Route path="/users/:id" element={<Profile />} />
        <Route path="/search" element={<SearchPage />} />

        {/* Discovery */}
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/communities" element={<CommunitiesPage />} />
        <Route path="/hashtag/:tag" element={<HashtagPage />} />

        {/* Auth-required */}
        <Route path="/bookmarks" element={<RequireAuth><BookmarksPage /></RequireAuth>} />
        <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
        <Route path="/messages" element={<RequireAuth><ChatPage /></RequireAuth>} />
        <Route path="/messages/:id" element={<RequireAuth><ChatPage /></RequireAuth>} />
        <Route path="/me" element={<RequireAuth><Profile mine /></RequireAuth>} />
      </Routes>
    </>
  );
}
