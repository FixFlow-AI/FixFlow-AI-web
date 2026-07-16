import { IncomingMessage } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { verifyAccessToken } from '../auth/tokens.js';
import { getProposalRepository } from '../services/proposalRepository.js';

// ==========================================
// Message Contracts & Protocol Types
// ==========================================

export type ClientRole = 'Freelancer' | 'Client' | 'Collaborator';

export interface VectorClock {
  [clientId: string]: number;
}

export interface JoinPayload {
  type: 'join';
  proposalId: string;
  clientId: string;
  role: ClientRole;
  vectorClock: VectorClock;
}

export interface MutationPayload {
  type: 'mutation';
  proposalId: string;
  clientId: string;
  field: string; // Dot-separated path inside the Proposal object, e.g. "features.0.description"
  value: any;
  vectorClock: VectorClock;
  timestamp: number; // Client-side wall-clock timestamp (Unix epoch milliseconds)
}

export interface SyncRequestPayload {
  type: 'sync_request';
  proposalId: string;
  clientId: string;
}

export type IncomingPayload = JoinPayload | MutationPayload | SyncRequestPayload;

// Server Outgoing Messages
export interface ServerAckPayload {
  type: 'ack';
  proposalId: string;
  vectorClock: VectorClock;
}

export interface ServerSyncResponsePayload {
  type: 'sync_response';
  proposalId: string;
  state: any;
  vectorClock: VectorClock;
}

export interface ServerMutationBroadcastPayload {
  type: 'mutation_broadcast';
  proposalId: string;
  clientId: string;
  field: string;
  value: any;
  vectorClock: VectorClock;
  timestamp: number;
}

export type OutgoingPayload =
  | ServerAckPayload
  | ServerSyncResponsePayload
  | ServerMutationBroadcastPayload;

// ==========================================
// Server Session & State Cache
// ==========================================

interface ActiveSession {
  ws: WebSocket;
  clientId: string;
  role: ClientRole;
}

interface ProposalRoom {
  proposalId: string;
  state: any; // In-memory cached copy of active proposal JSON
  vectorClock: VectorClock;
  lastUpdatedTimestamps: Record<string, number>; // Maps field-path -> last updated client timestamp
  sessions: Map<string, ActiveSession>; // clientId -> Session
}

// Global active proposal collaboration rooms registry
const activeRooms = new Map<string, ProposalRoom>();

// ==========================================
// Causal Order & Conflict Resolvers
// ==========================================

/**
 * Checks if clock A is strictly causally concurrent or conflicting with clock B.
 * A conflict happens when A has elements greater than B and B has elements greater than A.
 */
export function detectClockConflict(clockA: VectorClock, clockB: VectorClock): boolean {
  let aHasGreater = false;
  let bHasGreater = false;

  const allClients = new Set([...Object.keys(clockA), ...Object.keys(clockB)]);

  for (const client of allClients) {
    const valA = clockA[client] ?? 0;
    const valB = clockB[client] ?? 0;

    if (valA > valB) {
      aHasGreater = true;
    }
    if (valB > valA) {
      bHasGreater = true;
    }
  }

  return aHasGreater && bHasGreater;
}

/**
 * Updates a nested object property by a dot-separated path (e.g. "features.0.description").
 */
export function setNestedProperty(obj: any, path: string, value: any): void {
  const parts = path.split('.');
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    
    // Check if next part is an array index or string key
    const nextPart = parts[i + 1];
    const isNextNumeric = !isNaN(Number(nextPart));

    if (!(part in current) || current[part] === null || typeof current[part] !== 'object') {
      current[part] = isNextNumeric ? [] : {};
    }
    
    current = current[part];
  }

  const lastPart = parts[parts.length - 1];
  current[lastPart] = value;
}

// ==========================================
// WebSocket Server Implementation
// ==========================================

export class SyncServer {
  private wss: WebSocketServer;

  constructor(server: any) {
    this.wss = new WebSocketServer({ noServer: true });
    
    // Bind upgrade listener to external HTTP server
    server.on('upgrade', (request: IncomingMessage, socket: any, head: any) => {
      const url = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
      const pathname = url.pathname;
      
      if (pathname === '/sync') {
        const token = url.searchParams.get('token');
        if (!token) {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }
        try {
          const decoded = verifyAccessToken(token);
          (request as any).auth = decoded;
        } catch (err) {
          socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
          socket.destroy();
          return;
        }

        this.wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
          this.wss.emit('connection', ws, request);
        });
      }
    });

    this.wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
      let currentRoomId: string | null = null;
      let currentClientId: string | null = null;

      ws.on('message', async (message: string) => {
        try {
          const payload = JSON.parse(message) as IncomingPayload;
          const { proposalId, clientId } = payload;

          // 1. Authenticate user: ensure clientId matches token sub (BUG-03)
          const auth = (request as any).auth;
          if (!auth || clientId !== auth.sub) {
            console.warn(`WebSocket message rejected: Client ID [${clientId}] does not match token sub [${auth?.sub}].`);
            ws.close(4003, 'Forbidden: Client ID mismatch');
            return;
          }

          // 2. Authorize user: verify proposal exists and matches owner sub (BUG-03)
          const proposalRepo = getProposalRepository();
          const proposal = await proposalRepo.get(proposalId);
          if (!proposal) {
            console.warn(`WebSocket message rejected: Proposal [${proposalId}] not found.`);
            ws.close(4004, 'Proposal Not Found');
            return;
          }

          if (proposal.userId !== auth.sub) {
            console.warn(`WebSocket message rejected: User [${auth.sub}] is not authorized for Proposal [${proposalId}].`);
            ws.close(4003, 'Forbidden: Unauthorized for this proposal');
            return;
          }

          switch (payload.type) {
            case 'join': {
              const { role, vectorClock } = payload;
              currentRoomId = proposalId;
              currentClientId = clientId;

              let room = activeRooms.get(proposalId);
              if (!room) {
                // Initialize room dynamically (in production, fetch initial state from DB)
                room = {
                  proposalId,
                  state: {},
                  vectorClock: {},
                  lastUpdatedTimestamps: {},
                  sessions: new Map()
                };
                activeRooms.set(proposalId, room);
              }

              // Merge vector clocks (causal alignment)
              for (const [cid, count] of Object.entries(vectorClock)) {
                room.vectorClock[cid] = Math.max(room.vectorClock[cid] ?? 0, count);
              }

              room.sessions.set(clientId, { ws, clientId, role });
              console.log(`Client [${clientId}] joined Room [${proposalId}] as [${role}].`);

              // Transmit initial sync state back
              const response: ServerSyncResponsePayload = {
                type: 'sync_response',
                proposalId,
                state: room.state,
                vectorClock: room.vectorClock
              };
              ws.send(JSON.stringify(response));
              break;
            }

            case 'mutation': {
              const { proposalId, clientId, field, value, vectorClock, timestamp } = payload;
              const room = activeRooms.get(proposalId);
              if (!room) {
                console.warn(`Mutation rejected: Proposal room [${proposalId}] does not exist.`);
                return;
              }

              const isConflict = detectClockConflict(vectorClock, room.vectorClock);
              const lastUpdated = room.lastUpdatedTimestamps[field] ?? 0;

              // Conflict Resolution: Check causal sequence or fallback to LWW
              if (!isConflict || timestamp > lastUpdated) {
                // Accept Mutation: Apply to in-memory state
                setNestedProperty(room.state, field, value);
                room.lastUpdatedTimestamps[field] = timestamp;
                
                // Align room clocks
                for (const [cid, count] of Object.entries(vectorClock)) {
                  room.vectorClock[cid] = Math.max(room.vectorClock[cid] ?? 0, count);
                }
                
                // Increment current client clock sequence on the server
                room.vectorClock[clientId] = (room.vectorClock[clientId] ?? 0) + 1;

                console.log(`Mutation accepted for field [${field}] by Client [${clientId}] in Room [${proposalId}].`);

                // Broadcast modification to other room subscribers
                const broadcastMsg: ServerMutationBroadcastPayload = {
                  type: 'mutation_broadcast',
                  proposalId,
                  clientId,
                  field,
                  value,
                  vectorClock: room.vectorClock,
                  timestamp
                };

                for (const [cid, session] of room.sessions.entries()) {
                  if (cid !== clientId && session.ws.readyState === WebSocket.OPEN) {
                    session.ws.send(JSON.stringify(broadcastMsg));
                  }
                }

                // Send acknowledgement to mutation origin client
                const ackMsg: ServerAckPayload = {
                  type: 'ack',
                  proposalId,
                  vectorClock: room.vectorClock
                };
                ws.send(JSON.stringify(ackMsg));

              } else {
                console.warn(
                  `Conflict resolved: Client [${clientId}] update on [${field}] rejected. Server timestamp [${lastUpdated}] is newer than client timestamp [${timestamp}] (LWW).`
                );
                // Force sync client back to server state
                const forceSync: ServerSyncResponsePayload = {
                  type: 'sync_response',
                  proposalId,
                  state: room.state,
                  vectorClock: room.vectorClock
                };
                ws.send(JSON.stringify(forceSync));
              }
              break;
            }

            case 'sync_request': {
              const { proposalId, clientId } = payload;
              const room = activeRooms.get(proposalId);
              if (room) {
                const response: ServerSyncResponsePayload = {
                  type: 'sync_response',
                  proposalId,
                  state: room.state,
                  vectorClock: room.vectorClock
                };
                ws.send(JSON.stringify(response));
              }
              break;
            }

            default:
              console.warn('Unknown WebSocket payload format received.');
          }
        } catch (error) {
          console.error('WebSocket message parsing/processing error:', error);
        }
      });

      ws.on('close', () => {
        if (currentRoomId && currentClientId) {
          const room = activeRooms.get(currentRoomId);
          if (room) {
            room.sessions.delete(currentClientId);
            console.log(`Client [${currentClientId}] disconnected from Room [${currentRoomId}].`);
            
            // Clean up room if empty to conserve resource leaks
            if (room.sessions.size === 0) {
              activeRooms.delete(currentRoomId);
              console.log(`Room [${currentRoomId}] closed (no active subscribers remaining).`);
            }
          }
        }
      });
    });
  }

  /**
   * Retrieves active room metadata, useful for telemetry / integration checks.
   */
  public getRoomDetails(proposalId: string) {
    const room = activeRooms.get(proposalId);
    if (!room) return null;
    return {
      proposalId: room.proposalId,
      sessionCount: room.sessions.size,
      vectorClock: { ...room.vectorClock }
    };
  }
}
