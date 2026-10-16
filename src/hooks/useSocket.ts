// src/hooks/useSocket.ts
import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSelector } from 'react-redux';
import { Platform } from 'react-native';
import { RootState } from '../store';
import config from '../config/config';

// ─────────────────────────────────────────────────────────────
// RESOLVE SOCKET URL FROM config.apiUrl
// ─────────────────────────────────────────────────────────────
const deriveSocketUrl = (apiUrl: string): string => {
  try {
    const u = new URL(apiUrl);
    let host = u.host;
    if (
      Platform.OS === 'android' &&
      (u.hostname === 'localhost' || u.hostname === '127.0.0.1')
    ) {
      host = `10.0.2.2${u.port ? ':' + u.port : ''}`;
    }
    return `${u.protocol}//${host}`;
  } catch {
    return String(apiUrl || '').replace(/\/api\/?$/, '');
  }
};

const SOCKET_URL = deriveSocketUrl(config.apiUrl);
console.log('🔌 Socket URL resolved to:', SOCKET_URL);

type Listener = (...args: any[]) => void;

// ─────────────────────────────────────────────────────────────
// MODULE-LEVEL SINGLETON
// ─────────────────────────────────────────────────────────────
let globalSocket: Socket | null = null;
let globalConnectPromise: Promise<Socket> | null = null;
let globalJoinedRoom = '';
let globalIsConnected = false;

// Subscribers for connection state changes
const connectedSubs = new Set<(v: boolean) => void>();
// Subscribers for online-users set
const onlineUsersSubs = new Set<(ids: Set<string>) => void>();

let globalOnlineUsers = new Set<string>();

const notifyConnected = (v: boolean) => {
  globalIsConnected = v;
  connectedSubs.forEach((cb) => { try { cb(v); } catch {} });
};

const notifyOnlineUsers = () => {
  onlineUsersSubs.forEach((cb) => { try { cb(new Set(globalOnlineUsers)); } catch {} });
};

// ─────────────────────────────────────────────────────────────
// FOLLOW EVENT BUS
// ─────────────────────────────────────────────────────────────
// Screens (AdListScreen, NotificationsScreen, UserProfileModal host, etc.)
// subscribe here to reload followers/following when the server tells us
// somebody followed/unfollowed.
export type FollowEvent =
  | { type: 'follow'; targetUserId: string; actorId?: string; actorName?: string }
  | { type: 'unfollow'; targetUserId: string; actorId?: string; actorName?: string }
  | { type: 'newFollower'; targetUserId: string; actorId?: string; actorName?: string }
  | { type: 'followNotification'; targetUserId: string; actorId?: string; actorName?: string }
  | { type: 'unfollowNotification'; targetUserId: string; actorId?: string; actorName?: string };

const followSubs = new Set<(e: FollowEvent) => void>();

const notifyFollow = (e: FollowEvent) => {
  followSubs.forEach((cb) => { try { cb(e); } catch {} });
};

export const subscribeFollowEvents = (cb: (e: FollowEvent) => void) => {
  followSubs.add(cb);
  return () => { followSubs.delete(cb); };
};

// Also expose a lightweight counter so consumers can react to *any* change
// even if they miss the event payload.
let followRevision = 0;
const revisionSubs = new Set<(rev: number) => void>();

export const getFollowRevision = () => followRevision;
export const subscribeFollowRevision = (cb: (rev: number) => void) => {
  revisionSubs.add(cb);
  cb(followRevision);
  return () => { revisionSubs.delete(cb); };
};

const bumpFollowRevision = () => {
  followRevision += 1;
  revisionSubs.forEach((cb) => { try { cb(followRevision); } catch {} });
};

// ─────────────────────────────────────────────────────────────
// SOCKET SINGLETON
// ─────────────────────────────────────────────────────────────
const ensureSocket = async (): Promise<Socket> => {
  if (globalSocket) return globalSocket;
  if (globalConnectPromise) return globalConnectPromise;

  globalConnectPromise = (async () => {
    const userToken = await AsyncStorage.getItem('userToken');
    const vendorToken = await AsyncStorage.getItem('vendorToken');
    const token = userToken || vendorToken;

    console.log('🔌 [global] Connecting to socket at:', SOCKET_URL);

    const socket = io(SOCKET_URL, {
      transports: ['polling', 'websocket'],
      path: '/socket.io',
      auth: token ? { token } : undefined,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1500,
      reconnectionDelayMax: 8000,
      timeout: 20000,
      forceNew: true,
      autoConnect: true,
      upgrade: true,
      rememberUpgrade: false,
    });

    globalSocket = socket;

    socket.on('connect', () => {
      console.log(
        '✅ [global] Socket connected:',
        socket.id,
        '| transport:',
        socket.io?.engine?.transport?.name
      );
      notifyConnected(true);
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ [global] Socket disconnected:', reason);
      notifyConnected(false);
      if (reason === 'io server disconnect') {
        try { socket.connect(); } catch {}
      }
    });

    socket.on('connect_error', (err: any) => {
      console.warn('⚠️ [global] Socket connect_error:', err?.message);
    });

    socket.io?.on?.('upgrade', (t: any) => console.log('⬆️ [global] Upgraded to:', t?.name));

    // ── Global online-users listeners (SINGLETON, so no duplicates) ──
    socket.on('onlineUsers', (payload: any) => {
      const arr = Array.isArray(payload) ? payload : [];
      globalOnlineUsers = new Set(arr.map(String));
      notifyOnlineUsers();
    });

    socket.on('userOnline', (data: any) => {
      if (!data?.userId) return;
      globalOnlineUsers.add(String(data.userId));
      notifyOnlineUsers();
    });

    socket.on('userOffline', (data: any) => {
      if (!data?.userId) return;
      globalOnlineUsers.delete(String(data.userId));
      notifyOnlineUsers();
    });

    // ── Global follow listeners: fire the follow event bus + bump revision ──
    const handleFollowish = (rawType: FollowEvent['type']) => (payload: any) => {
      const targetUserId = String(
        payload?.targetUserId ||
        payload?.userId ||
        payload?.followingId ||
        payload?.followedId ||
        payload?.toUserId ||
        ''
      );
      const actorId = String(
        payload?.actorId || payload?.followerId || payload?.fromUserId || ''
      );
      const actorName = payload?.actorName || payload?.followerName || '';
      if (!targetUserId && !actorId) return;

      const evt: FollowEvent = {
        type: rawType,
        targetUserId: targetUserId || actorId,
        actorId: actorId || undefined,
        actorName: actorName || undefined,
      };
      notifyFollow(evt);
      bumpFollowRevision();
    };

    socket.on('follow',              handleFollowish('follow'));
    socket.on('unfollow',            handleFollowish('unfollow'));
    socket.on('newFollower',         handleFollowish('newFollower'));
    socket.on('followNotification',  handleFollowish('followNotification'));
    socket.on('unfollowNotification', handleFollowish('unfollowNotification'));

    return socket;
  })();

  return globalConnectPromise;
};

// Call this on logout
export const disconnectSocket = () => {
  if (globalJoinedRoom && globalSocket) {
    try { globalSocket.emit('setOffline', globalJoinedRoom); } catch {}
    try { globalSocket.emit('leaveUserRoom', globalJoinedRoom); } catch {}
    globalJoinedRoom = '';
  }
  if (globalSocket) {
    try { globalSocket.removeAllListeners(); globalSocket.disconnect(); } catch {}
    globalSocket = null;
  }
  globalConnectPromise = null;
  globalOnlineUsers = new Set();
  notifyConnected(false);
  notifyOnlineUsers();
};

// ─────────────────────────────────────────────────────────────
// PUBLIC INTERFACE
// ─────────────────────────────────────────────────────────────
export interface UseSocketReturn {
  isConnected: boolean;
  socket: Socket | null;

  joinUserRoom: (userId: string) => void;
  leaveUserRoom: (userId: string) => void;
  joinConversation: (conversationId: string) => void;
  leaveConversation: (conversationId: string) => void;
  joinGroup: (groupId: string) => void;
  leaveGroup: (groupId: string) => void;
  joinPostRoom: (postId: string) => void;
  leavePostRoom: (postId: string) => void;

  emitTyping: (data: any) => void;
  emitStopTyping: (data: any) => void;
  emitMessageRead: (data: any) => void;
  emitMessagesRead: (data: any) => void;
  emitSetOnline: (userId: string) => void;
  emitSetOffline: (userId: string) => void;
  checkOnline: (userIds: string[], cb?: (s: Record<string, boolean>) => void) => void;
  emitNewComment: (data: any) => void;
  emitNewLike: (data: any) => void;
  emitUnlike: (data: any) => void;
  emitNewFollow: (data: any) => void;
  emitUnfollow: (data: any) => void;
  emitStoryViewed: (data: any) => void;
  emitStoryReaction: (data: any) => void;
  emitPostViewed: (data: any) => void;

  onNewMessage: (cb: Listener) => () => void;
  onUserTyping: (cb: Listener) => () => void;
  onUserStoppedTyping: (cb: Listener) => () => void;
  onMessageReadReceipt: (cb: Listener) => () => void;
  onMessagesReadReceipt: (cb: Listener) => () => void;
  onUserOnline: (cb: Listener) => () => void;
  onUserOffline: (cb: Listener) => () => void;
  onOnlineUsers: (cb: (ids: string[]) => void) => () => void;
  onNewPost: (cb: Listener) => () => void;
  onPostLiked: (cb: Listener) => () => void;
  onPostSaved: (cb: Listener) => () => void;
  onCommentAdded: (cb: Listener) => () => void;
  onNewComment: (cb: Listener) => () => void;
  onCommentNotification: (cb: Listener) => () => void;
  onLikeNotification: (cb: Listener) => () => void;
  onFollowNotification: (cb: Listener) => () => void;
  onUnfollowNotification: (cb: Listener) => () => void;
  onNewFollower: (cb: Listener) => () => void;
  onNewNotification: (cb: Listener) => () => void;
  onCommentDeleted: (cb: Listener) => () => void;
  onNewStory: (cb: Listener) => () => void;
  onStoryViewNotification: (cb: Listener) => () => void;
  onStoryReactionNotification: (cb: Listener) => () => void;
  onPostViewCount: (cb: Listener) => () => void;

  // Extra helpers
  getOnlineUsers: () => Set<string>;
  onFollowEvent: (cb: (e: FollowEvent) => void) => () => void;
  onFollowRevision: (cb: (rev: number) => void) => () => void;
}

export const useSocket = (): UseSocketReturn => {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(globalIsConnected);
  const user = useSelector((s: RootState) => s.auth.user);
  const userId = (user as any)?._id || (user as any)?.id || '';
  const userIdRef = useRef<string>('');
  const joinedRef = useRef<string>('');

  useEffect(() => { userIdRef.current = userId || ''; }, [userId]);

  // ── Ensure singleton socket exists ──
  useEffect(() => {
    let alive = true;

    (async () => {
      const s = await ensureSocket();
      if (!alive) return;
      socketRef.current = s;
      setIsConnected(s.connected);
    })();

    const onConn = (v: boolean) => { if (alive) setIsConnected(v); };
    connectedSubs.add(onConn);
    return () => { alive = false; connectedSubs.delete(onConn); };
  }, []);

  // ── Join personal room when socket is ready + userId available ──
  useEffect(() => {
    let alive = true;
    (async () => {
      const s = await ensureSocket();
      if (!alive || !userId) return;
      if (joinedRef.current === userId) return;
      if (joinedRef.current) {
        try { s.emit('leaveUserRoom', joinedRef.current); } catch {}
      }
      s.emit('joinUserRoom', userId);
      s.emit('setOnline', userId);
      joinedRef.current = userId;
      globalJoinedRoom = userId;
      console.log('👤 [global] Joined personal room:', userId);
    })();

    // Re-join on reconnect
    const s = socketRef.current;
    const onConn = async (v: boolean) => {
      if (!v) return;
      const sock = socketRef.current || (await ensureSocket());
      const uid = userIdRef.current;
      if (!uid) return;
      try { sock.emit('joinUserRoom', uid); sock.emit('setOnline', uid); } catch {}
      joinedRef.current = uid;
      globalJoinedRoom = uid;
    };
    connectedSubs.add(onConn);
    return () => { alive = false; connectedSubs.delete(onConn); };
  }, [userId]);

  // ── HELPERS ──
  const on = useCallback((event: string, cb: Listener) => {
    const s = socketRef.current || globalSocket;
    if (!s) return () => {};
    s.on(event, cb);
    return () => { try { s.off(event, cb); } catch {} };
  }, []);

  const emit = useCallback((event: string, ...args: any[]) => {
    const s = socketRef.current || globalSocket;
    if (!s || !s.connected) return;
    try { s.emit(event, ...args); } catch (e) { console.warn('emit failed', event, e); }
  }, []);

  // ── ROOM MANAGEMENT ──
  const joinUserRoom = useCallback((uid: string) => emit('joinUserRoom', uid), [emit]);
  const leaveUserRoom = useCallback((uid: string) => emit('leaveUserRoom', uid), [emit]);
  const joinConversation = useCallback((cid: string) => emit('joinConversation', cid), [emit]);
  const leaveConversation = useCallback((cid: string) => emit('leaveConversation', cid), [emit]);
  const joinGroup = useCallback((gid: string) => emit('joinGroup', gid), [emit]);
  const leaveGroup = useCallback((gid: string) => emit('leaveGroup', gid), [emit]);
  const joinPostRoom = useCallback((pid: string) => emit('joinPostRoom', pid), [emit]);
  const leavePostRoom = useCallback((pid: string) => emit('leavePostRoom', pid), [emit]);

  // ── EMITTERS ──
  const emitTyping = useCallback((d: any) => emit('typing', d), [emit]);
  const emitStopTyping = useCallback((d: any) => emit('stopTyping', d), [emit]);
  const emitMessageRead = useCallback((d: any) => emit('messageRead', d), [emit]);
  const emitMessagesRead = useCallback((d: any) => emit('messagesRead', d), [emit]);
  const emitSetOnline = useCallback((uid: string) => emit('setOnline', uid), [emit]);
  const emitSetOffline = useCallback((uid: string) => emit('setOffline', uid), [emit]);

  const checkOnline = useCallback(
    (userIds: string[], cb?: (s: Record<string, boolean>) => void) => {
      const s = socketRef.current || globalSocket;
      if (!s || !s.connected) { cb && cb({}); return; }
      if (cb) s.emit('checkOnline', userIds, cb);
      else s.emit('checkOnline', userIds);
    },
    []
  );

  const emitNewComment = useCallback((d: any) => emit('newComment', d), [emit]);
  const emitNewLike = useCallback((d: any) => emit('newLike', d), [emit]);
  const emitUnlike = useCallback((d: any) => emit('unlike', d), [emit]);
  const emitNewFollow = useCallback((d: any) => emit('newFollow', d), [emit]);
  const emitUnfollow = useCallback((d: any) => emit('unfollow', d), [emit]);
  const emitStoryViewed = useCallback((d: any) => emit('storyViewed', d), [emit]);
  const emitStoryReaction = useCallback((d: any) => emit('storyReaction', d), [emit]);
  const emitPostViewed = useCallback((d: any) => emit('postViewed', d), [emit]);

  // ── LISTENERS ──
  const onNewMessage = useCallback((cb: Listener) => on('newMessage', cb), [on]);
  const onUserTyping = useCallback((cb: Listener) => on('userTyping', cb), [on]);
  const onUserStoppedTyping = useCallback((cb: Listener) => on('userStoppedTyping', cb), [on]);
  const onMessageReadReceipt = useCallback((cb: Listener) => on('messageReadReceipt', cb), [on]);
  const onMessagesReadReceipt = useCallback((cb: Listener) => on('messagesReadReceipt', cb), [on]);

  const onUserOnline = useCallback((cb: Listener) => {
    const s = socketRef.current || globalSocket;
    if (!s) return () => {};
    s.on('userOnline', cb);
    return () => { try { s.off('userOnline', cb); } catch {} };
  }, []);

  const onUserOffline = useCallback((cb: Listener) => {
    const s = socketRef.current || globalSocket;
    if (!s) return () => {};
    s.on('userOffline', cb);
    return () => { try { s.off('userOffline', cb); } catch {} };
  }, []);

  const onOnlineUsers = useCallback((cb: (ids: string[]) => void) => {
    const s = socketRef.current || globalSocket;
    if (!s) return () => {};
    const wrapped = (payload: any) => {
      const arr = Array.isArray(payload) ? payload : [];
      cb(arr.map(String));
    };
    s.on('onlineUsers', wrapped);
    return () => { try { s.off('onlineUsers', wrapped); } catch {} };
  }, []);

  const onNewPost = useCallback((cb: Listener) => on('newPost', cb), [on]);
  const onPostLiked = useCallback((cb: Listener) => on('postLiked', cb), [on]);
  const onPostSaved = useCallback((cb: Listener) => on('postSaved', cb), [on]);
  const onCommentAdded = useCallback((cb: Listener) => on('commentAdded', cb), [on]);
  const onNewComment = useCallback((cb: Listener) => on('newComment', cb), [on]);
  const onCommentNotification = useCallback((cb: Listener) => on('commentNotification', cb), [on]);
  const onLikeNotification = useCallback((cb: Listener) => on('likeNotification', cb), [on]);
  const onFollowNotification = useCallback((cb: Listener) => on('followNotification', cb), [on]);
  const onUnfollowNotification = useCallback((cb: Listener) => on('unfollowNotification', cb), [on]);
  const onNewFollower = useCallback((cb: Listener) => on('newFollower', cb), [on]);
  const onNewNotification = useCallback((cb: Listener) => on('newNotification', cb), [on]);
  const onCommentDeleted = useCallback((cb: Listener) => on('commentDeleted', cb), [on]);
  const onNewStory = useCallback((cb: Listener) => on('newStory', cb), [on]);
  const onStoryViewNotification = useCallback((cb: Listener) => on('storyViewNotification', cb), [on]);
  const onStoryReactionNotification = useCallback((cb: Listener) => on('storyReactionNotification', cb), [on]);
  const onPostViewCount = useCallback((cb: Listener) => on('postViewCount', cb), [on]);

  const getOnlineUsers = useCallback(() => new Set(globalOnlineUsers), []);

  // ── FOLLOW SUBSCRIPTIONS ──
  const onFollowEvent = useCallback((cb: (e: FollowEvent) => void) => {
    return subscribeFollowEvents(cb);
  }, []);

  const onFollowRevision = useCallback((cb: (rev: number) => void) => {
    return subscribeFollowRevision(cb);
  }, []);

  return {
    isConnected,
    socket: socketRef.current || globalSocket,
    joinUserRoom, leaveUserRoom,
    joinConversation, leaveConversation,
    joinGroup, leaveGroup,
    joinPostRoom, leavePostRoom,
    emitTyping, emitStopTyping,
    emitMessageRead, emitMessagesRead,
    emitSetOnline, emitSetOffline,
    checkOnline,
    emitNewComment, emitNewLike, emitUnlike,
    emitNewFollow, emitUnfollow,
    emitStoryViewed, emitStoryReaction, emitPostViewed,
    onNewMessage, onUserTyping, onUserStoppedTyping,
    onMessageReadReceipt, onMessagesReadReceipt,
    onUserOnline, onUserOffline, onOnlineUsers,
    onNewPost, onPostLiked, onPostSaved,
    onCommentAdded, onNewComment, onCommentNotification,
    onLikeNotification, onFollowNotification, onUnfollowNotification,
    onNewFollower, onNewNotification, onCommentDeleted,
    onNewStory, onStoryViewNotification, onStoryReactionNotification,
    onPostViewCount,
    getOnlineUsers,
    onFollowEvent,
    onFollowRevision,
  };
};

// ─────────────────────────────────────────────────────────────
// MODULE-LEVEL HELPERS (no hook needed)
// ─────────────────────────────────────────────────────────────
export const subscribeOnlineUsers = (cb: (ids: Set<string>) => void) => {
  onlineUsersSubs.add(cb);
  cb(new Set(globalOnlineUsers));
  return () => { onlineUsersSubs.delete(cb); };
};

export default useSocket;