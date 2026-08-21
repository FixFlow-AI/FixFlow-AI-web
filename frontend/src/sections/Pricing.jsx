import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { RevealText } from "../components/RevealText";
import { pricingTiers } from "../data/landing";

export function Pricing() {
  const [annual, setAnnual] = useState(true);
  const reducedMotion = useReducedMotion();

  return (
    <section className="pricing" id="pricing" aria-labelledby="pricing-title">
      <div className="section-shell">
        <div className="pricing-head">
          <span className="panel-label pricing-kicker">Pricing</span>
          <RevealText as="h2" id="pricing-title" className="section-title pricing-title">
            Start free. Scale only when the work does.
          </RevealText>
          <p className="pricing-sub">
            Transparent plans with protected payments built in. No hidden
            platform fees, no surprise commissions.
          </p>

          <div
            className="billing-toggle"
            role="group"
            aria-label="Billing period"
          >
            <button
              type="button"
              className={!annual ? "is-active" : ""}
              aria-pressed={!annual}
              onClick={() => setAnnual(false)}
            >
              Monthly
            </button>
            <button
              type="button"
              className={annual ? "is-active" : ""}
              aria-pressed={annual}
              onClick={() => setAnnual(true)}
            >
              Annual
              <span className="billing-save">Save 20%</span>
            </button>
          </div>
        </div>

        <div className="pricing-grid">
          {pricingTiers.map((tier, idx) => {
            const price = annual ? tier.annual : tier.monthly;
            return (
              <motion.article
                key={tier.id}
                className={`pricing-card${tier.featured ? " is-featured" : ""}`}
                initial={{ opacity: 0, y: reducedMotion ? 0 : 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{
                  duration: reducedMotion ? 0 : 0.4,
                  delay: reducedMotion ? 0 : idx * 0.08,
                }}
              >
                {tier.featured && (
                  <span className="pricing-badge">Most popular</span>
                )}
                <h3 className="pricing-name">{tier.name}</h3>
                <p className="pricing-tagline">{tier.tagline}</p>

                <div className="pricing-price">
                  <span className="pricing-amount">
                    {price === 0 ? "Free" : `$${price}`}
                  </span>
                  {price !== 0 && (
                    <span className="pricing-period">
                      /mo{annual ? ", billed yearly" : ""}
                    </span>
                  )}
                </div>

                <a
                  className={`button${tier.featured ? "" : " button--quiet"} pricing-cta`}
                  href="#/signup"
                >
                  {tier.cta}
                  <ArrowRight aria-hidden="true" size={17} />
                </a>

                <ul className="pricing-features">
                  {tier.features.map((feature) => (
                    <li key={feature}>
                      <Check aria-hidden="true" size={16} strokeWidth={2.2} />
                      {feature}
                    </li>
                  ))}
                </ul>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
