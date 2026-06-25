# FixFlowAI Project Structure

## Repository Organization

```
FixFlowAI/
├── .git/                           # Git version control
├── .kiro/                          # Kiro AI assistant configuration
│   └── steering/                   # Project guidance documents
├── backend/                        # Node.js/Express backend service
│   ├── src/
│   │   ├── skills/                # Core subsystem implementations
│   │   └── test/                  # Test files
│   ├── dist/                      # Compiled TypeScript output
│   ├── node_modules/              # Backend dependencies
│   ├── package.json               # Backend dependencies and scripts
│   └── tsconfig.json              # TypeScript configuration
└── docs/                          # Documentation and specifications
    ├── assets/                    # Images and visual assets
    │   ├── landing-concepts/      # Landing page concept designs
    │   └── product-screens/       # Product UI mockups and screenshots
    └── specifications/            # Technical specifications
        ├── ai_features/           # AI feature specifications
        ├── architecture/          # System design and architecture docs
        ├── core_subsystems/       # Subsystem implementation specs
        ├── frontend/              # Frontend requirements and roadmap
        └── product_strategy/      # Product positioning and UVPs
```

## Core Directory Purposes

### `/backend`
Backend service containing the Node.js/Express API and core business logic.

**Key subdirectories:**
- `src/skills/` - Five core subsystems ("Skills") that power the platform
- `src/test/` - Test files for subsystem validation
- `dist/` - Compiled JavaScript output (generated, not committed)
- `node_modules/` - NPM dependencies (generated, not committed)

### `/docs`
Comprehensive documentation covering product strategy, architecture, and implementation guides.

**Key subdirectories:**
- `assets/` - Visual assets for documentation and product design
- `specifications/` - Detailed technical specifications organized by domain

### `/.kiro`
Configuration and guidance for the Kiro AI assistant working on this project.

## Backend Skills Architecture

The `backend/src/skills/` directory contains the five core subsystems that implement FixFlowAI's key value propositions:

### 1. Brief Parser (`briefParser.ts`)
**Purpose**: Semantic parsing of unstructured client briefs into structured proposals  
**Key Patterns**: Zod schema validation, native Gemini schema constraints, fallback sanitization  
**Maps to UVP**: "Outcome-based matching" and "Fast hire for urgent work"

### 2. Confidence Grid (`confidenceGrid.ts`)
**Purpose**: Multi-agent validation using parallel persona workers (Auditor + Feasibility agents)  
**Key Patterns**: Parallel API calls, consensus scoring (0-100 index), idempotent evaluation  
**Maps to UVP**: "Zero-noise shortlist" and "Trust-first hiring"

### 3. Escrow State Machine (`escrowStateMachine.ts`)
**Purpose**: Secure milestone payment lifecycle management  
**Key Patterns**: FSM with valid state transitions, SHA-256 audit trail, optimistic concurrency control  
**Maps to UVP**: "Protected payment by default" and "Transparent earnings engine"

### 4. Sync Server (`syncServer.ts`)
**Purpose**: Real-time collaboration between freelancer and client dashboards  
**Key Patterns**: WebSocket multiplexing, causal vector clocks, Last-Write-Wins conflict resolution  
**Maps to UVP**: "Unified workspace from brief to delivery"

### 5. Self-Correction Loop (in `confidenceGrid.ts`)
**Purpose**: Automated proposal optimization when quality scores fall below threshold  
**Key Patterns**: Confidence index triggers (<75), GAP feedback prompting, automatic regeneration  
**Maps to UVP**: Quality assurance for "Zero-noise shortlist"

## Supporting Modules

Additional problem-resolution modules supplement the core subsystems:

- `earningsCalculator.js` - Transparent fee breakdown (tiered commissions, gateway fees, TDS)
- `reputationCalculator.js` - Multi-dimensional trust scores and SBT schema generation
- `clientScoring.js` - Client behavior profiling (scope stability, payment speed, risk flags)
- `interviewGenerator.ts` - Dynamic vetting question generation
- `contextExtensions.ts` - Contextual contract extension suggestions

## Documentation Structure

### `/docs/specifications/ai_features/`
Individual AI feature specifications with implementation details:
- Semantic brief parsing
- Confidence grid self-correction
- Interview vetting generation
- Contextual contract extensions
- Opportunity intelligence scoring
- Smart matching and lead scoring

### `/docs/specifications/architecture/`
System-level architecture documentation:
- `system_design.md` - High-level architecture, tech stack, and sequence diagrams
- `security_architecture.md` - Authentication, authorization, and security controls
- `database_design.md` - Data models and schema design
- `erd_and_api_contracts.md` - Entity relationships and API specifications
- `backend_connectivity_roadmap.md` - Integration roadmap

### `/docs/specifications/core_subsystems/`
Deep dives into subsystem design and implementation:
- `skills.md` - The five core subsystems manual
- `opportunity_intelligence_implementation.md` - Lead scoring and matching
- `client_project_ingestion_feasibility.md` - Brief ingestion workflows

### `/docs/specifications/frontend/`
Frontend-specific documentation:
- Frontend gaps and requirements
- Implementation guide
- Development roadmap

### `/docs/specifications/product_strategy/`
Product positioning and market strategy:
- `market_positioning_and_uvps.md` - Pain points, UVPs, and technical mappings
- Landing page design and implementation plans
- Product image generation prompts

## Naming Conventions

### Files
- **Backend modules**: `{feature}{Type}.{ts|js}` (e.g., `briefParser.ts`, `syncServer.ts`)
- **Specification docs**: `{topic}_{subcategory}.md` (e.g., `system_design.md`)
- **AI features**: `ai_{number}_{feature_name}.md` (e.g., `ai_001_semantic_brief_parsing.md`)

### Code
- **Functions**: camelCase (e.g., `parseBrief()`, `sanitizeAndPatchBrief()`)
- **Types/Interfaces**: PascalCase (e.g., `Proposal`, `BriefOutputSchema`)
- **Constants**: UPPER_SNAKE_CASE for enum-like values

## Development Workflow

1. **Specifications first** - Check `/docs/specifications/` for existing design docs
2. **Schema validation** - Define Zod schemas before implementation
3. **Core subsystems** - Route through appropriate skill modules (don't bypass FSM or validation)
4. **Documentation** - Update relevant specification docs when changing architecture
5. **Testing** - Add tests to `backend/src/test/` for new features

## File Relationships

The architecture enforces these relationships:

```
UVPs (Product Strategy) 
  ↓ maps to
API Endpoints (Architecture Specs)
  ↓ implements via
Core Subsystems (Skills)
  ↓ operates on
Data Models (Database Design)
```

When implementing features, trace from UVP → API → Subsystem → Model to maintain consistency across the stack.
