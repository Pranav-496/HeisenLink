/**
 * SkeletonPost — animated shimmer placeholder that matches the PostCard shape.
 * Used in Home, SearchPage, and any paginated feed while data is loading.
 */
export default function SkeletonPost() {
  return (
    <article className="skeleton-post" aria-hidden="true">
      {/* Author meta row */}
      <div className="sk-row" style={{ gap: "10px", alignItems: "center", marginBottom: "12px" }}>
        <div className="sk-block sk-avatar-sm" />
        <div className="sk-block sk-text" style={{ width: "120px", height: "13px" }} />
        <div className="sk-block sk-text" style={{ width: "60px", height: "13px", marginLeft: "auto" }} />
      </div>

      {/* Title */}
      <div className="sk-block sk-text" style={{ width: "80%", height: "22px", marginBottom: "8px" }} />
      <div className="sk-block sk-text" style={{ width: "55%", height: "22px", marginBottom: "14px" }} />

      {/* Body lines */}
      <div className="sk-block sk-text" style={{ width: "100%", height: "14px", marginBottom: "6px" }} />
      <div className="sk-block sk-text" style={{ width: "95%", height: "14px", marginBottom: "6px" }} />
      <div className="sk-block sk-text" style={{ width: "70%", height: "14px", marginBottom: "16px" }} />

      {/* Action bar */}
      <div className="sk-row" style={{ gap: "16px" }}>
        <div className="sk-block sk-text" style={{ width: "52px", height: "28px", borderRadius: "999px" }} />
        <div className="sk-block sk-text" style={{ width: "40px", height: "28px", borderRadius: "999px" }} />
        <div className="sk-block sk-text" style={{ width: "72px", height: "28px", borderRadius: "999px" }} />
        <div className="sk-block sk-text" style={{ width: "60px", height: "28px", borderRadius: "999px" }} />
      </div>
    </article>
  );
}

/**
 * SkeletonFeed — renders `count` SkeletonPost placeholders.
 */
export function SkeletonFeed({ count = 4 }) {
  return (
    <div className="skeleton-feed">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonPost key={i} />
      ))}
    </div>
  );
}
