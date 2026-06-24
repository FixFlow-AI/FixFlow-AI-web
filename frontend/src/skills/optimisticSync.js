import { useEffect, useState, useRef, useCallback } from "react";

/**
 * Helper function to retrieve a nested object property by dot-separated path.
 */
export function getNestedProperty(obj, path) {
  if (!obj) return undefined;
  const parts = path.split(".");
  let current = obj;
  for (const part of parts) {
    if (current === null || typeof current !== "object") return undefined;
    current = current[part];
  }
  return current;
}

/**
 * Helper function to set a nested object property by dot-separated path.
 */
export function setNestedProperty(obj, path, value) {
  const parts = path.split(".");
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const nextPart = parts[i + 1];
    const isNextNumeric = !isNaN(Number(nextPart));

    if (
      !(part in current) ||
      current[part] === null ||
      typeof current[part] !== "object"
    ) {
      current[part] = isNextNumeric ? [] : {};
    }
    current = current[part];
  }

  const lastPart = parts[parts.length - 1];
  current[lastPart] = value;
}

/**
 * OptimisticSyncCoordinator handles local state management, causal vector clocks,
 * and optimistic WebSocket broadcasts.
 */
export class OptimisticSyncCoordinator {
  ws = null;
  state = {};
  vectorClock = {};
  onStateChange = null;

  constructor(proposalId, clientId, role) {
    this.proposalId = proposalId;
    this.clientId = clientId;
    this.role = role;
    this.vectorClock[this.clientId] = 0;
  }

  /**
   * Initializes WebSocket connection to the sync server.
   */
  connect(wsUrl) {
    if (this.ws) {
      this.ws.close();
    }

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log(`WebSocket connected. Joining room [${this.proposalId}]...`);
      this.sendJoinMessage();
    };

    this.ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        this.handleServerMessage(payload);
      } catch (error) {
        console.error("Failed to process incoming WebSocket frame:", error);
      }
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket synchronization channel error:", error);
    };

    this.ws.onclose = () => {
      console.warn("WebSocket synchronization channel closed.");
    };
  }

  /**
   * Registers a callback that fires whenever the state shifts (optimistically or from server).
   */
  registerStateChangeListener(callback) {
    this.onStateChange = callback;
  }

  /**
   * Retrieves the current in-memory UI proposal state.
   */
  getState() {
    return JSON.parse(JSON.stringify(this.state));
  }

  /**
   * Retrieves the current client vector clock state.
   */
  getVectorClock() {
    return { ...this.vectorClock };
  }

  /**
   * Applies a mutation locally (optimistic UI render) and dispatches it immediately to the server.
   */
  mutate(field, value) {
    // 1. Optimistic Update (Immediate Local App)
    setNestedProperty(this.state, field, value);

    // 2. Increment Local Vector Clock
    this.vectorClock[this.clientId] =
      (this.vectorClock[this.clientId] ?? 0) + 1;

    // 3. Fire local state update listeners for immediate rendering
    if (this.onStateChange) {
      this.onStateChange(this.getState(), this.getVectorClock());
    }

    // 4. Send mutation message to sync server
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const mutationMsg = {
        type: "mutation",
        proposalId: this.proposalId,
        clientId: this.clientId,
        field,
        value,
        vectorClock: this.getVectorClock(),
        timestamp: Date.now(),
      };
      this.ws.send(JSON.stringify(mutationMsg));
    } else {
      console.warn(
        "Mutation applied locally, but WebSocket is offline. Will sync upon reconnection.",
      );
    }
  }

  /**
   * Disconnects the sync channel socket.
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  // ==========================================
  // Internals & Frame Handlers
  // ==========================================

  sendJoinMessage() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const joinMsg = {
        type: "join",
        proposalId: this.proposalId,
        clientId: this.clientId,
        role: this.role,
        vectorClock: this.getVectorClock(),
      };
      this.ws.send(JSON.stringify(joinMsg));
    }
  }

  handleServerMessage(payload) {
    switch (payload.type) {
      case "sync_response": {
        const { state, vectorClock } = payload;
        // Update local state directly with authoritative server state
        this.state = state;
        // Merge Clocks
        this.mergeClocks(vectorClock);

        if (this.onStateChange) {
          this.onStateChange(this.getState(), this.getVectorClock());
        }
        console.log("Synchronized proposal state with server.");
        break;
      }

      case "mutation_broadcast": {
        const { clientId, field, value, vectorClock } = payload;
        // Apply remote mutation to our local state
        setNestedProperty(this.state, field, value);
        // Merge Clocks
        this.mergeClocks(vectorClock);

        if (this.onStateChange) {
          this.onStateChange(this.getState(), this.getVectorClock());
        }
        console.log(
          `Received mutation for [${field}] from Client [${clientId}].`,
        );
        break;
      }

      case "ack": {
        const { vectorClock } = payload;
        // Merge acknowledging clock from server
        this.mergeClocks(vectorClock);
        console.log("Mutation acknowledged by server.");
        break;
      }

      default:
        console.warn("Unknown server message type:", payload.type);
    }
  }

  mergeClocks(serverClock) {
    const allClients = new Set([
      ...Object.keys(this.vectorClock),
      ...Object.keys(serverClock),
    ]);
    for (const client of allClients) {
      const localVal = this.vectorClock[client] ?? 0;
      const serverVal = serverClock[client] ?? 0;
      this.vectorClock[client] = Math.max(localVal, serverVal);
    }
  }
}

// ==========================================
// React Integration Hook
// ==========================================

/**
 * A custom React hook to integrate the OptimisticSyncCoordinator with React components.
 * Automatically handles connecting, disconnecting, and updating local React state on changes.
 */
export function useOptimisticSync(
  wsUrl,
  proposalId,
  clientId,
  role,
  initialState = {},
) {
  const [state, setState] = useState(initialState);
  const [clocks, setClocks] = useState({});
  const [isConnected, setIsConnected] = useState(false);
  const coordinatorRef = useRef(null);

  useEffect(() => {
    // 1. Instantiate Coordinator
    const coordinator = new OptimisticSyncCoordinator(
      proposalId,
      clientId,
      role,
    );
    coordinatorRef.current = coordinator;

    // 2. Register listeners
    coordinator.registerStateChangeListener((updatedState, updatedClocks) => {
      setState(updatedState);
      setClocks(updatedClocks);
    });

    // 3. Connect to WebSocket
    coordinator.connect(wsUrl);
    setIsConnected(true);

    // 4. Cleanup on unmount or arg changes
    return () => {
      coordinator.disconnect();
      coordinatorRef.current = null;
      setIsConnected(false);
    };
  }, [wsUrl, proposalId, clientId, role]);

  // Stable mutator function wrapper
  const mutate = useCallback((field, value) => {
    if (coordinatorRef.current) {
      coordinatorRef.current.mutate(field, value);
    } else {
      console.warn("Cannot mutate state: sync coordinator is not initialized.");
    }
  }, []);

  return {
    state,
    clocks,
    isConnected,
    mutate,
    coordinator: coordinatorRef.current,
  };
}
