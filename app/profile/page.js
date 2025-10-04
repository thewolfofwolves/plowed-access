export default function ProfileEntry(){
  const Card = ({children}) => (
    <div style={{
      maxWidth:880, margin:"48px auto", padding:28,
      background:"rgba(6,10,7,0.72)", backdropFilter:"blur(8px)",
      border:"1px solid rgba(255,255,255,0.10)", borderRadius:16
    }}>{children}</div>
  );
  const buttonStyle={padding:"12px 18px",borderRadius:12,border:"1px solid rgba(255,255,255,0.18)",background:"rgba(87,214,127,0.22)",color:"#eaf8eb",textDecoration:"none"};

  return (
    <main>
      <Card>
        <h1 style={{marginTop:0}}>Your profile</h1>
        <p>Sign in with Twitter to view your profile and registered wallet.</p>
        <a href="/api/x/start?mode=view" style={buttonStyle}>Sign in with Twitter</a>
      </Card>
    </main>
  );
}
