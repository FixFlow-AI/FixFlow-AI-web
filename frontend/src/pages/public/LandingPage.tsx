import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Shield, 
  ArrowRight, 
  AlertTriangle, 
  Coins, 
  Users, 
  Code,
  FileCheck,
  ChevronRight,
  TrendingUp
} from 'lucide-react';
import Button from '../../components/ui/Button.js';
import Card from '../../components/ui/Card.js';

export const LandingPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleWaitlistSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubmitted(true);
    }
  };

  const painPoints = [
    { title: 'High Service Fees', old: 'Up to 20% platform cuts on hard-earned client contracts', new: 'Dynamic tiered platform fees as low as 2% depending on plan' },
    { title: 'Payment Safety Risk', old: 'Deliver work but face delays or chargebacks from client disputes', new: 'Milestone escrow with cryptography ledger audit trails' },
    { title: 'Opaque Visibility Algorithms', old: 'Profile ranks drop unexpectedly, losing leads to spambots', new: 'Game-proof verifiable reputation Soulbound Token credentials' },
    { title: 'Hiring Delays & Vetting Noise', old: 'Client spends weeks vetting hundreds of copy-paste proposals', new: 'Top 3 pre-vetted matches in under 60 seconds with custom Qs' }
  ];

  return (
    <div className="relative overflow-hidden">
      {/* Background glow effects */}
      <div className="glow-bg top-20 left-10"></div>
      <div className="glow-bg-emerald bottom-40 right-20"></div>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center space-y-8 relative z-10">
        <div className="inline-flex items-center space-x-2 px-3 py-1.5 bg-blue-900/10 border border-blue-900/30 rounded-full text-xs font-semibold text-blue-400 font-outfit tracking-wide">
          <Shield className="w-3.5 h-3.5" />
          <span>Trust-First operations control center</span>
        </div>
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight font-outfit max-w-4xl mx-auto leading-tight">
          We Remove Hiring Uncertainty & <span className="text-blue-500">Protect Milestone Payouts</span>
        </h1>
        <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto font-light">
          FixFlow AI turns chaotic freelance listings into verified, risk-free operations. Structured briefs, client risk scoring, auto-vetting, and cryptographically signed escrows.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link to="/signup">
            <Button size="lg" className="w-full sm:w-auto gap-2">
              Join Developer Waitlist <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
          <Link to="/how-it-works">
            <Button size="lg" variant="secondary" className="w-full sm:w-auto">
              How Escrow Works
            </Button>
          </Link>
        </div>

        {/* Credibility logos / Trust points */}
        <div className="pt-12 text-slate-500 text-xs font-medium uppercase tracking-widest space-y-4">
          <p>Powered by Next-Gen Trust Infrastructure</p>
          <div className="flex flex-wrap justify-center items-center gap-x-8 gap-y-4 font-outfit text-sm font-bold text-slate-400">
            <span className="flex items-center space-x-1"><Coins className="w-4.5 h-4.5 text-blue-500" /> <span>Razorpay Fiat Hold</span></span>
            <span className="flex items-center space-x-1"><Code className="w-4.5 h-4.5 text-purple-500" /> <span>Polygon SBT Minting</span></span>
            <span className="flex items-center space-x-1"><FileCheck className="w-4.5 h-4.5 text-emerald-500" /> <span>Gemini Vetting AI</span></span>
          </div>
        </div>
      </section>

      {/* Pain Points Comparison */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-slate-900">
        <div className="text-center space-y-2 mb-12">
          <h2 className="text-3xl font-bold font-outfit text-white">Why Traditional Marketplace Platforms Fail You</h2>
          <p className="text-sm text-slate-400 max-w-xl mx-auto">Open bidding chaos, payment vulnerability, and opaque ranking rules exploit genuine talent and delay clients.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {painPoints.map((point, index) => (
            <Card key={index} className="p-6 space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <span className="text-xs font-bold text-blue-500 font-outfit uppercase tracking-widest">0{index + 1} // {point.title}</span>
                <div className="space-y-3 pt-2">
                  <div className="flex items-start space-x-2 text-xs">
                    <AlertTriangle className="w-4.5 h-4.5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-slate-400 uppercase tracking-wide text-[10px]">Traditional Marketplace</p>
                      <p className="text-slate-400">{point.old}</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-2 text-xs">
                    <Shield className="w-4.5 h-4.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-emerald-400 uppercase tracking-wide text-[10px]">FixFlow AI Paradigm</p>
                      <p className="text-slate-200 font-medium">{point.new}</p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* How it Works Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-slate-900">
        <div className="text-center space-y-2 mb-12">
          <h2 className="text-3xl font-bold font-outfit text-white">The Trust-First Operational Loop</h2>
          <p className="text-sm text-slate-400 max-w-xl mx-auto">Four core stages that ensure complete alignment, transaction safety, and verifiable outcomes.</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { step: '1', title: 'Structured Brief', desc: 'Client raw text is parsed into rigid deliverables schemas using Zod guardrails, preventing scope drift.' },
            { step: '2', title: 'Gemini Fit Score', desc: 'AI reviews developer profile, missing skills, and matches capabilities with a 0-100 Confidence Index.' },
            { step: '3', title: 'Locked Escrow', desc: 'Milestone amounts are locked in virtual accounts prior to start, protected by concurrency controls.' },
            { step: '4', title: 'Reputation Mint', desc: 'On completion, verified delivery rates are minted on-chain as a Soulbound Token (SBT) credential badge.' }
          ].map((item, index) => (
            <div key={index} className="space-y-3 relative p-4 bg-slate-900/20 border border-slate-900 rounded-lg">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-900/10 border border-blue-800/30 text-blue-500 font-outfit font-bold text-sm">
                {item.step}
              </span>
              <h3 className="font-bold font-outfit text-slate-200">{item.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Feature Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-slate-900">
        <div className="text-center space-y-2 mb-12">
          <h2 className="text-3xl font-bold font-outfit text-white">Platform Capabilities Catalog</h2>
          <p className="text-sm text-slate-400 max-w-xl mx-auto">Explore features designed specifically for professional operations, not casual bidding.</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { title: 'Transparent Payouts', desc: 'Review exact platform commissions, Razorpay gateway fees, and TDS cuts before accepting proposals.', icon: <Coins className="w-5 h-5" /> },
            { title: 'Client Behavior Badging', desc: 'Vetting labels displaying client stability records, average approval time, and late-payment risk alerts.', icon: <Users className="w-5 h-5" /> },
            { title: 'AI Screening generator', desc: 'Auto-generates technical vetting questions for candidates based on missing skills and project brief details.', icon: <FileCheck className="w-5 h-5" /> },
            { title: 'Repeat Offers Engine', desc: 'Vector-analyzes completed milestones and chat discussions to automatically suggest Phase 2 proposals.', icon: <TrendingUp className="w-5 h-5" /> },
            { title: 'Ledger Audit Trails', desc: 'Each state transition triggers a SHA-256 block hash linked to the previous one, forming a validation chain.', icon: <Shield className="w-5 h-5" /> },
            { title: 'MFA Security Guard', desc: 'Critical milestones payouts require a step-up Multi-Factor Authentication TOTP verifier callback.', icon: <Shield className="w-5 h-5" /> }
          ].map((item, index) => (
            <Card key={index} hoverEffect className="p-5 space-y-3">
              <div className="p-2 bg-blue-900/10 border border-blue-900/20 rounded-lg text-blue-500 inline-block">
                {item.icon}
              </div>
              <h3 className="font-bold font-outfit text-slate-200">{item.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Waitlist CTA */}
      <section className="max-w-4xl mx-auto px-4 py-16 mb-16 relative z-10">
        <Card className="p-8 text-center space-y-6 bg-gradient-to-b from-slate-900/80 to-slate-950/90 border-blue-900/25 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Shield className="w-32 h-32 text-blue-500" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold font-outfit text-white">Secure Your Operational Access Today</h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto">Join the waitlist to receive priority onboarding invite, reduced platform fees (PRO tier for 6 months), and custom sandbox testing credits.</p>
          </div>

          {submitted ? (
            <div className="p-3 bg-emerald-950/20 border border-emerald-900/40 text-emerald-400 text-xs rounded-lg font-medium inline-block max-w-md mx-auto">
              🎉 Success! Your email has been added to the queue. Check your inbox for onboarding invite.
            </div>
          ) : (
            <form onSubmit={handleWaitlistSubmit} className="max-w-md mx-auto flex flex-col sm:flex-row gap-2 mt-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="dev@fixflowai.com"
                required
                className="flex-grow px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500"
              />
              <Button type="submit" variant="primary" className="gap-1.5 py-2.5">
                Join Queue <ChevronRight className="w-4 h-4" />
              </Button>
            </form>
          )}
        </Card>
      </section>
    </div>
  );
};
export default LandingPage;
