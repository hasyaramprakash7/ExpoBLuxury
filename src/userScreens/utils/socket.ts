// src/userScreens/utils/socket.ts
import { io, Socket } from "socket.io-client";
import appConfig from "../../config/config";

const SOCKET_BASE_URL = appConfig.apiUrl.replace("/api", "");

let socket: Socket = io(SOCKET_BASE_URL, {
  autoConnect: true,
  // React Native needs polling first, then upgrades to websocket.
  transports: ["polling", "websocket"],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 2000,
  timeout: 10000,
  forceNew: true,
});

let isConnected = false;
let currentUserId: string | null = null;
let currentGroupIds: string[] = [];

// ──────────────────────────────────────────────
// Core lifecycle listeners
// ──────────────────────────────────────────────
const attachCoreListeners = (s: Socket) => {
  if (!s || typeof s.on !== "function") return;

  s.on("connect", () => {
    console.log("🚀 [Socket] Connected to server:", s.id);
    isConnected = true;

    if (currentUserId) {
      console.log(`🔄 [Socket] Re-joining rooms for user: ${currentUserId}`);
      try {
        s.emit("join", { userId: currentUserId, groupIds: currentGroupIds });
      } catch (e) {
        console.warn("[Socket] re-join emit failed:", e);
      }
    }
  });

  s.on("disconnect", (reason) => {
    console.log("🔌 [Socket] Disconnected:", reason);
    isConnected = false;
  });

  s.on("connect_error", (error: any) => {
    console.error("❌ [Socket] Connection Error:", error?.message || error);
  });
};

attachCoreListeners(socket);

// ==========================================
// 🔥 USER ROOM MANAGEMENT
// ==========================================
export const connectUserToSocket = (
  userId: string,
  groupIds: string[] = []
): void => {
  try {
    if (!userId) {
      console.warn("⚠️ [Socket] connectUserToSocket: userId is required");
      return;
    }

    currentUserId = userId;
    currentGroupIds = groupIds;

    if (socket && socket.connected) {
      console.log(`👤 [Socket] User ${userId} joining rooms...`);
      try {
        socket.emit("join", { userId, groupIds });
      } catch (e) {
        console.warn("[Socket] join emit failed:", e);
      }
    } else {
      console.log(`⏳ [Socket] Socket not connected, will join when connected...`);
    }
  } catch (e) {
    console.warn("[Socket] connectUserToSocket failed:", e);
  }
};

export const joinGroupRoom = (groupId: string): void => {
  try {
    if (!groupId) {
      console.warn("⚠️ [Socket] joinGroupRoom: groupId is required");
      return;
    }
    if (socket && socket.connected) {
      console.log(`📢 [Socket] Joining group room: ${groupId}`);
      socket.emit("joinGroup", groupId);
    }
  } catch (e) {
    console.warn("[Socket] joinGroupRoom failed:", e);
  }
};

export const leaveGroupRoom = (groupId: string): void => {
  try {
    if (!groupId) {
      console.warn("⚠️ [Socket] leaveGroupRoom: groupId is required");
      return;
    }
    if (socket && socket.connected) {
      console.log(`👋 [Socket] Leaving group room: ${groupId}`);
      socket.emit("leaveGroup", groupId);
    }
  } catch (e) {
    console.warn("[Socket] leaveGroupRoom failed:", e);
  }
};

export const disconnectUserFromSocket = (userId: string): void => {
  try {
    if (!userId) {
      console.warn("⚠️ [Socket] disconnectUserFromSocket: userId is required");
      return;
    }

    currentUserId = null;
    currentGroupIds = [];

    if (socket && socket.connected && typeof socket.emit === "function") {
      console.log(`🚪 [Socket] Disconnecting user: ${userId}`);
      socket.emit("leave", userId);
    }
  } catch (e) {
    // Do NOT rethrow — cleanup must never crash the app
    console.warn("[Socket] disconnectUserFromSocket failed:", e);
  }
};

// ═══════════════════════════════════════════════════════════════
// 🧹 cleanupSocket — exported so useSocket.ts and App.tsx can use it
// ═══════════════════════════════════════════════════════════════
export const cleanupSocket = (): void => {
  try {
    if (!socket) return;

    try {
      if (typeof (socket as any).removeAllListeners === "function") {
        (socket as any).removeAllListeners();
      }
    } catch (e) {
      console.warn("[Socket] removeAllListeners failed:", e);
    }

    try {
      if (typeof socket.disconnect === "function") {
        socket.disconnect();
      }
    } catch (e) {
      console.warn("[Socket] disconnect failed:", e);
    }
  } catch (e) {
    console.warn("[Socket] cleanupSocket failed:", e);
  } finally {
    isConnected = false;
    currentUserId = null;
    currentGroupIds = [];
  }
};

// ==========================================
// 📡 SOCKET EVENT LISTENERS (safe wrappers)
// ==========================================
const safeOn = (
  event: string,
  callback: (data: any) => void
): (() => void) => {
  try {
    if (socket && typeof socket.on === "function") {
      socket.on(event, callback);
      return () => {
        try {
          if (socket && typeof socket.off === "function") {
            socket.off(event, callback);
          }
        } catch {}
      };
    }
  } catch (e) {
    console.warn(`[Socket] on(${event}) failed:`, e);
  }
  return () => {};
};

export const onNewLead = (callback: (data: any) => void) =>
  safeOn("newLead", callback);

export const onNewView = (callback: (data: any) => void) =>
  safeOn("newView", callback);

export const onLeadUpdated = (callback: (data: any) => void) =>
  safeOn("leadUpdated", callback);

export const onLeadsBulkUpdated = (callback: (data: any) => void) =>
  safeOn("leadsBulkUpdated", callback);

export const onNewOrder = (callback: (data: any) => void) =>
  safeOn("newOrder", callback);

export const onOrderUpdated = (callback: (data: any) => void) =>
  safeOn("orderUpdated", callback);

export const onNewMessage = (callback: (data: any) => void) =>
  safeOn("newMessage", callback);

export const onNotification = (callback: (data: any) => void) =>
  safeOn("notification", callback);

// ==========================================
// 🔌 SOCKET UTILITY FUNCTIONS
// ==========================================
export const isSocketConnected = (): boolean =>
  !!(socket && socket.connected);

export const getSocketId = (): string | undefined =>
  socket ? socket.id : undefined;

export const reconnectSocket = (): void => {
  try {
    console.log("🔄 [Socket] Manually reconnecting...");
    if (!socket) return;
    if (socket.disconnected) {
      socket.connect();
    } else {
      socket.disconnect();
      setTimeout(() => {
        try {
          socket.connect();
        } catch {}
      }, 500);
    }
  } catch (e) {
    console.warn("[Socket] reconnectSocket failed:", e);
  }
};

export const disconnectSocket = (): void => {
  try {
    console.log("🔌 [Socket] Manually disconnecting...");
    if (socket && typeof socket.disconnect === "function") {
      socket.disconnect();
    }
  } catch (e) {
    console.warn("[Socket] disconnectSocket failed:", e);
  }
};

export default socket;