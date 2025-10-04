export const metadata = {
  title: "PLOWED • Early Access",
  description: "Register your wallet for Early Access",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, Segoe UI, Roboto",
          color: "#e8fbe9",
          minHeight: "100vh",
          // make body transparent so the background layer is visible
          background: "transparent",
        }}
      >
        {/* Background image */}
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            inset: 0,
            backgroundImage: "url(/bg.jpg)",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundAttachment: "fixed",
            zIndex: 0, // sit below content but above the body background
          }}
        />
        {/* Dark vignette overlay for readability */}
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            inset: 0,
            background:
              "radial-gradient(120% 70% at 50% 20%, rgba(0,0,0,0.25), rgba(0,0,0,0.7))",
            zIndex: 1,
          }}
        />

        {/* Content wrapper above background + overlay */}
        <div
          style={{
            position: "relative",
            zIndex: 2,
            maxWidth: 720,
            margin: "64px auto",
            padding: "0 16px",
          }}
        >
          {children}
        </div>
      </body>
    </html>
  );
}
