/**
 * SkeletonProfile — shimmer placeholder for the profile header card.
 */
export default function SkeletonProfile() {
  return (
    <div className="skeleton-profile-head" aria-hidden="true">
      {/* Avatar */}
      <div className="sk-block sk-avatar-lg" />

      {/* Info column */}
      <div className="sk-col" style={{ gap: "10px" }}>
        <div className="sk-block sk-text" style={{ width: "200px", height: "28px" }} />
        <div className="sk-block sk-text" style={{ width: "120px", height: "16px" }} />
        <div className="sk-block sk-text" style={{ width: "280px", height: "14px" }} />
        <div className="sk-block sk-text" style={{ width: "240px", height: "14px" }} />
        {/* Stats */}
        <div className="sk-row" style={{ gap: "12px", marginTop: "4px" }}>
          <div className="sk-block sk-text" style={{ width: "80px", height: "14px" }} />
          <div className="sk-block sk-text" style={{ width: "80px", height: "14px" }} />
          <div className="sk-block sk-text" style={{ width: "80px", height: "14px" }} />
        </div>
      </div>

      {/* Action button placeholder */}
      <div className="sk-block sk-text" style={{ width: "110px", height: "40px", borderRadius: "999px", alignSelf: "start" }} />
    </div>
  );
}
