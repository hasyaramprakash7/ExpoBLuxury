// src/hooks/useSocket.ts
import { useEffect, useRef, useState } from "react";
import socket, {
  connectUserToSocket,
  disconnectUserFromSocket,
  cleanupSocket,
  isSocketConnected,
} from "../userScreens/utils/socket";

// ──────────────────────────────────────────────
// Safe listener helper — returns an unsubscribe fn
// ──────────────────────────────────────────────
const safeListen = (
  event: string,
  handler: (...args: any[]) => void
): (() => void) => {
  try {
    if (!socket || typeof socket.on !== "function") return () => {};
    socket.on(event, handler);
    return () => {
      try {
        if (socket && typeof socket.off === "function") {
          socket.off(event, handler);
        }
      } catch {}
    };
  } catch (e) {
    console.warn(`[useSocket] listen(${event}) failed:`, e);
    return () => {};
  }
};

const safeEmit = (event: string, ...args: any[]): void => {
  try {
    if (!socket || typeof socket.emit !== "function") return;
    socket.emit(event, ...args);
  } catch (e) {
    console.warn(`[useSocket] emit(${event}) failed:`, e);
  }
};

export const useSocket = () => {
  const [isConnected, setIsConnected] = useState<boolean>(isSocketConnected());

  const cleanupsRef = useRef<Array<() => void>>([]);

  // Wire connect/disconnect to React state
  useEffect(() => {
    const offConnect = safeListen("connect", () => setIsConnected(true));
    const offDisconnect = safeListen("disconnect", () => setIsConnected(false));

    setIsConnected(isSocketConnected());

    return () => {
      try {
        offConnect();
      } catch {}
      try {
        offDisconnect();
      } catch {}
    };
  }, []);

  // Flush all tracked listeners on unmount
  useEffect(() => {
    return () => {
      cleanupsRef.current.forEach((off) => {
        try {
          if (typeof off === "function") off();
        } catch {}
      });
      cleanupsRef.current = [];
    };
  }, []);

  const track = (off: () => void) => {
    if (typeof off === "function") cleanupsRef.current.push(off);
  };

  const onUserOnline = (handler: (data: any) => void) => {
    const off = safeListen("user:online", handler);
    track(off);
    return off;
  };

  const onUserOffline = (handler: (data: any) => void) => {
    const off = safeListen("user:offline", handler);
    track(off);
    return off;
  };

  const onOnlineUsers = (handler: (ids: string[]) => void) => {
    const off = safeListen("users:online", handler);
    track(off);
    return off;
  };

  const onFollowRevision = (handler: (rev: number) => void) => {
    const off = safeListen("follow:revision", handler);
    track(off);
    return off;
  };

  const checkOnline = (
    ids: string[],
    cb: (status: Record<string, boolean>) => void
  ) => {
    if (!ids || ids.length === 0) {
      cb({});
      return;
    }
    try {
      safeEmit("users:check-online", ids, (status: Record<string, boolean>) => {
        cb(status || {});
      });
    } catch (e) {
      console.warn("[useSocket] checkOnline failed:", e);
      cb({});
    }
  };

  return {
    isConnected,
    onUserOnline,
    onUserOffline,
    onOnlineUsers,
    onFollowRevision,
    checkOnline,
    connectUserToSocket,
    disconnectUserFromSocket,
    cleanupSocket,
  };
};

// ──────────────────────────────────────────────
// Re-export so App.tsx's `import { cleanupSocket } from ".../useSocket"`
// continues to work.
// ──────────────────────────────────────────────
export { cleanupSocket };

export default useSocket;