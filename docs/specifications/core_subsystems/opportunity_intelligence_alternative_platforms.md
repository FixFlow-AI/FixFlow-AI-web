# FixFlow AI — Alternative Platforms for the Opportunity Intelligence Stack
> Companion to `opportunity_intelligence_implementation.md` · Researched June 2026
> Scope: what else could fill the **Discovery / Ingestion / Enrichment** layers besides your named Apify · Apollo.io · Brave

---

## 0. Quick Verdict First

Your existing doc already assigns Apify, Apollo.io, and Brave to three different layers. Before adding alternatives, here's the one-line verdict per layer — including the cases where **you may not need a paid platform at all**:

| Layer | Your tool | Verdict | Best alternative if you want one |
|---|---|---|---|
| **Discovery** (search) | Brave Search API | Still fine, but its free tier was removed in Feb 2026 — budget for it now | **Serper.dev** (cheapest raw SERP) or **Exa** (semantic, for fuzzy "looking for a dev" phrasing) |
| **Ingestion** (RSS/Reddit/HN feeds) | Apify | Overkill for *this specific use case* — Remotive/WWR/Himalayas are plain RSS, Reddit and HN both have free official APIs | **Direct official APIs + cron** ($0) or **n8n self-hosted** ($0) if you want a visual scheduler |
| **Enrichment** (company size, stack, funding, ATS) | Apollo.io | Fine for company size/industry, but Apollo is really a contact/outreach database — weak fit for "funding round" and "ATS used" | **People Data Labs** (company API, free tier) + a couple of free, self-built lookups (below) |

The rest of this doc expands each row with pricing, trade-offs, and what I'd actually wire up given your stage (solo/early team, cost-sensitive, India-based billing in USD).

---

## 1. Market Shifts Since Mid-2026 You Should Know About

A few things changed in the tool landscape after your original doc was written — they affect your cost assumptions directly:

| Change | Date | Impact on FixFlow |
|---|---|---|
| **Brave Search API removed its free 5,000 queries/month plan** | Feb 2026 | New signups get a $5 one-time credit only, then it's pay-per-call ($5/1,000 queries). Budget for this in `opportunityQueue.ts` cron costs. |
| **Tavily was acquired by Nebius** | Feb 10, 2026 | Tavily still works the same way today, but as an acquired product its roadmap/pricing could shift — worth a fallback plan (Serper/Exa) rather than single-sourcing discovery. |
| **Microsoft fully retired the Bing Search API** | Aug 2025 | Not in your stack, but rules out Bing as a future fallback — confirms Brave/Tavily/Serper as the realistic independent-index options. |
| **Crunchbase killed its free API tier** | 2025 | If you were ever tempted to add Crunchbase for "funding round" enrichment, it's now $49–99/month minimum with no free access. There's a cheaper path below. |
| **Clearbit no longer exists standalone** | Ongoing since late 2023 acquisition | It's now "Breeze Intelligence," locked behind a paid HubSpot subscription ($75+/month just to unlock it). Not viable as an Apollo alternative unless you're already on HubSpot. |

---

## 2. Discovery Layer — Alongside / Instead of Brave Search API

Your doc already runs Tavily + Brave + SerpAPI in parallel for redundancy. If you want to add or swap one given the Brave pricing change:

| Tool | What it's good at | Pricing (Jun 2026) | Fit for FixFlow |
|---|---|---|---|
| **Serper.dev** | Raw Google SERP, fast, cheapest credible option | 2,500 free queries total, then ~$50/50k queries (~$1/1k) | Best budget fallback once Brave's free credit runs out. Keyword-only (not semantic), so pair it with your existing Zod/Gemini extraction — you're already doing that. |
| **Exa** | Neural/semantic search — understands intent, not just keywords | $10 starter credit, then usage-based (variable credits per query) | Useful specifically for your fuzzy queries like `"who can build" OR "need someone to build"` — semantic search catches phrasing Tavily/Brave miss. Pricing is less predictable than Serper, so use it selectively, not as your main loop. |
| **Linkup** | Search optimized for factual accuracy, ranks #1 on SimpleQA benchmark | ~€5/1,000 standard searches | Less relevant for opportunity *discovery*, more for **verifying a client's company is real** before you score them — a possible Extra Module 3 (client scoring) input. |
| **Parallel AI Search** | Agent-native search with sourced/evidence-backed results, benchmarks well above Tavily/Exa on accuracy tests | Usage-based, contact for pricing | Worth a look if hallucinated/stale opportunity cards become a real problem — but it's a heavier integration than you likely need at MVP stage. |

**Recommendation:** Keep Tavily as primary (already wired in, official MCP support). Add **Serper** as the cheap fallback connector instead of leaning harder on Brave now that its free tier is gone — same `discoveryService.ts` pattern, just another connector in the array you already combine and dedupe.

---

## 3. Ingestion Layer — Alongside / Instead of Apify

This is the layer where I'd push back hardest on adding another *platform*. Look at what you're actually ingesting per your own file path summary:

- **Remotive, We Work Remotely, Himalayas** → these are plain RSS feeds. No JS rendering, no anti-bot wall, no actor needed.
- **Reddit r/forhire** → Reddit has an official Data API (you already cite `redditinc.com/policies/data-api-terms` in your feasibility doc).
- **Hacker News "Who's Hiring"** → HN has a free, public, no-auth-required Firebase API (`hacker-news.firebaseio.com`) maintained by HN itself.

None of these three sources strictly require Apify, Firecrawl, or any scraping platform — they require a **scheduler + an HTTP client + a parser**, which is infrastructure you're already building in `ingestionScheduler.ts` and `opportunityQueue.ts`.

| Option | Cost | When it actually earns its place over "just call the official API directly" |
|---|---|---|
| **Direct official APIs + your existing BullMQ cron** | $0 | Default recommendation for Remotive/WWR/Himalayas/Reddit/HN specifically. One small `rss-parser` npm package + native `fetch` covers all five sources. |
| **n8n (self-hosted)** | $0 self-hosted, $24+/mo cloud | If you'd rather have a visual workflow with built-in retries/scheduling than hand-roll cron logic — same outcome, lower code to maintain, but it's a second service to deploy/host. |
| **Apify (keep it)** | Free $5/mo credit, then pay-per-compute-unit | Still the right call **only if** you later expand into sources that genuinely need a browser/anti-bot layer (e.g., scanning broader forum sites beyond r/forhire). Don't pay for Apify just to hit five RSS-shaped, already-compliant feeds. |
| **Firecrawl** | 1 credit/page, ~$83/mo for 100k pages | Worth it later if you expand "open web" discovery into actually *reading* full pages (not just snippets) and want clean Markdown for Gemini instead of raw HTML — reduces token usage materially. Not needed for the current five sources. |
| **Browse AI** | From $19/mo | Good fit if you want change-detection ("alert me when this page adds a new listing") without writing scraper logic — closer to a monitoring tool than an ingestion pipeline. |

**Recommendation:** For the Phase 2 sources in your feasibility doc (RSS feeds + Reddit + HN), skip a paid ingestion platform entirely and write thin connectors against the official APIs/feeds — same pattern as your `tavilyConnector.ts`/`braveConnector.ts` files, just `redditConnector.ts` and `hnConnector.ts`. Keep Apify in your back pocket (or swap to Firecrawl) only if/when you genuinely need to render JS-heavy pages.

---

## 4. Enrichment Layer — Alongside / Instead of Apollo.io

This is where most "Apollo alternatives" content on the web will mislead you, because it's written for cold-email/outbound sales teams (Clay, Cognism, Lusha, ZoomInfo) — a different job than yours. Your actual need per the extra-modules doc is four specific fields per lead: **company size, tech stack, funding round, ATS used**. None of those require a sales-outreach platform.

| Field you need | Apollo.io today | Cheaper/better-fit alternative | Why |
|---|---|---|---|
| **Company size / industry** | Decent, bundled with outreach features you don't use | **People Data Labs Company API** | Free tier: 100 company lookups/month, no card required. Pure REST API, no UI you're paying for. At your lead volume this is likely $0/month indefinitely. |
| **Tech stack** | Apollo's technographic data is shallow | **Self-built header/script detector** (≈50 lines, same pattern as your `clientScoring.js`) | BuiltWith Pro starts at $295/mo just for *one* tracked technology — wildly disproportionate for enriching a handful of leads a week. A lightweight detector reading `Server`/`X-Powered-By` headers and common script tags (Next.js, Shopify, WordPress, HubSpot, Stripe, etc.) covers the common cases for free. Apify also sells a pay-per-event version of this (~$0.002–0.01/domain) if you'd rather not maintain the signature list yourself. |
| **Funding round** | Not Apollo's strength either | **Reuse Tavily/Brave you already pay for** + Gemini extraction | Crunchbase killed its free tier (now $49–99/mo minimum) — not worth it for occasional lookups. A targeted query like `"<company name>" funding round site:crunchbase.com OR site:techcrunch.com` through your existing discovery connectors, parsed by the same Gemini+Zod step you use for `ProjectPostSchema`, gets you 80% of the value at $0 marginal cost. |
| **ATS used** | Apollo doesn't expose this at all | **Static domain-pattern lookup** (free) | ATS detection is just "does the apply link point to `greenhouse.io`, `lever.co`, `myworkdayjobs.com`, `smartrecruiters.com`, `bamboohr.com`, or `ashbyhq.com`?" — a lookup table, not an API call. |

A small illustrative snippet for the last one, in the same style as your existing skills files:

```typescript
// backend/src/skills/atsDetector.ts
const ATS_DOMAIN_MAP: Record<string, string> = {
  'greenhouse.io': 'Greenhouse',
  'lever.co': 'Lever',
  'myworkdayjobs.com': 'Workday',
  'smartrecruiters.com': 'SmartRecruiters',
  'bamboohr.com': 'BambooHR',
  'ashbyhq.com': 'Ashby',
  'jobs.lever.co': 'Lever',
}

export function detectATS(applyUrl: string): string | null {
  const hit = Object.keys(ATS_DOMAIN_MAP).find(domain => applyUrl.includes(domain))
  return hit ? ATS_DOMAIN_MAP[hit] : null
}
```

**Recommendation:** Keep Apollo.io for the cases where you genuinely want its bundled company database lookup, but don't expect it to cover funding/ATS — those were never really an Apollo job. Add People Data Labs' free tier for firmographics, and write the two small free detectors above for stack/ATS. That covers all four `sbt-metadata.json`-adjacent fields at effectively $0/month until your lead volume outgrows PDL's 100/month free cap.

---

## 5. Updated Environment Variables

Additions to the block in your implementation doc, if you adopt the free-first picks above:

```bash
# backend/.env — additions

# Discovery (fallback for Brave's removed free tier)
SERPER_API_KEY=...

# Enrichment (company size/industry — free tier)
PDL_API_KEY=...

# No keys needed for: Reddit Data API (OAuth app credentials only),
# HN Firebase API (fully public, no auth), atsDetector.ts, techStackDetector.ts
REDDIT_CLIENT_ID=...
REDDIT_CLIENT_SECRET=...
```

---

## 6. Recommended Stack at Your Current Stage

| Layer | Pick | Monthly cost at MVP volume |
|---|---|---|
| Discovery | Tavily (existing) + Serper (new fallback) | ~$0–20 |
| Ingestion | Direct RSS/Reddit/HN connectors (no platform) | $0 |
| Enrichment — firmographics | People Data Labs free tier | $0 (up to 100 lookups/mo) |
| Enrichment — stack & ATS | Self-built detectors | $0 |
| Enrichment — funding signal | Reuse Tavily/Brave + Gemini extraction | $0 marginal |

That's a materially cheaper stack than running Apify + Apollo.io + Brave at their paid tiers, without losing any of the four enrichment fields your SBT metadata schema needs — and it reuses infrastructure (BullMQ queues, Zod schemas, Gemini extraction) you're already building rather than bolting on new vendors.

### When to revisit this
- **Ingestion → Apify/Firecrawl:** once you go past the five compliant sources into broader open-web forum scanning that needs JS rendering or anti-bot handling.
- **Enrichment → Apollo/Clay/PDL Pro:** once lead volume passes ~100/month and the free PDL tier stops covering you, or once you want *contact-level* data (not just company-level) for a future B2B-facing feature.
- **Discovery → Exa/Parallel AI:** if stale or hallucinated opportunity cards become a measurable problem worth the less-predictable pricing.

---

## Sources Checked (June 2026)

- Brave: https://brave.com/learn/best-search-api-2026/
- Serper/Exa/Tavily/Brave comparisons: https://dev.to/supertrained/exa-vs-tavily-vs-serper-vs-brave-search-for-ai-agents-an-score-comparison-2l1g
- Search API market overview: https://www.olostep.com/blog/best-web-search-apis
- Apify alternatives: https://www.tinyfish.ai/blog/best-apify-alternatives-for-ai-web-agents-in-2026
- n8n self-hosting cost: https://www.gumloop.com/blog/apify-alternatives
- Apollo vs. Clay vs. PDL: https://www.explorium.ai/blog/data-enrichment/apollo-alternatives/
- People Data Labs pricing: https://support.peopledatalabs.com/hc/en-us/articles/25794271805211-Pricing-credits
- Clearbit/Breeze Intelligence lock-in: https://www.cleanlist.ai/blog/clearbit-pricing-guide
- BuiltWith/Wappalyzer pricing: https://derrick-app.com/tools/builtwith-pricing
- Crunchbase free tier removal: https://dev.to/agenthustler/crunchbase-api-in-2026-free-tier-gone-what-startup-data-hunters-do-now-1177
