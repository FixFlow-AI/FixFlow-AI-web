const screenPath = "/product-screens/";

const intelligenceShots = [
  {
    src: "fixflow-brief-intelligence-v1.png",
    title: "Brief Intelligence Workspace",
    copy: "A raw client request becomes requirements, risks, milestones, and responsible next actions.",
    alt: "FixFlowAI brief intelligence screen turning a source request into structured project requirements.",
  },
  {
    src: "fixflow-evidence-confidence-v1.png",
    title: "Evidence and Confidence Map",
    copy: "Each confidence statement points to evidence sources, with uncertainty left visible.",
    alt: "FixFlowAI evidence confidence screen linking requirements to repositories, outcomes, artifacts, and references.",
  },
];

const proposalAgreementShots = [
  {
    src: "project-proposal-generator.png",
    title: "Project Proposal Generator",
    copy: "Intake, scope outline, risk analysis, roles, deliverables, and next steps form one proposal flow.",
    alt: "FixFlowAI project proposal generator showing project idea input, AI summary preview, intelligence, scope, and acceptance criteria.",
  },
  {
    src: "fixflow-agreement-composer-v1.png",
    title: "Working Agreement Composer",
    copy: "Scope, assumptions, exclusions, acceptance criteria, and approval checks become reviewable.",
    alt: "FixFlowAI working agreement composer with milestone acceptance criteria and an agreement check inspector.",
  },
];

const deliveryFundsShots = [
  {
    src: "fixflow-delivery-change-control-v1.png",
    title: "Shared Delivery and Change Control",
    copy: "Delivery events, files, decisions, and scoped changes stay attached to the agreement.",
    alt: "FixFlowAI delivery screen showing milestone tasks, delivery trail, and a change request inspector.",
  },
  {
    src: "fixflow-milestone-funds-v1.png",
    title: "Protected Milestone Funds",
    copy: "Payment protection is shown as a state machine connected to acceptance, not a separate invoice.",
    alt: "FixFlowAI funds screen showing milestone funding states and acceptance-linked release conditions.",
  },
];

function ProductFrame({ shot, priority = false }) {
  return (
    <figure className="product-frame">
      <div className="product-frame-media">
        <img
          src={`${screenPath}${shot.src}`}
          alt={shot.alt}
          width="1536"
          height="1024"
          loading={priority ? "eager" : "lazy"}
          decoding="async"
        />
      </div>
      <figcaption>
        <strong>{shot.title}</strong>
        <span>{shot.copy}</span>
      </figcaption>
    </figure>
  );
}

export function ProductOverviewMoment() {
  return (
    <section
      className="product-moment product-moment--overview"
      aria-labelledby="product-overview-title"
    >
      <div className="section-shell product-moment-shell">
        <div className="product-moment-copy">
          <span className="product-moment-label">Product workspace</span>
          <h2 id="product-overview-title">
            The whole project truth stays visible.
          </h2>
          <p>
            The first product signal shows FixFlowAI as a connected operating
            layer, not another profile marketplace. Brief, proof, agreement
            state, protected funds, and the next decision share one workspace.
          </p>
        </div>
        <ProductFrame
          priority
          shot={{
            src: "fixflow-product-overview-v1.png",
            title: "Unified Project Trust Overview",
            copy: "A single screen for project state, agreement readiness, proof, risk, and client review.",
            alt: "FixFlowAI product overview showing a connected project truth workspace for Northstar Billing Migration.",
          }}
        />
      </div>
    </section>
  );
}

export function IntelligenceProductMoments() {
  return (
    <section
      className="product-moment product-moment--band"
      aria-labelledby="intelligence-products-title"
    >
      <div className="section-shell product-moment-shell">
        <div className="product-moment-copy product-moment-copy--wide">
          <span className="product-moment-label">Before matching</span>
          <h2 id="intelligence-products-title">
            Clarity and proof arrive before anyone is shortlisted.
          </h2>
          <p>
            These screens make the invisible work visible: the brief is
            structured, evidence is traced, and the buyer can see exactly where
            confidence is strong or incomplete.
          </p>
        </div>
        <div className="product-grid product-grid--duo">
          {intelligenceShots.map((shot) => (
            <ProductFrame key={shot.src} shot={shot} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function ProposalAgreementMoments() {
  return (
    <section
      className="product-moment"
      aria-labelledby="agreement-products-title"
    >
      <div className="section-shell product-moment-shell">
        <div className="product-moment-copy product-moment-copy--wide">
          <span className="product-moment-label">From idea to agreement</span>
          <h2 id="agreement-products-title">
            The proposal is not a PDF. It is a living agreement path.
          </h2>
          <p>
            FixFlowAI turns early project context into a proposal structure,
            then hardens it into a working agreement with criteria, ownership,
            assumptions, and funding state.
          </p>
        </div>
        <div className="product-grid product-grid--duo product-grid--staggered">
          {proposalAgreementShots.map((shot) => (
            <ProductFrame key={shot.src} shot={shot} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function DeliveryFundsMoments() {
  return (
    <section
      className="product-moment product-moment--band"
      aria-labelledby="delivery-products-title"
    >
      <div className="section-shell product-moment-shell">
        <div className="product-moment-copy product-moment-copy--wide">
          <span className="product-moment-label">During execution</span>
          <h2 id="delivery-products-title">
            Progress, change requests, and funds stay in the same story.
          </h2>
          <p>
            The workroom keeps the agreement alive during delivery. When scope
            changes or acceptance conditions move, the impact is explicit before
            funds or reputation are affected.
          </p>
        </div>
        <div className="product-grid product-grid--duo">
          {deliveryFundsShots.map((shot) => (
            <ProductFrame key={shot.src} shot={shot} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function OutcomeProductMoment() {
  return (
    <section className="product-moment" aria-labelledby="outcome-product-title">
      <div className="section-shell product-moment-shell product-moment-shell--split">
        <div className="product-moment-copy">
          <span className="product-moment-label">After acceptance</span>
          <h2 id="outcome-product-title">
            Reputation becomes a source-backed proof record.
          </h2>
          <p>
            Accepted work closes the loop. The outcome screen shows what was
            accepted, which sources support it, and how that proof can be reused
            without exposing private project details.
          </p>
        </div>
        <ProductFrame
          shot={{
            src: "fixflow-outcome-evidence-v1.png",
            title: "Outcome Evidence and Reputation Trail",
            copy: "A durable trail from captured requirement to accepted outcome and reusable proof.",
            alt: "FixFlowAI outcome evidence screen showing accepted criteria, evidence trail, and reputation reuse controls.",
          }}
        />
      </div>
    </section>
  );
}

export function RoleOnboardingMoment() {
  return (
    <section
      className="product-moment product-moment--pre-cta"
      aria-labelledby="role-product-title"
    >
      <div className="section-shell product-moment-shell product-moment-shell--split">
        <div className="product-moment-copy">
          <span className="product-moment-label">Role-aware onboarding</span>
          <h2 id="role-product-title">
            Setup adapts without splitting into four products.
          </h2>
          <p>
            Clients, freelancers, agencies, and developers enter through the
            same trust system. The onboarding screen shows how role-specific
            evidence becomes future matching context.
          </p>
        </div>
        <ProductFrame
          shot={{
            src: "fixflow-role-onboarding-v1.png",
            title: "Role-Aware Onboarding Workspace",
            copy: "Agency setup connects team proof, proposal roles, delivery ownership, and client confidence.",
            alt: "FixFlowAI role-aware onboarding screen showing agency evidence setup and team assignments.",
          }}
        />
      </div>
    </section>
  );
}
