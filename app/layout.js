export const metadata={title:"PLOWED Access",description:"Claim your whitelist spot"};
export default function RootLayout({children}) {
  return (
    <html lang="en">
      <body style={{fontFamily:"system-ui, Segoe UI, Roboto",background:"#0a0b0a",color:"#e8fbe9"}}>
        <div style={{maxWidth:640,margin:"56px auto",padding:"0 16px"}}>{children}</div>
      </body>
    </html>
  );
}
