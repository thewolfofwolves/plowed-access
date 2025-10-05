// app/profile/page.js
export default function ProfilePage() {
  const cardStyle = {
    maxWidth: 760,
    margin: "64px auto",
    padding: "36px 40px",
    background: "rgba(6,10,7,0.75)",
    backdropFilter: "blur(8px)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 18,
    boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
    boxSizing: "border-box",
  };

  const titleStyle = {
    fontSize: 40,
    lineHeight: 1.15,
    margin: "0 0 12px",
  };

  const leadStyle = {
    opacity: 0.9,
    lineHeight: 1.6,
    margin: "0 0 20px",
  };

  const buttonStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "12px 18px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(87,214,127,0.22)",
    color: "#eaf8eb",
    textDecoration: "none",
    marginTop: 12,
  };

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "24px 16px" }}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>Your profile</h1>
        <p style={leadStyle}>
          Sign in with Twitter to view your profile and registered wallet.
        </p>
        <a href="/api/x/start?mode=signin" style={buttonStyle}>
          Sign in with Twitter
        </a>
      </div>
    </main>
  );
}
