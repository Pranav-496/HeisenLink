import { Eye, ImagePlus, Send, PenLine } from "lucide-react";
import { useEffect, useState } from "react";

import api from "../api/client.js";
import MarkdownRenderer from "./MarkdownRenderer.jsx";

export default function CreatePost({ onCreated }) {
  const [communities, setCommunities] = useState([]);
  const [form, setForm] = useState({ title: "", body: "", community: "" });
  const [image, setImage] = useState(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("write"); // "write" | "preview"

  useEffect(() => {
    api.get("/communities/").then(({ data }) => setCommunities(data.results || data));
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = new FormData();
      payload.append("title", form.title);
      payload.append("body", form.body);
      if (form.community) payload.append("community", form.community);
      if (image) payload.append("image", image);
      const { data } = await api.post("/posts/", payload);
      setForm({ title: "", body: "", community: "" });
      setImage(null);
      setTab("write");
      onCreated(data);
    } finally {
      setSaving(false);
    }
  };

  const charCount = form.body.length;

  return (
    <form className="create-post" onSubmit={submit}>
      {/* Title input */}
      <input
        required
        maxLength={220}
        placeholder="Post title…"
        value={form.title}
        onChange={(event) => setForm({ ...form, title: event.target.value })}
        className="create-post-title-input"
      />

      {/* Write / Preview toggle */}
      <div className="create-post-tabs">
        <button
          type="button"
          className={`cp-tab${tab === "write" ? " active" : ""}`}
          onClick={() => setTab("write")}
        >
          <PenLine size={14} /> Write
        </button>
        <button
          type="button"
          className={`cp-tab${tab === "preview" ? " active" : ""}`}
          onClick={() => setTab("preview")}
          disabled={!form.body}
        >
          <Eye size={14} /> Preview
        </button>
        <span className="cp-char-count muted">{charCount > 0 ? `${charCount} chars` : ""}</span>
      </div>

      {/* Editor or preview pane */}
      {tab === "write" ? (
        <textarea
          required
          placeholder="What are you thinking through? Markdown supported — **bold**, `code`, > quote…"
          value={form.body}
          onChange={(event) => setForm({ ...form, body: event.target.value })}
          className="create-post-textarea"
        />
      ) : (
        <div className="create-post-preview">
          <MarkdownRenderer content={form.body} />
        </div>
      )}

      {/* Bottom row */}
      <div className="form-row create-post-footer">
        <select
          value={form.community}
          onChange={(event) => setForm({ ...form, community: event.target.value })}
          className="cp-community-select"
        >
          <option value="">No community</option>
          {communities.map((community) => (
            <option key={community.id} value={community.id}>
              c/{community.slug}
            </option>
          ))}
        </select>

        <label className="file-control">
          <ImagePlus size={15} />
          <span>{image ? image.name : "Image"}</span>
          <input
            type="file"
            accept="image/*"
            onChange={(event) => setImage(event.target.files[0])}
          />
        </label>

        {image && (
          <button
            type="button"
            onClick={() => setImage(null)}
            style={{ background: "transparent", color: "var(--muted)", fontSize: "12px" }}
          >
            ✕ Remove
          </button>
        )}

        <button disabled={saving} type="submit" style={{ marginLeft: "auto" }}>
          <Send size={15} /> {saving ? "Posting…" : "Post"}
        </button>
      </div>
    </form>
  );
}
