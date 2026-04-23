# Proplytics: Features & Novelty

Proplytics is not just another text-generating chatbot. It is a **deterministic analysis pipeline** designed to transform unstructured client briefs into highly structured, confidence-scored technical proposals. This document details the core features, characteristics, and the novelty of the platform.

## Core Features & Characteristics

### 1. AI-Powered Brief Ingestion & Analysis
- **Feature**: Users can paste raw client briefs (or upload documents like PDFs/DOCX). The system ingests this unstructured text and performs a deep analysis.
- **Characteristic**: Unlike standard LLMs that generate block text, Proplytics parses the intent, identifies required features, assesses risks, and calculates effort estimates.
- **Novelty**: It acts as an "elite consultant" rather than a template-filler, extracting raw data directly from the client's own words and structuring it.

### 2. The Confidence Grid (Signature Feature)
- **Feature**: Every recommended feature in the proposal is presented in a specialized UI grid.
- **Characteristic**: Each row includes a color-coded accent, a percentage-based confidence score, and a complexity badge (Low, Medium, High).
- **Novelty**: This provides complete transparency into the AI's reasoning. Instead of blindly trusting the output, agencies can see exactly where the AI is highly confident (e.g., standard authentication) versus where it is guessing due to vague brief details (e.g., custom integrations), allowing humans to focus their review time where it matters most.

### 3. Streaming Structured JSON via Server-Sent Events (SSE)
- **Feature**: The backend streams the LLM response to the frontend in real-time.
- **Characteristic**: Instead of waiting 30+ seconds for a massive text dump, the React frontend progressively renders the UI as the data arrives.
- **Novelty**: Achieving stable, progressively rendered UI from *streaming JSON* is technically complex. The pipeline enforces JSON-only output from the LLM, and the frontend pieces the JSON chunks together on the fly to animate the proposal reveal.

### 4. Zod Schema Validation & Auto-Repair
- **Feature**: All incoming data from the LLM is strictly validated against a predefined schema.
- **Characteristic**: Ensures that the output always matches the required proposal structure (Features, Timeline, Budget, Risks).
- **Novelty**: If the LLM produces malformed JSON or cuts off unexpectedly, the backend implements a repair pass and fallback re-prompt mechanism to guarantee a fully functional, rendering-ready document every single time.

### 5. Interactive Web View & PDF Export
- **Feature**: Proposals are initially delivered as interactive web documents.
- **Characteristic**: Users can review, adjust, and present the proposal digitally, or export it to a beautifully formatted PDF.
- **Novelty**: Bridges the gap between modern web interaction and traditional agency delivery requirements (PDFs), including accurate font embedding and layout mapping directly from the DOM.

### 6. S3-Backed Revision History & Diffing
- **Feature**: Proposals are versioned and stored.
- **Characteristic**: Teams can track changes across multiple iterations of a proposal.
- **Novelty**: Provides a code-like "diff" view for documents, allowing agencies to see exactly what changed in scope, budget, or timelines between revision V1 and V2.

## Summary of Novelty

The true novelty of Proplytics lies in its approach to the problem. While competitors build "fill-in-the-blank" templates or rely on generic LLM text generation, Proplytics builds a **data pipeline**. 

It forces the LLM to output structured data (JSON), validates it, scores it for confidence, and uses the frontend exclusively for rendering. This approach collapses 10-15 hours of manual analysis, estimation, and document writing into less than 30 seconds, fundamentally changing how digital agencies handle incoming project requests.
