# FixFlowAI Technical Stack & Build Guide

## Tech Stack

### Backend
- **Runtime**: Node.js with ES Modules (`"type": "module"`)
- **Framework**: Express.js (considering NestJS migration)
- **Language**: TypeScript 5.4+ with strict mode enabled
- **TypeScript Config**:
  - Target: ESNext
  - Module: NodeNext
  - Module Resolution: NodeNext
  - Allows JavaScript files alongside TypeScript

### Dependencies
- **AI/LLM**: `@google/genai` (Google Gemini API)
- **Validation**: `zod` for schema validation and type safety
- **HTTP**: `express` with `cors` middleware
- **WebSockets**: `ws` for real-time collaboration
- **Environment**: `dotenv` for configuration management

### Planned Infrastructure
- **Database**: PostgreSQL with Prisma ORM (not yet implemented)
- **Cache**: Redis for sessions, rate limiting, and BullMQ queues
- **Storage**: AWS S3 for file storage
- **Payments**: Razorpay API integration
- **Blockchain**: Polygon with Ethers.js for Soulbound DIDs

## Project Structure

```
backend/
├── src/
│   ├── skills/          # Core subsystem implementations
│   └── test/            # Test files
├── dist/                # Compiled JavaScript output
├── package.json
└── tsconfig.json
```

## Build Commands

### Development
```bash
cd backend
npm install              # Install dependencies
npm run build           # Compile TypeScript to JavaScript
npm start               # Run compiled application from dist/
```

### Notes
- Build output goes to `dist/` directory
- Source files are in `src/` directory
- No hot-reload or watch mode configured yet
- Tests are located in `src/test/`

## Code Style & Conventions

### TypeScript
- **Strict mode enabled** - All strict type checks are enforced
- **ES Modules only** - Use `import/export`, no CommonJS `require()`
- **Mixed JS/TS** - Some files are `.js`, others `.ts` (gradual migration)
- **Skip lib checks** - `skipLibCheck: true` for faster compilation

### Module Naming Patterns
Core subsystems follow the pattern: `{feature}{Type}.{ts|js}`
- `briefParser.ts` - Brief parsing and schema validation
- `confidenceGrid.ts` - Multi-agent proposal verification
- `escrowStateMachine.ts` - Payment milestone FSM
- `syncServer.ts` - Real-time WebSocket synchronization
- `interviewGenerator.ts` - AI-powered interview questions
- `contextExtensions.ts` - Contract extension suggestions
- `earningsCalculator.js` - Fee and payout calculations
- `reputationCalculator.js` - Trust score computation
- `clientScoring.js` - Client quality ratings

### Architecture Principles
1. **Schema-first validation** - All external data must pass through Zod schemas
2. **Finite State Machines** - Use FSM for state transitions (escrow, milestones)
3. **Immutable audit trails** - State changes generate SHA-256 chained hashes
4. **Optimistic concurrency** - Version fields prevent race conditions
5. **Fallback mechanisms** - Sanitization functions handle malformed inputs
6. **Multi-agent orchestration** - Parallel LLM calls with consensus scoring

## Integration Guidelines

### When Adding New Features
1. **Schema validation first** - Define Zod schemas before implementation
2. **Respect FSM boundaries** - Route state changes through proper transitions
3. **Maintain audit logs** - Add cryptographic verification for sensitive operations
4. **Vector clock sync** - Include vector clocks for real-time collaborative features
4. **Feed reputation data** - Store metrics in structured JSON for AI matching

### LLM Integration Pattern
```typescript
// 1. Define Zod schema for validation
const OutputSchema = z.object({ /* ... */ });

// 2. Configure Gemini with native schema constraint
const model = genAI.getGenerativeModel({
  model: "gemini-2.5-pro",
  generationConfig: {
    responseJsonSchema: zodToJsonSchema(OutputSchema)
  }
});

// 3. Add fallback sanitization for errors
try {
  const result = OutputSchema.parse(response);
} catch (error) {
  const sanitized = sanitizeAndPatch(response);
}
```

## Security Notes
- API keys managed via `.env` files (use `dotenv`)
- MFA required for payment releases (FSM security hook)
- Session state and rate limits managed in Redis
- Escrow operations use optimistic concurrency control
