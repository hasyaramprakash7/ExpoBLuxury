import { io, Socket } from "socket.io-client";
import appConfig from "../config/config"; 

const SOCKET_BASE_URL = appConfig.apiUrl.replace("/api", "");

const socket: Socket = io(SOCKET_BASE_URL, {
  autoConnect: true, 
  transports: ["websocket"],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 2000,
});

socket.on("connect", () => {
  console.log("🚀 [Socket] Connected to server:", socket.id);
});

socket.on("disconnect", (reason) => {
  console.log("🔌 [Socket] Disconnected:", reason);
});

socket.on("connect_error", (error) => {
  console.error("❌ [Socket] Connection Error:", error.message);
});

// ==========================================
// 🔥 EXPORT THESE EXACTLY LIKE THIS
// ==========================================
export const connectUserToSocket = (userId: string, groupIds: string[] = []) => {
  if (!userId) return;
  socket.emit("join", { userId, groupIds });
};

export const joinGroupRoom = (groupId: string) => {
  if (!groupId) return;
  socket.emit("joinGroup", groupId);
};

export const leaveGroupRoom = (groupId: string) => {
  if (!groupId) return;
  socket.emit("leaveGroup", groupId);
};

export const disconnectUserFromSocket = (userId: string) => {
  if (!userId) return;
  socket.emit("leave", userId);
};

// Must be at the very bottom!
export default socket;