# BUG-03 — WebSocket Sync Has Zero Authentication

> **Role**: Security Engineer · **Priority**: 🟡 High · **Effort**: ~2 days
> **Status**: 🔴 Not started. Identified in [syncServer.ts L165-L171](../../../../backend/src/skills/syncServer.ts#L165-L171).

---

## Story Identity

| Field | Value |
|:---|:---|
| **Story ID** | `BUG-03` |
| **Owner** | Security Engineer / Backend Engineer |
| **Files** | `backend/src/skills/syncServer.ts`, `backend/src/index.ts` |
| **Depends on** | None |

---

## 1. Current Problem

The collaborative document editing system in [syncServer.ts](../../../../backend/src/skills/syncServer.ts) manages real-time synchronization of proposal details using WebSocket connections. However, the connection upgrade process and the channel subscribe (`join`) protocol contain **no authentication or authorization gates**:

```typescript
// backend/src/skills/syncServer.ts
server.on('upgrade', (request: IncomingMessage, socket: any, head: any) => {
  const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;
  if (pathname === '/sync') {
    this.wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
      this.wss.emit('connection', ws, request);
    });
  }
});
```

During connection connection/negotiation, the WebSocket server does not verify authorization headers or query parameters. Inside the connection handler, when a client sends a `join` message:

```typescript
case 'join': {
  const { proposalId, clientId, role, vectorClock } = payload;
  // ...
  let room = activeRooms.get(proposalId);
  // ...
  room.sessions.set(clientId, { ws, clientId, role });
```

The server trusts the user-declared `proposalId`, `clientId`, and `role` credentials. No DB checks are run to verify if:
1. The user is logged in.
2. The user has permission to view/edit the specified `proposalId`.
3. The client's actual role matches the requested role parameter.

```mermaid
flowchart TD
    A["Attacker client opens ws://localhost:4000/sync"] --> B["Connection accepted without auth check"]
    B --> C["Attacker sends join { proposalId: 'target-id', role: 'Client' }"]
    C --> D["Server binds socket to 'target-id' room sessions"]
    D --> E["Attacker sends mutation { field: 'features.0.description', value: 'Malicious payload' }"]
    E --> F["Server updates proposal in-memory state and broadcasts to all clients ❌"]

    style E fill:#dc2626,stroke:#991b1b,color:#fff
    style F fill:#dc2626,stroke:#991b1b,color:#fff
```

---

## 2. Why It Matters

- **Data Poisoning**: Anyone can connect and overwrite feature titles, technical descriptions, or budget lines of any active proposal.
- **Data Leakage**: Upon joining a room, the server immediately returns the full cached JSON structure of the proposal (`sync_response`) to the client, leading to unauthorized access.
- **Denial of Service**: Attackers can spawn thousands of virtual connections and join random rooms, causing memory bloat and connection exhaustion.

---

## 3. Step-Wise Solution

### Step 3.1 — Verify token during HTTP upgrade
Extract the JWT access token from the upgrade request query parameter (e.g. `ws://localhost:4000/sync?token=<token>`). In [syncServer.ts](../../../../backend/src/skills/syncServer.ts):
```typescript
import { verifyAccessToken } from '../auth/tokens.js';

// Inside server.on('upgrade')
const url = new URL(request.url || '', `http://${request.headers.host}`);
const token = url.searchParams.get('token');
if (!token) {
  socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
  socket.destroy();
  return;
}
try {
  const decoded = verifyAccessToken(token);
  // Store claims on request object
  (request as any).auth = decoded;
} catch (err) {
  socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
  socket.destroy();
  return;
}
```

### Step 3.2 — Enforce Token Verification on Room Join
In the WebSocket `'message'` switch-case, verify that the `clientId` matches the token's subject ID (`request.auth.sub`).

### Step 3.3 — Authorize Proposal Access
Query the `proposalRepository` to verify that the proposal exists and matches the user's ID (`userId = sub`), or that they are a permitted collaborator. Reject the join and terminate the socket if authorization fails.

---

## 4. Done When

- [ ] WebSocket upgrade requires a valid JWT `token` parameter.
- [ ] Unauthorized WebSocket connections are closed with `401` or `403` status.
- [ ] `join` payload claims (`clientId`, `role`) are validated against the JWT claims.
- [ ] Database query confirms user permissions before returning the proposal state cache.
- [ ] `npm run build` compiles successfully.

---

## 5. Cross-References

| Document | Relevance |
|:---|:---|
| [syncServer.ts](../../../../backend/src/skills/syncServer.ts) | Collaboration synchronizer server |
| [tokens.ts](../../../../backend/src/auth/tokens.ts) | Token verification client |
| [proposalRepository.ts](../../../../backend/src/services/proposalRepository.ts) | Proposal storage model |
