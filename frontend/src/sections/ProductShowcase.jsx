export function ProductShowcase() {
  return (
    <section className="product-hero-showcase" aria-label="Product preview">
      <div className="section-shell">
        <p className="product-hero-label">The FixFlowAI workspace</p>
        <div className="product-hero-frame">
          <div className="product-frame-bar" aria-hidden="true">
            <span /><span /><span />
          </div>
          <img
            src="/product-screens/fixflow-product-overview-v1.png"
            alt="FixFlowAI project workspace showing the Northstar Billing Migration dashboard with project truth, agreement state, and delivery timeline"
            loading="eager"
            width="1340"
            height="856"
          />
        </div>
      </div>
    </section>
  );
}
