# FixFlow AI — Opportunity Intelligence & Client Onboarding Implementation Guide
> Using Apify · Tavily · Brave Search · SerpAPI · Apollo.io

---

## Quick Verdict First

Your feasibility doc already blocked the obvious bad paths (scraping Upwork, auto-contacting clients). The five tools you named do not unlock those blocked paths — they operate at a **different layer entirely**. Here is exactly where each belongs:

| Tool | Role in FixFlowAI | Layer |
|---|---|---|
| **Tavily** | Real-time web search for open opportunity signals (forums, blogs, X/Twitter, GitHub Discussions) | Discovery |
| **Brave Search API** | Independent search index fallback — less SEO-gamed than Google results | Discovery |
| **SerpAPI** | Google Jobs structured data for remote/contract work listings | Discovery |
| **Apify** | Automate compliant RSS ingestion (Remotive, WeWorkRemotely, Himalayas) and Reddit/HN scanning | Ingestion |
| **Apollo.io** | Enrich company context on a saved lead — NOT for sourcing clients | Enrichment |

The critical distinction: **Tavily/Brave/SerpAPI find signals. Apify fetches compliant feeds. Apollo.io enriches after the fact.** None of them bypass the source policy gate your feasibility doc requires.

---

## 1. Architecture Map

```
┌──────────────────────────────────────────────────────────────────────┐
│                    OPPORTUNITY INTELLIGENCE ENGINE                    │
│                                                                      │
│  DISCOVERY LAYER         INGESTION LAYER         ENRICHMENT LAYER   │
│  ─────────────────        ─────────────────        ──────────────── │
│  Tavily Search API  ──┐                                              │
│  Brave Search API   ──┼──> Source Policy Gate ──> BullMQ Queue      │
│  SerpAPI (GJobs)    ──┘         │                      │            │
│                                 │                      │            │
│  Apify Actors       ────────────┘              Normalizer           │
│  (RSS, Reddit, HN)                                    │             │
│                                                        ↓             │
│                                                  RawExternalPost    │
│                                                        │             │
│                                              Apollo.io Enrichment   │
│                                            (company size, stack,    │
│                                             funding round, ATS)     │
│                                                        │             │
│                                              ProjectPostSchema      │
│                                              (Zod extraction)       │
│                                                        │             │
│                                            OpportunityScore Engine  │
│                                            (your existing           │
│                                             Confidence Grid)        │
│                                                        │             │
│                                         Freelancer Opportunity Board│
└──────────────────────────────────────────────────────────────────────┘
```

---

## 2. Data Flow — Full Lifecycle

```
Tavily/Brave/SerpAPI search query
          │
          ▼
Raw search results (title + URL + snippet + source)
          │
          ▼
Source Policy Gate ← rejects blocked sources immediately
          │
          ▼
BullMQ job: `opportunity:ingest:{sourceKey}`
          │
          ▼
Apify actor OR RSS fetch OR API call (depending on source)
          │
          ▼
RawExternalPost (stored with TTL, attribution, compliance flags)
          │
          ▼
Apollo.io enrichment (if company name/domain detected in post)
          │
          ▼
ProjectPostSchema extraction via Gemini + Zod
          │
          ▼
OpportunityScore = SkillMatch + BudgetFit + Recency + BriefQuality + SourceCompliance - ScamPenalty
          │
          ▼
Opportunity record created per matching FreelancerProfile
          │
          ▼
Freelancer sees: Opportunity Board card
          │
     ┌────┴────────────────────────┐
     ▼                             ▼
Draft Proposal                 Apply on Source
(FixFlow internal)             (link-out — source-dependent)
     │
     ▼
ClientClaim link (only if source policy allows)
     │
     ▼
Lead → Proposal → Escrow (existing FixFlow FSM)
```

---

## 3. Tool-by-Tool Implementation Paths

---

### 3.1 Tavily — Open Web Opportunity Discovery

**What it does here:** Searches the public web for project/work requests posted outside walled marketplace gardens — Reddit threads, personal blog hiring posts, GitHub Discussions, Indie Hackers, Hacker News, Twitter/X, dev.to, etc.

**Why it works:** Tavily returns source-attributed results with clean text snippets. It is designed for AI agent consumption. No scraping. No ToS issues with Tavily itself (you still respect each result's source policy individually).

**File path:**
```
backend/src/connectors/search/tavilyConnector.ts
```

**Implementation:**
```typescript
// backend/src/connectors/search/tavilyConnector.ts
import { TavilyClient } from '@tavily/core'
import { sourcePolicy } from '../sourcePolicy'

const tavily = new TavilyClient({ apiKey: process.env.TAVILY_API_KEY })

export interface TavilyOpportunityResult {
  title: string
  url: string
  snippet: string
  domain: string
  publishedDate?: string
  sourceKey: string
}

// Query templates that surface real freelance work signals
const OPPORTUNITY_QUERIES = [
  'looking for developer to build site:reddit.com OR site:news.ycombinator.com',
  '"need a developer" OR "looking for freelancer" budget React TypeScript 2025',
  '"hire developer" OR "need backend engineer" site:news.ycombinator.com',
  'freelance developer needed React OR Node.js fixed price contract',
  '"who can build" OR "need someone to build" developer budget',
]

export async function searchOpportunitiesViaTavily(
  freelancerSkills: string[],
  customQuery?: string
): Promise<TavilyOpportunityResult[]> {
  const skillFragment = freelancerSkills.slice(0, 4).join(' OR ')
  const query = customQuery
    ?? `"looking for developer" OR "need freelancer" ${skillFragment} 2025 budget`

  const response = await tavily.search(query, {
    searchDepth: 'advanced',
    maxResults: 15,
    includeDomains: [],          // open web — no domain restriction
    excludeDomains: [
      'upwork.com',              // blocked — must use official API only
      'fiverr.com',              // blocked — no project post API
      'freelancer.com',          // blocked until official OAuth integration
      'peopleperhour.com',       // blocked — no API found
    ],
    includeAnswer: false,
    includeRawContent: false,    // snippets only — avoid full-text storage issues
  })

  return response.results
    .filter(r => sourcePolicy.isAllowed(r.url))  // second gate
    .map(r => ({
      title: r.title,
      url: r.url,
      snippet: r.content,
      domain: new URL(r.url).hostname,
      publishedDate: r.publishedDate,
      sourceKey: detectSourceKey(r.url),
    }))
}

function detectSourceKey(url: string): string {
  if (url.includes('reddit.com')) return 'reddit'
  if (url.includes('news.ycombinator.com')) return 'hackernews'
  if (url.includes('github.com')) return 'github_discussions'
  if (url.includes('indiehackers.com')) return 'indiehackers'
  if (url.includes('dev.to')) return 'devto'
  return 'open_web'
}
```

**BullMQ job trigger:**
```typescript
// backend/src/jobs/queues/opportunityQueue.ts
await opportunityQueue.add('tavily:search', {
  freelancerId: profile.id,
  skills: profile.githubScan?.languages ?? [],
  queryType: 'discovery',
}, { repeat: { every: 6 * 60 * 60 * 1000 } })  // every 6 hours
```

---

### 3.2 Brave Search API — Independent Index Fallback

**What it does here:** Brave's index is less dominated by SEO-gamed content than Google. Useful for surfacing authentic "need a dev" posts from forums, communities, and small business sites that Tavily might weight lower.

**Why it's different from Tavily:** Different crawl + ranking algorithm → different results → better coverage when combined. Also has a separate News endpoint for recency signals.

**File path:**
```
backend/src/connectors/search/braveConnector.ts
```

**Implementation:**
```typescript
// backend/src/connectors/search/braveConnector.ts
// Brave Web Search API — https://api.search.brave.com/

export interface BraveSearchResult {
  title: string
  url: string
  description: string
  age: string | null   // "2 days ago" — useful for recency scoring
  sourceKey: string
}

export async function searchOpportunitiesViaBrave(
  skills: string[],
  recencyFilter: 'day' | 'week' | 'month' = 'week'
): Promise<BraveSearchResult[]> {
  const query = `"looking for developer" OR "hire freelancer" ${skills.slice(0, 3).join(' OR ')}`

  const response = await fetch(
    `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&freshness=${recencyFilter}&count=20`,
    {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': process.env.BRAVE_SEARCH_API_KEY!,
      },
    }
  )

  const data = await response.json()

  return (data.web?.results ?? [])
    .filter((r: any) => sourcePolicy.isAllowed(r.url))
    .map((r: any) => ({
      title: r.title,
      url: r.url,
      description: r.description,
      age: r.age ?? null,
      sourceKey: detectSourceKey(r.url),
    }))
}
```

**Usage note:** Run Brave and Tavily in parallel, then dedupe by URL before normalization:
```typescript
// backend/src/services/discoveryService.ts
const [tavilyResults, braveResults] = await Promise.all([
  searchOpportunitiesViaTavily(skills),
  searchOpportunitiesViaBrave(skills),
])

const combined = dedupeByUrl([...tavilyResults, ...braveResults])
```

---

### 3.3 SerpAPI — Google Jobs Structured Data

**What it does here:** Pulls structured Google Jobs listings for remote/contract work. Google Jobs aggregates postings from Indeed, Glassdoor, company career pages, and job boards into a structured format — including salary, work type (contract/remote), and posting date.

**Important scope constraint:** Google Jobs is primarily employment-oriented (W-2/salary). The signal value for FixFlowAI is: remote contract roles posted by companies → those companies are candidates for direct FixFlow outreach or freelance-friendly leads. It is NOT a freelance marketplace replacement.

**File path:**
```
backend/src/connectors/search/serpApiConnector.ts
```

**Implementation:**
```typescript
// backend/src/connectors/search/serpApiConnector.ts
import { getJson } from 'serpapi'

export interface GoogleJobResult {
  title: string
  companyName: string
  location: string
  postedAt: string
  description: string
  contractType: string   // 'Contractor', 'Full-time', etc.
  salary: string | null
  applyLink: string
  extensions: string[]
}

export async function searchContractJobsViaSerpApi(
  skills: string[],
  location: string = 'Worldwide'
): Promise<GoogleJobResult[]> {
  const query = `${skills.slice(0, 2).join(' ')} contract developer remote`

  const results = await getJson({
    engine: 'google_jobs',
    q: query,
    location,
    hl: 'en',
    api_key: process.env.SERPAPI_KEY,
  })

  return (results.jobs_results ?? [])
    .filter((job: any) => {
      const ext = (job.detected_extensions ?? {})
      // Only contract/freelance-type work
      return ext.work_from_home
        || job.extensions?.some((e: string) =>
            ['Contract', 'Contractor', 'Freelance', 'Part-time'].some(t => e.includes(t))
          )
    })
    .map((job: any) => ({
      title: job.title,
      companyName: job.company_name,
      location: job.location,
      postedAt: job.detected_extensions?.posted_at ?? '',
      description: job.description,
      contractType: job.detected_extensions?.schedule_type ?? 'unknown',
      salary: job.detected_extensions?.salary ?? null,
      applyLink: job.related_links?.[0]?.link ?? '',
      extensions: job.extensions ?? [],
    }))
}
```

**How SerpAPI results map to FixFlowAI lead types:**

```
Google Jobs "Contract React Developer" post
        ↓
companyName extracted → Apollo.io enrichment (stack, size, funding)
        ↓
If company is a startup with <50 employees + recent funding
        ↓
High-value Opportunity: "startup needs contract dev" 
signal (not auto-contact — freelancer decides)
```

---

### 3.4 Apify — Compliant Feed Automation

**What it does here:** Runs as the **scheduled ingestion worker** for sources that are safe to automate — RSS feeds (Remotive, WeWorkRemotely, Himalayas), Reddit `/r/forhire` monitoring, and Hacker News "Who is hiring" thread parsing.

**What it does NOT do here:** Scrape Upwork, Fiverr, Freelancer.com, or LinkedIn. Those are blocked by source policy. Any Apify actor that targets those platforms should be gated out.

**File path:**
```
backend/src/connectors/apify/
├── apifyClient.ts          ← shared Apify SDK wrapper
├── actors/
│   ├── rssIngestionActor.ts     ← Remotive, WeWorkRemotely, Himalayas
│   ├── redditForHireActor.ts    ← r/forhire, r/webdev hiring threads
│   └── hnWhoIsHiringActor.ts   ← HN monthly "Who is Hiring" thread
```

**Implementation:**
```typescript
// backend/src/connectors/apify/apifyClient.ts
import { ApifyClient } from 'apify-client'

export const apify = new ApifyClient({ token: process.env.APIFY_API_TOKEN })

// ---

// backend/src/connectors/apify/actors/rssIngestionActor.ts
// Uses Apify's built-in RSS scraper actor (apify/rss-scraper)

const RSS_SOURCES = [
  {
    key: 'remotive',
    feedUrl: 'https://remotive.com/remote-jobs/rss/software-dev',
    requiresAttribution: true,
    maxCacheHours: 48,
    allowFullTextStorage: true,
    allowClientInvite: false,
    primaryAction: 'apply_on_source',
  },
  {
    key: 'weworkremotely',
    feedUrl: 'https://weworkremotely.com/remote-developer-jobs.rss',
    requiresAttribution: true,
    maxCacheHours: 24,
    allowFullTextStorage: true,
    allowClientInvite: false,
    primaryAction: 'apply_on_source',
  },
  {
    key: 'himalayas',
    feedUrl: 'https://himalayas.app/jobs/rss',
    requiresAttribution: true,
    maxCacheHours: 48,
    allowFullTextStorage: true,
    allowClientInvite: false,
    primaryAction: 'apply_on_source',
  },
]

export async function runRssIngestion(): Promise<void> {
  for (const source of RSS_SOURCES) {
    const run = await apify.actor('apify/rss-scraper').call({
      urls: [source.feedUrl],
      maxItems: 50,
    })

    const { items } = await apify.dataset(run.defaultDatasetId).listItems()

    for (const item of items) {
      await opportunityQueue.add('rss:normalize', {
        sourceKey: source.key,
        sourcePolicy: source,
        rawItem: item,
      })
    }
  }
}

// ---

// backend/src/connectors/apify/actors/redditForHireActor.ts
// IMPORTANT: only reads public posts — no contact scraping
// Targets r/forhire (Hiring posts only) and r/webdev pinned hiring threads

export async function runRedditForHireScan(): Promise<void> {
  const run = await apify.actor('trudax/reddit-scraper-lite').call({
    searches: [
      'subreddit:forhire title:[Hiring]',
      'subreddit:webdev title:hiring developer',
    ],
    maxItems: 30,
    skipComments: true,
    proxy: { useApifyProxy: true },
  })

  const { items } = await apify.dataset(run.defaultDatasetId).listItems()

  for (const post of items) {
    // Gate: only posts, no DMs, no contact info scraping
    if (!post.url || post.url.includes('/message/')) continue

    await opportunityQueue.add('reddit:normalize', {
      sourceKey: 'reddit_forhire',
      rawItem: {
        title: post.title,
        url: `https://reddit.com${post.permalink}`,
        text: post.selftext?.slice(0, 2000),  // truncate — don't store full text forever
        postedAt: post.created_utc,
      },
    })
  }
}
```

---

### 3.5 Apollo.io — Company Context Enrichment

**What it does here:** After a `RawExternalPost` is saved and a company name or domain is detected in the post, Apollo enriches the company record — employee count, tech stack, funding stage, industry vertical. This feeds the `ClientTrustScore` component in your OpportunityScore formula.

**What it does NOT do here:** Provide cold outreach targets. Your feasibility doc blocks automated outbound messages. Apollo data goes into the `company` JSON on the Opportunity record — it helps freelancers decide whether to bid, not whether to cold-email.

**File path:**
```
backend/src/connectors/enrichment/apolloEnrichment.ts
```

**Implementation:**
```typescript
// backend/src/connectors/enrichment/apolloEnrichment.ts

export interface CompanyEnrichment {
  name: string
  domain: string
  employeeCount: number | null
  employeeRange: string | null   // '1-10', '11-50', '51-200', etc.
  industry: string | null
  techStack: string[]
  fundingTotal: number | null
  fundingStage: string | null    // 'Seed', 'Series A', etc.
  linkedinUrl: string | null
  country: string | null
}

export async function enrichCompanyViaApollo(
  companyNameOrDomain: string
): Promise<CompanyEnrichment | null> {
  // Apollo Organization Enrichment API
  // Docs: https://apolloio.github.io/apollo-api-docs/#organization-enrichment
  const res = await fetch('https://api.apollo.io/v1/organizations/enrich', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    },
    body: JSON.stringify({
      api_key: process.env.APOLLO_API_KEY,
      domain: companyNameOrDomain.includes('.')
        ? companyNameOrDomain
        : undefined,
      name: !companyNameOrDomain.includes('.')
        ? companyNameOrDomain
        : undefined,
    }),
  })

  if (!res.ok) return null

  const { organization } = await res.json()
  if (!organization) return null

  return {
    name: organization.name,
    domain: organization.primary_domain,
    employeeCount: organization.estimated_num_employees ?? null,
    employeeRange: organization.employee_count ?? null,
    industry: organization.industry ?? null,
    techStack: organization.technologies?.map((t: any) => t.name) ?? [],
    fundingTotal: organization.total_funding ?? null,
    fundingStage: organization.latest_funding_stage ?? null,
    linkedinUrl: organization.linkedin_url ?? null,
    country: organization.country ?? null,
  }
}

// How it integrates into the scoring pipeline:
export function computeClientTrustScore(enrichment: CompanyEnrichment | null): number {
  if (!enrichment) return 30   // no data → neutral-low trust

  let score = 50

  // Established company → more trust
  if (enrichment.employeeCount && enrichment.employeeCount > 10) score += 10
  if (enrichment.fundingStage) score += 15   // funded = real company
  if (enrichment.linkedinUrl) score += 10    // verifiable identity
  if (enrichment.techStack.length > 0) score += 10   // has real tech

  // Small startup with no funding and no web presence → lower trust
  if (!enrichment.fundingStage && enrichment.employeeCount && enrichment.employeeCount < 5) score -= 10

  return Math.min(100, Math.max(0, score))
}
```

---

## 4. BullMQ Queue Architecture

All five tools feed a shared ingestion queue. Each job carries its source key and raw payload.

**File path:**
```
backend/src/jobs/
├── queues/
│   ├── opportunityQueue.ts        ← main ingestion queue
│   └── enrichmentQueue.ts         ← Apollo enrichment queue (separate rate limits)
├── workers/
│   ├── opportunityWorker.ts       ← normalizes + dedupes raw posts
│   └── enrichmentWorker.ts        ← runs Apollo enrichment after normalization
└── schedulers/
    └── ingestionScheduler.ts      ← cron triggers for Apify + Tavily + Brave
```

```typescript
// backend/src/jobs/queues/opportunityQueue.ts
import { Queue, Worker } from 'bullmq'
import { redis } from '../../lib/redis'

export const opportunityQueue = new Queue('opportunity-ingestion', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
})

// Job types:
// 'tavily:search'      → runs Tavily connector, pushes raw results back to queue
// 'brave:search'       → runs Brave connector
// 'serpapi:jobs'       → runs SerpAPI Google Jobs connector
// 'rss:normalize'      → processes a single RSS item from Apify
// 'reddit:normalize'   → processes a Reddit r/forhire post from Apify
// 'opportunity:score'  → runs OpportunityScore after normalization
// 'enrich:company'     → triggers Apollo enrichment (separate queue)
```

```typescript
// backend/src/jobs/schedulers/ingestionScheduler.ts
// Runs on server startup — schedules all discovery jobs

export function startIngestionScheduler() {
  // Tavily + Brave — discovery runs every 4 hours
  opportunityQueue.add('tavily:search', {}, {
    repeat: { pattern: '0 */4 * * *' },
    jobId: 'tavily-recurring',
  })

  opportunityQueue.add('brave:search', {}, {
    repeat: { pattern: '0 */4 * * *' },
    jobId: 'brave-recurring',
  })

  // SerpAPI Google Jobs — every 8 hours (paid API, more expensive)
  opportunityQueue.add('serpapi:jobs', {}, {
    repeat: { pattern: '0 */8 * * *' },
    jobId: 'serpapi-recurring',
  })

  // Apify RSS run — every 2 hours
  opportunityQueue.add('apify:rss', {}, {
    repeat: { pattern: '0 */2 * * *' },
    jobId: 'apify-rss-recurring',
  })

  // Apify Reddit scan — once every 6 hours
  opportunityQueue.add('apify:reddit', {}, {
    repeat: { pattern: '0 */6 * * *' },
    jobId: 'apify-reddit-recurring',
  })
}
```

---

## 5. Source Policy Gate — Single File

All five tools route through a single source policy gate before anything is stored. This is the constraint your feasibility doc requires.

**File path:**
```
backend/src/connectors/sourcePolicy.ts
```

```typescript
// backend/src/connectors/sourcePolicy.ts
// SINGLE SOURCE OF TRUTH for what is allowed per source.
// Add every new source here before building a connector for it.

export type SourceKey =
  | 'reddit_forhire'
  | 'hackernews'
  | 'github_discussions'
  | 'indiehackers'
  | 'devto'
  | 'open_web'
  | 'remotive'
  | 'weworkremotely'
  | 'himalayas'
  | 'google_jobs'
  | 'manual'

export interface SourcePolicy {
  key: SourceKey
  displayName: string
  accessMode: 'rss' | 'official_api' | 'search_result' | 'manual_import'
  requiresAttribution: boolean
  maxCacheHours: number
  allowFullTextStorage: boolean
  allowAggregatedSearch: boolean
  allowApplyInFixFlow: boolean   // can freelancer submit via FixFlow?
  allowClientInvite: boolean     // can we send client a claim link?
  primaryAction: 'apply_on_source' | 'draft_only' | 'client_claim_allowed'
  riskLevel: 'low' | 'medium' | 'high' | 'blocked'
}

export const SOURCE_POLICIES: Record<SourceKey, SourcePolicy> = {
  remotive: {
    key: 'remotive', displayName: 'Remotive', accessMode: 'rss',
    requiresAttribution: true, maxCacheHours: 48, allowFullTextStorage: true,
    allowAggregatedSearch: true, allowApplyInFixFlow: false, allowClientInvite: false,
    primaryAction: 'apply_on_source', riskLevel: 'low',
  },
  weworkremotely: {
    key: 'weworkremotely', displayName: 'We Work Remotely', accessMode: 'rss',
    requiresAttribution: true, maxCacheHours: 24, allowFullTextStorage: true,
    allowAggregatedSearch: true, allowApplyInFixFlow: false, allowClientInvite: false,
    primaryAction: 'apply_on_source', riskLevel: 'low',
  },
  himalayas: {
    key: 'himalayas', displayName: 'Himalayas', accessMode: 'rss',
    requiresAttribution: true, maxCacheHours: 48, allowFullTextStorage: true,
    allowAggregatedSearch: true, allowApplyInFixFlow: false, allowClientInvite: false,
    primaryAction: 'apply_on_source', riskLevel: 'low',
  },
  google_jobs: {
    key: 'google_jobs', displayName: 'Google Jobs (via SerpAPI)', accessMode: 'search_result',
    requiresAttribution: true, maxCacheHours: 24, allowFullTextStorage: false,
    allowAggregatedSearch: true, allowApplyInFixFlow: false, allowClientInvite: false,
    primaryAction: 'apply_on_source', riskLevel: 'medium',
  },
  reddit_forhire: {
    key: 'reddit_forhire', displayName: 'Reddit r/forhire', accessMode: 'search_result',
    requiresAttribution: true, maxCacheHours: 72, allowFullTextStorage: false,
    allowAggregatedSearch: false, allowApplyInFixFlow: false, allowClientInvite: false,
    primaryAction: 'draft_only', riskLevel: 'medium',
  },
  hackernews: {
    key: 'hackernews', displayName: 'Hacker News', accessMode: 'official_api',
    requiresAttribution: true, maxCacheHours: 168, allowFullTextStorage: true,
    allowAggregatedSearch: true, allowApplyInFixFlow: false, allowClientInvite: false,
    primaryAction: 'draft_only', riskLevel: 'low',
  },
  github_discussions: {
    key: 'github_discussions', displayName: 'GitHub Discussions', accessMode: 'search_result',
    requiresAttribution: true, maxCacheHours: 48, allowFullTextStorage: false,
    allowAggregatedSearch: false, allowApplyInFixFlow: false, allowClientInvite: false,
    primaryAction: 'draft_only', riskLevel: 'low',
  },
  indiehackers: {
    key: 'indiehackers', displayName: 'Indie Hackers', accessMode: 'search_result',
    requiresAttribution: true, maxCacheHours: 48, allowFullTextStorage: false,
    allowAggregatedSearch: false, allowApplyInFixFlow: false, allowClientInvite: false,
    primaryAction: 'draft_only', riskLevel: 'low',
  },
  devto: {
    key: 'devto', displayName: 'dev.to', accessMode: 'search_result',
    requiresAttribution: true, maxCacheHours: 48, allowFullTextStorage: false,
    allowAggregatedSearch: false, allowApplyInFixFlow: false, allowClientInvite: false,
    primaryAction: 'draft_only', riskLevel: 'low',
  },
  open_web: {
    key: 'open_web', displayName: 'Open Web', accessMode: 'search_result',
    requiresAttribution: true, maxCacheHours: 24, allowFullTextStorage: false,
    allowAggregatedSearch: false, allowApplyInFixFlow: false, allowClientInvite: false,
    primaryAction: 'draft_only', riskLevel: 'medium',
  },
  manual: {
    key: 'manual', displayName: 'Manual Import', accessMode: 'manual_import',
    requiresAttribution: false, maxCacheHours: 8760, allowFullTextStorage: true,
    allowAggregatedSearch: false, allowApplyInFixFlow: true, allowClientInvite: true,
    primaryAction: 'client_claim_allowed', riskLevel: 'low',
  },
}

export const sourcePolicy = {
  get: (key: SourceKey): SourcePolicy => SOURCE_POLICIES[key],
  isAllowed: (url: string): boolean => {
    const BLOCKED_DOMAINS = [
      'upwork.com', 'fiverr.com', 'freelancer.com', 'peopleperhour.com',
      'toptal.com', 'guru.com',
    ]
    return !BLOCKED_DOMAINS.some(d => url.includes(d))
  },
}
```

---

## 6. Client Onboarding Path — What Actually Gets Converted

The tools above only fill the **discovery → opportunity** half of the funnel. Converting an external opportunity into a real FixFlow client uses a separate flow.

```
EXTERNAL OPPORTUNITY (from Tavily/Brave/SerpAPI/Apify)
        │
        ▼
Freelancer saves it + drafts proposal in FixFlow
        │
        ▼
Freelancer applies on original source (link-out)
        │
        ▼
Client responds ON ORIGINAL PLATFORM
        │ (if client then visits FixFlow independently)
        ▼
Client creates FixFlow account → "Claim a project" flow
        │
        ▼
ClientClaim: email verification + consent checkbox
        │
        ▼
FixFlow Workspace: Proposal → Escrow → Delivery

```

**Direct client onboarding (highest value path, no scraping):**
```
Client lands on fixflowai.xyz
        │
        ▼
"Post your project" form (brief parser input)
        │
        ▼
Structured scope via ProjectPostSchema + Zod
        │
        ▼
ConfidenceGrid: feasibility + budget check
        │
        ▼
Shortlist of 3–5 matching freelancers shown
        │
        ▼
Client picks → Workspace → Escrow → Payment

```

Apollo.io does NOT appear in direct onboarding — it only enriches externally-sourced company signals.

---

## 7. Environment Variables Needed

```bash
# backend/.env

# Discovery
TAVILY_API_KEY=tvly-...
BRAVE_SEARCH_API_KEY=BSA...
SERPAPI_KEY=...

# Ingestion
APIFY_API_TOKEN=apify_api_...

# Enrichment
APOLLO_API_KEY=...

# Existing
GEMINI_API_KEY=...
DATABASE_URL=...
REDIS_URL=...
AWS_S3_BUCKET=...
```

---

## 8. File Path Summary

```
backend/src/
├── connectors/
│   ├── sourcePolicy.ts                        ← ALWAYS edit this first
│   ├── search/
│   │   ├── tavilyConnector.ts                 ← Tavily open-web discovery
│   │   ├── braveConnector.ts                  ← Brave fallback search
│   │   └── serpApiConnector.ts                ← Google Jobs contract listings
│   ├── apify/
│   │   ├── apifyClient.ts
│   │   └── actors/
│   │       ├── rssIngestionActor.ts           ← Remotive, WeWorkRemotely, Himalayas
│   │       ├── redditForHireActor.ts          ← r/forhire scan
│   │       └── hnWhoIsHiringActor.ts          ← HN monthly thread
│   └── enrichment/
│       └── apolloEnrichment.ts                ← company context after post is saved
│
├── jobs/
│   ├── queues/
│   │   ├── opportunityQueue.ts                ← main ingestion queue
│   │   └── enrichmentQueue.ts                 ← Apollo separate rate limits
│   ├── workers/
│   │   ├── opportunityWorker.ts               ← normalize + dedupe + score
│   │   └── enrichmentWorker.ts                ← Apollo enrichment jobs
│   └── schedulers/
│       └── ingestionScheduler.ts              ← cron triggers for all connectors
│
├── services/
│   ├── discoveryService.ts                    ← combines Tavily + Brave results
│   ├── normalizationService.ts                ← maps raw results → RawExternalPost
│   ├── dedupeService.ts                       ← URL hash + title similarity
│   └── opportunityScoreService.ts             ← composite OpportunityScore formula
│
└── skills/
    ├── briefParser.ts                         ← existing (reused for ProjectPostSchema)
    └── [existing skills unchanged]
```

---

## 9. Build Order

```
Step 1 (1 day):
  sourcePolicy.ts — define all policies before writing any connector.
  env vars — add all 5 API keys.

Step 2 (2–3 days):
  tavilyConnector.ts + braveConnector.ts
  opportunityQueue.ts + opportunityWorker.ts (normalization only)
  Verify discovery results before adding scoring.

Step 3 (2 days):
  apifyClient.ts + rssIngestionActor.ts
  ingestionScheduler.ts for Remotive, WeWorkRemotely, Himalayas.
  Confirm attribution renders correctly in opportunity card.

Step 4 (1–2 days):
  serpApiConnector.ts (Google Jobs, filter to Contract only)

Step 5 (2 days):
  apolloEnrichment.ts + enrichmentQueue.ts
  computeClientTrustScore feeds into OpportunityScore.

Step 6 (2 days):
  opportunityScoreService.ts (composite score from all signals)
  dedupeService.ts (dedupe Tavily + Brave + RSS results by URL/title)

Step 7 (3–4 days):
  redditForHireActor.ts + hnWhoIsHiringActor.ts (Apify)
  These are medium-risk. Keep sourcePolicy flags conservative.

Step 8 (when Opportunity Board frontend is ready):
  ClientClaim flow — only for manual import + direct onboarding first.
  External source ClientClaim gated by allowClientInvite flag.
```

---

*Apollo.io does not replace the scraping you might want. It makes the leads you legitimately find much more actionable. The real discovery muscle is Tavily + Brave for signal breadth and Apify for compliant structured feeds.*
