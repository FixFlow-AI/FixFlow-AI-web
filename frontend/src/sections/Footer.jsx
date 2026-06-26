import { Brand } from "../components/Brand";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer
      className="site-footer"
      style={{
        borderTop: "1px solid var(--line)",
        padding: "32px 0",
      }}
    >
      <div className="section-shell">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          {/* Left: Brand + tagline */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Brand compact />
            <span
              style={{
                fontSize: 13,
                color: "var(--muted)",
                borderLeft: "1px solid var(--line)",
                paddingLeft: 16,
              }}
            >
              The operating layer for trusted work.
            </span>
          </div>

          {/* Center: Nav links */}
          <nav
            style={{
              display: "flex",
              alignItems: "center",
              gap: 24,
              fontSize: 13,
            }}
          >
            <a
              href="#problem"
              style={{ color: "var(--muted)", textDecoration: "none", fontWeight: 500 }}
            >
              Problem
            </a>
            <a
              href="#intelligence"
              style={{ color: "var(--muted)", textDecoration: "none", fontWeight: 500 }}
            >
              Intelligence
            </a>
            <a
              href="#workflow"
              style={{ color: "var(--muted)", textDecoration: "none", fontWeight: 500 }}
            >
              Workflow
            </a>
            <a
              href="#trust"
              style={{ color: "var(--muted)", textDecoration: "none", fontWeight: 500 }}
            >
              Trust
            </a>
          </nav>

          {/* Right: Legal */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              fontSize: 12,
              color: "#94a3b8",
            }}
          >
            <span>© {year} FixFlowAI, Inc.</span>
            <a href="#" style={{ color: "#94a3b8", textDecoration: "none" }}>
              Privacy
            </a>
            <a href="#" style={{ color: "#94a3b8", textDecoration: "none" }}>
              Terms
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
