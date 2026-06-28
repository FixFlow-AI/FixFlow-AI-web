import { motion, useReducedMotion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import { proofBadges, proofStats } from "../data/landing";

export function SocialProof() {
  const reducedMotion = useReducedMotion();

  return (
    <section className="proof-band" aria-labelledby="proof-band-title">
      <div className="section-shell">
        <p className="proof-band-kicker">
          <ShieldCheck aria-hidden="true" size={15} />
          Trusted by design, not by reputation badges
        </p>
        <h2 id="proof-band-title" className="proof-band-title">
          Every project runs on the same guarantees.
        </h2>

        <dl className="proof-stats">
          {proofStats.map((stat, idx) => (
            <motion.div
              key={stat.label}
              className="proof-stat"
              initial={{ opacity: 0, y: reducedMotion ? 0 : 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{
                duration: reducedMotion ? 0 : 0.4,
                delay: reducedMotion ? 0 : idx * 0.08,
              }}
            >
              <dt className="proof-stat-value">{stat.value}</dt>
              <dd className="proof-stat-body">
                <strong>{stat.label}</strong>
                <span>{stat.detail}</span>
              </dd>
            </motion.div>
          ))}
        </dl>

        <ul className="proof-badges" aria-label="Platform capabilities">
          {proofBadges.map((badge) => (
            <li key={badge}>{badge}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
