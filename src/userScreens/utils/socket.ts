// src/userScreens/utils/socket.ts
import { io, Socket } from "socket.io-client";
import appConfig from "../../config/config";

const SOCKET_BASE_URL = appConfig.apiUrl.replace("/api", "");

const socket: Socket = io(SOCKET_BASE_URL, {
  autoConnect: true,
  // 🔥 CRITICAL FIX: Add "polling" first. 
  // React Native uses polling for the initial handshake, then upgrades to websocket.
  transports: ["polling", "websocket"], 
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 2000,
  timeout: 10000,
  forceNew: true,
});

// Track if we're already connected to avoid duplicate joins
let isConnected = false;
let currentUserId: string | null = null;
let currentGroupIds: string[] = [];

socket.on("connect", () => {
  console.log("🚀 [Socket] Connected to server:", socket.id);
  isConnected = true;
  
  // Re-join rooms if we had a previous user ID
  if (currentUserId) {
    console.log(`🔄 [Socket] Re-joining rooms for user: ${currentUserId}`);
    socket.emit("join", { userId: currentUserId, groupIds: currentGroupIds });
  }
});

socket.on("disconnect", (reason) => {
  console.log("🔌 [Socket] Disconnected:", reason);
  isConnected = false;
});

socket.on("connect_error", (error) => {
  console.error("❌ [Socket] Connection Error:", error.message);
});

// ==========================================
// 🔥 USER ROOM MANAGEMENT
// ==========================================
export const connectUserToSocket = (userId: string, groupIds: string[] = []) => {
  if (!userId) {
    console.warn("⚠️ [Socket] connectUserToSocket: userId is required");
    return;
  }
  
  currentUserId = userId;
  currentGroupIds = groupIds;
  
  if (socket.connected) {
    console.log(`👤 [Socket] User ${userId} joining rooms...`);
    socket.emit("join", { userId, groupIds });
  } else {
    console.log(`⏳ [Socket] Socket not connected, will join when connected...`);
    // Socket will join on reconnect event
  }
};

export const joinGroupRoom = (groupId: string) => {
  if (!groupId) {
    console.warn("⚠️ [Socket] joinGroupRoom: groupId is required");
    return;
  }
  
  if (socket.connected) {
    console.log(`📢 [Socket] Joining group room: ${groupId}`);
    socket.emit("joinGroup", groupId);
  } else {
    console.warn(`⚠️ [Socket] Cannot join group ${groupId}, socket not connected`);
  }
};

export const leaveGroupRoom = (groupId: string) => {
  if (!groupId) {
    console.warn("⚠️ [Socket] leaveGroupRoom: groupId is required");
    return;
  }
  
  if (socket.connected) {
    console.log(`👋 [Socket] Leaving group room: ${groupId}`);
    socket.emit("leaveGroup", groupId);
  }
};

export const disconnectUserFromSocket = (userId: string) => {
  if (!userId) {
    console.warn("⚠️ [Socket] disconnectUserFromSocket: userId is required");
    return;
  }
  
  currentUserId = null;
  currentGroupIds = [];
  
  if (socket.connected) {
    console.log(`🚪 [Socket] Disconnecting user: ${userId}`);
    socket.emit("leave", userId);
  }
};

// ==========================================
// 📡 SOCKET EVENT LISTENERS
// ==========================================

// --- Lead Events ---
export const onNewLead = (callback: (data: any) => void) => {
  socket.on("newLead", callback);
  return () => socket.off("newLead", callback);
};

export const onNewView = (callback: (data: any) => void) => {
  socket.on("newView", callback);
  return () => socket.off("newView", callback);
};

export const onLeadUpdated = (callback: (data: any) => void) => {
  socket.on("leadUpdated", callback);
  return () => socket.off("leadUpdated", callback);
};

export const onLeadsBulkUpdated = (callback: (data: any) => void) => {
  socket.on("leadsBulkUpdated", callback);
  return () => socket.off("leadsBulkUpdated", callback);
};

// --- Order Events ---
export const onNewOrder = (callback: (data: any) => void) => {
  socket.on("newOrder", callback);
  return () => socket.off("newOrder", callback);
};

export const onOrderUpdated = (callback: (data: any) => void) => {
  socket.on("orderUpdated", callback);
  return () => socket.off("orderUpdated", callback);
};

// --- Message Events ---
export const onNewMessage = (callback: (data: any) => void) => {
  socket.on("newMessage", callback);
  return () => socket.off("newMessage", callback);
};

// --- General Events ---
export const onNotification = (callback: (data: any) => void) => {
  socket.on("notification", callback);
  return () => socket.off("notification", callback);
};

// ==========================================
// 🔌 SOCKET UTILITY FUNCTIONS
// ==========================================

export const isSocketConnected = () => socket.connected;

export const getSocketId = () => socket.id;

export const reconnectSocket = () => {
  console.log("🔄 [Socket] Manually reconnecting...");
  if (socket.disconnected) {
    socket.connect();
  } else {
    socket.disconnect();
    setTimeout(() => socket.connect(), 500);
  }
};

export const disconnectSocket = () => {
  console.log("🔌 [Socket] Manually disconnecting...");
  socket.disconnect();
};

// Must be at the very bottom!
export default socket;