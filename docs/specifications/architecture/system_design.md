# FixFlowAI - System Design & Architecture Document

This document details the high-level system architecture, technology stack, security boundaries, and end-to-end operational sequence flows for **FixFlowAI**.

---

## 🧠 1. Architectural Overview & Requirements

FixFlowAI is designed as an Enterprise-Grade SaaS platform linking Web2 developers, freelancers, Web3 decentralized escrows, and clients.

### A. Core Tech Stack (Next-Gen Version)

| Architectural Layer | Technology Selected | Purpose |
| :--- | :--- | :--- |
| **Frontend SPA** | Next.js (App Router) + Tailwind CSS + Framer Motion | High-performance user interface, server-side rendering (SSR), and smooth interactive views. |
| **Backend API** | Node.js + Express / NestJS | Core business logic server, controller routes, and server-sent event (SSE) streaming. |
| **Primary Database**| PostgreSQL (hosted on AWS Aurora / RDS) | ACID-compliant relational storage for core entities and structured transaction records. |
| **Database ORM** | Prisma | Typesafe database client, migration management, and relational mapping. |
| **Session & Rate Cache**| Redis (hosted on AWS ElastiCache / Redis Enterprise) | High-speed stateful session storage, rate limiting, and BullMQ task queues. |
| **File Storage** | AWS S3 | Object store for template files, S3-bound briefs, and exported proposal PDFs. |
| **Payment Processor**| Razorpay APIs | Fiat escrow holdings and split-route banking payouts. |
| **Web3 Trust Layer**| Polygon Blockchain + Ethers.js | Decentralized USDC contracts, wallet binds, and Soulbound DID minting. |

---

## 🎨 2. System Architecture Topology

The diagram below maps the runtime infrastructure of FixFlowAI, enforcing separation of concerns between public ingress, private compute, and isolated state layers.

```mermaid
graph TD
    classDef client fill:#3b82f6,stroke:#1d4ed8,stroke-width:2px,color:#fff;
    classDef edge fill:#64748b,stroke:#475569,stroke-width:2px,color:#fff;
    classDef compute fill:#eab308,stroke:#ca8a04,stroke-width:2px,color:#000;
    classDef storage fill:#22c55e,stroke:#16a34a,stroke-width:2px,color:#fff;
    classDef external fill:#a855f7,stroke:#9333ea,stroke-width:2px,color:#fff;

    ClientBrowser["Client Browser (Next.js)"]:::client
    WAF["AWS WAF & CloudFront (CDN/Firewall)"]:::edge
    ALB["AWS Application Load Balancer"]:::edge
    APICluster["API Backend (Express/NestJS Cluster)"]:::compute
    
    PostgreSQL["PostgreSQL Database (Aurora)"]:::storage
    RedisCache["Redis (Session Store, Rate Limits, Queues)"]:::storage
    S3Data["AWS S3 Bucket (Proposal Blobs)"]:::storage
    
    GeminiAPI["Google Gemini API"]:::external
    RazorpayGateway["Razorpay Escrow Gateway"]:::external
    PolygonChain["Polygon Smart Contract"]:::external

    ClientBrowser -->|"1. Requests static assets & page loads"| WAF
    ClientBrowser -->|"2. Secure HTTPS connection (TLS 1.3)"| ALB
    ALB -->|"3. Forwards traffic to VPC"| APICluster
    
    APICluster -->|"4. Checks session state & rate limits"| RedisCache
    APICluster -->|"5. Queries application entities"| PostgreSQL
    APICluster -->|"6. Saves/loads static proposals"| S3Data
    
    APICluster -->|"7. Calls LLM models for generation"| GeminiAPI
    APICluster -->|"8. Creates virtual payment accounts"| RazorpayGateway
    APICluster -->|"9. Triggers Web3 DID token minting"| PolygonChain
```

---

## 🔄 3. End-to-End Proposal & Payment Sequence

The following sequence details how a freelancer and client interact with the Next-Gen infrastructure to negotiate, lock funds, and release payments:

```mermaid
sequenceDiagram
    autonumber
    actor Freelancer
    actor Client
    participant API as NestJS / Express Backend
    participant Redis as Redis Cache
    participant DB as PostgreSQL (Prisma)
    participant RP as Razorpay API
    participant Poly as Polygon Contract

    %% Step 1: Onboarding
    Freelancer->>API: Scan GitHub & Profile setup
    API->>DB: Save updated FreelancerProfile (Prisma)
    API-->>Freelancer: Niche profile updated

    %% Step 2: Auth and Rate checks
    Freelancer->>API: Request Proposal Generation (Brief Upload)
    API->>Redis: Check API Rate Limit (Sliding Window ZSET)
    Redis-->>API: Rate Limit check PASSED
    API->>API: Generate structured proposal (Gemini)
    API-->>Freelancer: Stream proposal JSON (SSE)

    %% Step 3: Portal Sharing
    Freelancer->>API: Share Portal Link (PIN Gated)
    API->>DB: Save Proposal & generate portal token
    Client->>API: Open Portal Link + Enter PIN
    API->>Redis: Increment Telemetry metrics (dwell time tracking)
    API-->>Client: Render proposal view

    %% Step 4: Escrow Deal
    Client->>API: Accept Proposal & Milestone terms
    API->>DB: Update proposal status to WON & Create Escrow record
    API->>RP: Create Smart Collect Virtual Account
    RP-->>API: Return payment coordinates
    API-->>Client: Prompt payment transfer

    %% Step 5: Payment Lock
    Client->>RP: Fund Milestone 1 (25%)
    RP->>API: Webhook callback (PAYMENT_RECEIVED)
    API->>DB: Update Escrow status to FUNDED
    API-->>Freelancer: Notify: Milestone 1 funded. Start work.

    %% Step 6: Payout and DID Minting
    Freelancer->>Client: Submit Milestone 1 deliverables
    Client->>API: Approve Milestone 1 completion
    API->>RP: Trigger Razorpay Route transfer (payout release)
    RP-->>Freelancer: Disburse funds to bank account
    API->>Poly: Mint Soulbound DID Credential
    Poly-->>Freelancer: SB-NFT credential transferred to wallet
    API-->>Client: Milestone 1 closed. Ready for Milestone 2.
```

---

## 🔒 4. Security, Authentication & Session Specifications

For detailed guidelines regarding token configurations, role matrices, security headers, XSS/CSRF protections, and API rate limits, please refer directly to the [security_architecture.md](file:///c:/Users/suvam/Desktop/VS%20code/Projects/FixFlowAI/docs/specifications/architecture/security_architecture.md) manual.

For architectural and implementation details regarding the five core engineering subsystems (Semantic Brief Parsing, Multi-Agent Orchestration, Milestone State Machine, Real-time Sync, and Self-Correction Loops), see the [skills.md](file:///c:/Users/suvam/Desktop/VS%20code/Projects/FixFlowAI/docs/specifications/core_subsystems/skills.md) manual.

For the product strategy overview detailing how client and freelancer pain points translate into platform UVPs and engineering features, refer to the [market_positioning_and_uvps.md](file:///c:/Users/suvam/Desktop/VS%20code/Projects/FixFlowAI/docs/specifications/product_strategy/market_positioning_and_uvps.md) guide.


