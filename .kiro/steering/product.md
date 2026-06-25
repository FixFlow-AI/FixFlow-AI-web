# FixFlowAI Product Overview

## What is FixFlowAI?

FixFlowAI is a **Trust-First, Risk-Free, Outcome-Based Workspace** that manages the entire lifecycle of freelance projects—from brief to payout—with built-in guarantees for both parties.

## Core Problem

Traditional freelance platforms (Upwork, Fiverr, Freelancer.com) are high-friction bulletin boards characterized by:
- Open bidding chaos and proposal spam
- Opaque algorithms and unpredictable visibility
- High fee overheads and hidden costs
- Fragmented communication across multiple tools
- Payment safety risks and delayed escrow releases

## Solution Approach

FixFlowAI addresses these through:
- **AI-powered brief parsing** that converts unstructured client inputs into structured proposals
- **Multi-agent verification** that validates proposals and matches freelancers to projects
- **Secure milestone-based escrow** with finite state machine controls
- **Real-time unified workspace** for collaboration, deliverables, and payments
- **Verifiable reputation system** using blockchain-based Soulbound DID credentials

## Key Value Propositions

### For Freelancers:
- **Protected payments by default** - Built-in escrow with milestone funding requirements
- **Transparent earnings engine** - See exact net earnings after all fees before accepting work
- **Game-proof reputation** - Multi-dimensional performance indicators (on-time rate, revision efficiency, dispute-free delivery)
- **Client quality scoring** - Rate clients on scope stability, payment behavior, and communication

### For Clients:
- **Trust-first hiring** - Pre-qualified candidates with verified portfolios and skills
- **Zero-noise shortlist** - AI matching returns only top 3-5 candidates, no spam proposals
- **Fast hire for urgent work** - Get instant matches in under 60 seconds
- **One workspace from brief to delivery** - Unified project page for chats, files, deliverables, milestones, and approvals
- **Transparent pricing** - Upfront milestone fees with no hidden costs

## Tech Stack Position

- **Frontend**: Next.js (App Router) + Tailwind CSS + Framer Motion
- **Backend**: Node.js + Express/NestJS
- **Database**: PostgreSQL (AWS Aurora/RDS) with Prisma ORM
- **Cache/Queue**: Redis (AWS ElastiCache)
- **AI/LLM**: Google Gemini API for semantic parsing and multi-agent orchestration
- **Payments**: Razorpay APIs for fiat escrow
- **Web3**: Polygon blockchain for Soulbound DID credentials
