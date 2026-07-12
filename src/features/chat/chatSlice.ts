import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import api from '../../userScreens/utils/api';

// ==========================================
// 🔥 INTERFACES
// ==========================================

export interface Reaction {
    userId: string;
    emoji: string;
    timestamp: string;
}

export interface Message {
    _id: string;
    sender: string;
    receiver?: string;
    senderModel: "User" | "Vendor" | "DeliveryBoy";
    receiverModel?: "User" | "Vendor" | "DeliveryBoy";
    content?: string;
    mediaUrl?: string;
    mediaPublicId?: string;
    messageType: "text" | "image" | "audio" | "video" | "product";
    timestamp: string;
    read: boolean;

    // Advanced Chat Features
    isGroupMessage?: boolean;
    group?: string;
    status?: 'sent' | 'delivered' | 'read';
    replyTo?: any;
    reactions?: Reaction[];
    isDeletedForEveryone?: boolean;
    deletedForMe?: string[];
}

export interface Contact {
    _id: string;
    name: string;
    profilePic?: string;
    shopName?: string;
    shopImage?: string; // Added to support vendor shop images
    role: "User" | "Vendor" | "DeliveryBoy" | "Group";
    email?: string;
    phone?: string;
}

export interface Conversation {
    _id: string;
    isGroup?: boolean;
    lastMessage: string;
    lastMessageType: string;
    timestamp: string;
    unreadCount: number;
    contact: Contact;
}

export interface Group {
    _id: string;
    name: string;
    description: string;
    avatarUrl?: string;
    admin: string | any;
    adminModel: string;
    members: { memberId: string | any, memberModel: string, joinedAt: string }[];
    createdAt: string;
}

export interface StatusItem {
    _id: string;
    author: string;
    authorModel: string;
    mediaUrl: string;
    messageType: "image" | "video";
    caption: string;
    viewers: { viewerId: string, viewerModel: string, viewedAt: string, details?: any }[];
    createdAt: string;
}

export interface StatusFeed {
    _id: string;
    authorModel: string;
    statuses: StatusItem[];
    authorDetails: any;
}

interface ChatState {
    activePartnerId: string | null;
    conversations: Conversation[];
    messages: Message[];
    groups: Group[];
    currentGroup: Group | null;

    // Status State
    statusFeed: StatusFeed[];
    myStatuses: StatusItem[];
    statusViewers: any[];

    loading: boolean;
    error: string | null;
    isSending: boolean;
}

const initialState: ChatState = {
    activePartnerId: null,
    conversations: [],
    messages: [],
    groups: [],
    currentGroup: null,
    statusFeed: [],
    myStatuses: [],
    statusViewers: [],
    loading: false,
    error: null,
    isSending: false,
};

// ==========================================
// 💬 CHAT THUNKS
// ==========================================

export const fetchChatList = createAsyncThunk("chat/fetchChatList", async (_, { rejectWithValue }) => {
    try {
        const res = await api.get("/chat/list/conversations");
        return res.data.chatList;
    } catch (err: any) {
        return rejectWithValue(err.response?.data?.message || "Failed to load chat list");
    }
});

export const fetchMessages = createAsyncThunk<Message[], string, { rejectValue: string }>("chat/fetchMessages", async (partnerId, { rejectWithValue }) => {
    try {
        const res = await api.get(`/chat/${partnerId}/messages`);
        return res.data.messages;
    } catch (err: any) {
        return rejectWithValue(err.response?.data?.message || "Failed to load history");
    }
});

export const fetchGroupMessages = createAsyncThunk<Message[], string, { rejectValue: string }>("chat/fetchGroupMessages", async (groupId, { rejectWithValue }) => {
    try {
        const res = await api.get(`/chat/group/${groupId}/messages`);
        return res.data.messages;
    } catch (err: any) {
        return rejectWithValue(err.response?.data?.message || "Failed to load group history");
    }
});

export const sendMessage = createAsyncThunk<Message, FormData, { rejectValue: string }>("chat/sendMessage", async (formData, { rejectWithValue }) => {
    try {
        const res = await api.post("/chat/send", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });
        return res.data.message;
    } catch (err: any) {
        return rejectWithValue(err.response?.data?.message || "Send failed");
    }
});

export const markMessagesAsRead = createAsyncThunk("chat/markAsRead", async (partnerId: string, { rejectWithValue }) => {
    try {
        await api.put(`/chat/read-all/${partnerId}`);
        return partnerId;
    } catch (err: any) {
        return rejectWithValue(err.message);
    }
});

export const markGroupMessagesAsRead = createAsyncThunk("chat/markGroupMessagesAsRead", async (groupId: string, { rejectWithValue }) => {
    try {
        await api.put(`/chat/group/${groupId}/read-all`);
        return groupId;
    } catch (err: any) {
        return rejectWithValue(err.message);
    }
});

export const deleteMessage = createAsyncThunk<string, { messageId: string, deleteType: 'me' | 'everyone' }, { rejectValue: string }>(
    "chat/deleteMessage",
    async ({ messageId, deleteType }, { rejectWithValue }) => {
        try {
            await api.delete(`/chat/messages/${messageId}?deleteType=${deleteType}`);
            return messageId;
        } catch (err: any) {
            return rejectWithValue(err.response?.data?.message || "Delete failed");
        }
    }
);

export const reactToMessage = createAsyncThunk<Message, { messageId: string, emoji: string | null }, { rejectValue: string }>(
    "chat/reactToMessage",
    async ({ messageId, emoji }, { rejectWithValue }) => {
        try {
            const res = await api.post(`/chat/messages/${messageId}/react`, { emoji });
            return res.data.message;
        } catch (err: any) {
            return rejectWithValue(err.response?.data?.message || "Reaction failed");
        }
    }
);

// ==========================================
// 👥 GROUP THUNKS (Full CRUD)
// ==========================================

export const fetchMyGroups = createAsyncThunk("group/fetchMyGroups", async (_, { rejectWithValue }) => {
    try {
        const res = await api.get("/group/my-groups");
        return res.data.groups;
    } catch (err: any) {
        return rejectWithValue(err.response?.data?.message || "Failed to load groups");
    }
});

export const createGroup = createAsyncThunk<Group, any, { rejectValue: string }>("group/createGroup", async (data, { rejectWithValue }) => {
    try {
        const res = await api.post("/group/create", data);
        return res.data.group;
    } catch (err: any) {
        return rejectWithValue(err.response?.data?.message || "Failed to create group");
    }
});

export const fetchGroupDetails = createAsyncThunk<Group, string, { rejectValue: string }>("group/fetchGroupDetails", async (groupId, { rejectWithValue }) => {
    try {
        const res = await api.get(`/group/${groupId}`);
        return res.data.group;
    } catch (err: any) {
        return rejectWithValue(err.response?.data?.message || "Failed to load group details");
    }
});

export const updateGroupInfo = createAsyncThunk<Group, { groupId: string, data: any }, { rejectValue: string }>("group/updateGroupInfo", async ({ groupId, data }, { rejectWithValue }) => {
    try {
        const res = await api.put(`/group/${groupId}/update`, data);
        return res.data.group;
    } catch (err: any) {
        return rejectWithValue(err.response?.data?.message || "Failed to update group");
    }
});

export const deleteGroup = createAsyncThunk<string, string, { rejectValue: string }>("group/deleteGroup", async (groupId, { rejectWithValue }) => {
    try {
        await api.delete(`/group/${groupId}/delete`);
        return groupId;
    } catch (err: any) {
        return rejectWithValue(err.response?.data?.message || "Failed to delete group");
    }
});

export const addGroupMember = createAsyncThunk<Group, { groupId: string, memberId: string, memberModel: string }, { rejectValue: string }>("group/addGroupMember", async ({ groupId, memberId, memberModel }, { rejectWithValue }) => {
    try {
        const res = await api.post(`/group/${groupId}/add`, { memberId, memberModel });
        return res.data.group;
    } catch (err: any) {
        return rejectWithValue(err.response?.data?.message || "Failed to add member");
    }
});

export const removeGroupMember = createAsyncThunk<Group, { groupId: string, memberId: string }, { rejectValue: string }>("group/removeGroupMember", async ({ groupId, memberId }, { rejectWithValue }) => {
    try {
        const res = await api.post(`/group/${groupId}/remove`, { memberId });
        return res.data.group;
    } catch (err: any) {
        return rejectWithValue(err.response?.data?.message || "Failed to remove member");
    }
});

export const leaveGroup = createAsyncThunk<string, string, { rejectValue: string }>("group/leaveGroup", async (groupId, { rejectWithValue }) => {
    try {
        await api.post(`/group/${groupId}/leave`);
        return groupId;
    } catch (err: any) {
        return rejectWithValue(err.response?.data?.message || "Failed to leave group");
    }
});

// ==========================================
// 🌟 STATUS THUNKS (Full CRUD)
// ==========================================

export const fetchStatusFeed = createAsyncThunk("status/fetchStatusFeed", async (_, { rejectWithValue }) => {
    try {
        const res = await api.get("/status/feed");
        return res.data.feed;
    } catch (err: any) {
        return rejectWithValue(err.response?.data?.message || "Failed to load status feed");
    }
});

export const fetchMyStatuses = createAsyncThunk("status/fetchMyStatuses", async (_, { rejectWithValue }) => {
    try {
        const res = await api.get("/status/my-statuses");
        return res.data.statuses;
    } catch (err: any) {
        return rejectWithValue(err.response?.data?.message || "Failed to load your statuses");
    }
});

export const fetchStatusViewers = createAsyncThunk("status/fetchStatusViewers", async (statusId: string, { rejectWithValue }) => {
    try {
        const res = await api.get(`/status/${statusId}/viewers`);
        return res.data.viewers;
    } catch (err: any) {
        return rejectWithValue(err.response?.data?.message || "Failed to load viewers");
    }
});

export const createStatus = createAsyncThunk<StatusItem, FormData, { rejectValue: string }>("status/createStatus", async (formData, { rejectWithValue }) => {
    try {
        const res = await api.post("/status/create", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });
        return res.data.status;
    } catch (err: any) {
        return rejectWithValue(err.response?.data?.message || "Failed to upload status");
    }
});

export const viewStatus = createAsyncThunk<string, string, { rejectValue: string }>("status/viewStatus", async (statusId, { rejectWithValue }) => {
    try {
        await api.put(`/status/view/${statusId}`);
        return statusId;
    } catch (err: any) {
        return rejectWithValue(err.response?.data?.message || "Failed to view status");
    }
});

export const updateStatusCaption = createAsyncThunk<StatusItem, { statusId: string, caption: string }, { rejectValue: string }>("status/updateStatusCaption", async ({ statusId, caption }, { rejectWithValue }) => {
    try {
        const res = await api.put(`/status/${statusId}`, { caption });
        return res.data.status;
    } catch (err: any) {
        return rejectWithValue(err.response?.data?.message || "Failed to update caption");
    }
});

export const deleteOwnStatus = createAsyncThunk<string, string, { rejectValue: string }>("status/deleteOwnStatus", async (statusId, { rejectWithValue }) => {
    try {
        await api.delete(`/status/${statusId}`);
        return statusId;
    } catch (err: any) {
        return rejectWithValue(err.response?.data?.message || "Failed to delete status");
    }
});

// ==========================================
// 🛠️ SLICE DEFINITION & REDUCERS
// ==========================================
const chatSlice = createSlice({
    name: "chat",
    initialState,
    reducers: {
        setActivePartner: (state, action: PayloadAction<string>) => {
            state.activePartnerId = action.payload;
        },
        clearMessages: (state) => {
            state.messages = [];
        },
        resetChatState: () => {
            return initialState;
        },
        receiveMessage: (state, action: PayloadAction<Message>) => {
            const msg = action.payload;

            // 1. Add message to active chat window if it belongs there
            const isRelevantChat = state.activePartnerId && (
                msg.sender === state.activePartnerId ||
                msg.receiver === state.activePartnerId ||
                msg.group === state.activePartnerId
            );

            if (isRelevantChat) {
                const isDuplicate = state.messages.some(m => m._id === msg._id);
                if (!isDuplicate) state.messages.push(msg);
            }

            // 🔥 CRITICAL FIX: Update the Inbox List while preserving Profile Photos
            const targetId = msg.isGroupMessage ? (msg.group || msg.sender) : msg.sender;
            const convoIndex = state.conversations.findIndex(c => c._id === targetId);

            if (convoIndex !== -1) {
                // Update the last message string and timestamp, but keep the `contact` object exactly as it is.
                state.conversations[convoIndex].lastMessage = msg.content || (msg.messageType === 'image' ? "📷 Image" : "🎤 Audio");
                state.conversations[convoIndex].timestamp = msg.timestamp;

                // Increment unread count if we are not currently inside this chat room
                if (state.activePartnerId !== targetId) {
                    state.conversations[convoIndex].unreadCount = (state.conversations[convoIndex].unreadCount || 0) + 1;
                }
            }
        },
        updateMessageLocally: (state, action: PayloadAction<Message>) => {
            const index = state.messages.findIndex(m => m._id === action.payload._id);
            if (index !== -1) {
                state.messages[index] = action.payload;
            }
        },
        deleteMessageLocally: (state, action: PayloadAction<string>) => {
            state.messages = state.messages.filter(m => m._id !== action.payload);
        },
        setPartnerSeen: (state) => {
            state.messages = state.messages.map(m => ({ ...m, read: true, status: 'read' }));
        },
        clearError: (state) => {
            state.error = null;
        }
    },
    extraReducers: (builder) => {
        builder
            // --- CHAT HISTORY & SENDING ---
            .addCase(fetchChatList.fulfilled, (state, action) => {
                state.conversations = action.payload;
            })
            .addCase(fetchMessages.pending, (state) => { state.loading = true; })
            .addCase(fetchMessages.fulfilled, (state, action) => {
                state.loading = false;
                state.messages = action.payload;
            })
            .addCase(fetchMessages.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            .addCase(fetchGroupMessages.pending, (state) => { state.loading = true; })
            .addCase(fetchGroupMessages.fulfilled, (state, action) => {
                state.loading = false;
                state.messages = action.payload;
            })
            .addCase(fetchGroupMessages.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            .addCase(sendMessage.pending, (state) => { state.isSending = true; })
            .addCase(sendMessage.fulfilled, (state, action) => {
                state.isSending = false;
                const msg = action.payload;

                // 1. Deduplication check for HTTP sender adding to active messages
                if (state.activePartnerId === msg.receiver || state.activePartnerId === msg.sender || state.activePartnerId === msg.group) {
                    if (!state.messages.some(m => m._id === msg._id)) {
                        state.messages.push(msg);
                    }
                }

                // 🔥 CRITICAL FIX: Update the Inbox List immediately upon sending a message
                const targetId = msg.isGroupMessage ? (msg.group || msg.receiver) : msg.receiver;
                const convoIndex = state.conversations.findIndex(c => c._id === targetId);

                if (convoIndex !== -1) {
                    state.conversations[convoIndex].lastMessage = msg.content || (msg.messageType === 'image' ? "📷 Image" : "🎤 Audio");
                    state.conversations[convoIndex].timestamp = msg.timestamp;
                }
            })
            .addCase(sendMessage.rejected, (state) => { state.isSending = false; })

            // --- MESSAGE ACTIONS (Delete, Read, React) ---
            .addCase(deleteMessage.fulfilled, (state, action) => {
                state.messages = state.messages.filter(m => m._id !== action.payload);
            })
            .addCase(markMessagesAsRead.fulfilled, (state, action) => {
                const partnerId = action.payload;
                const convo = state.conversations.find(c => c._id === partnerId);
                if (convo) convo.unreadCount = 0;
            })
            .addCase(markGroupMessagesAsRead.fulfilled, (state, action) => {
                const groupId = action.payload;
                const convo = state.conversations.find(c => c._id === groupId);
                if (convo) convo.unreadCount = 0;
            })
            .addCase(reactToMessage.fulfilled, (state, action) => {
                const index = state.messages.findIndex(m => m._id === action.payload._id);
                if (index !== -1) state.messages[index] = action.payload;
            })

            // --- GROUPS ---
            .addCase(fetchMyGroups.fulfilled, (state, action) => { state.groups = action.payload; })
            .addCase(createGroup.fulfilled, (state, action) => { state.groups.unshift(action.payload); })
            .addCase(fetchGroupDetails.fulfilled, (state, action) => { state.currentGroup = action.payload; })
            .addCase(updateGroupInfo.fulfilled, (state, action) => { state.currentGroup = action.payload; })
            .addCase(addGroupMember.fulfilled, (state, action) => { state.currentGroup = action.payload; })
            .addCase(removeGroupMember.fulfilled, (state, action) => { state.currentGroup = action.payload; })
            .addCase(leaveGroup.fulfilled, (state, action) => {
                state.groups = state.groups.filter(g => g._id !== action.payload);
            })
            .addCase(deleteGroup.fulfilled, (state, action) => {
                state.groups = state.groups.filter(g => g._id !== action.payload);
                state.conversations = state.conversations.filter(c => c._id !== action.payload);
            })

            // --- STATUS ---
            .addCase(fetchStatusFeed.fulfilled, (state, action) => { state.statusFeed = action.payload; })
            .addCase(fetchMyStatuses.fulfilled, (state, action) => { state.myStatuses = action.payload; })
            .addCase(fetchStatusViewers.fulfilled, (state, action) => { state.statusViewers = action.payload; })
            .addCase(createStatus.fulfilled, (state, action) => { state.myStatuses.unshift(action.payload); })
            .addCase(updateStatusCaption.fulfilled, (state, action) => {
                const index = state.myStatuses.findIndex(s => s._id === action.payload._id);
                if (index !== -1) state.myStatuses[index] = action.payload;
            })
            .addCase(deleteOwnStatus.fulfilled, (state, action) => {
                state.myStatuses = state.myStatuses.filter(s => s._id !== action.payload);
            });
    },
});

export const {
    setActivePartner,
    receiveMessage,
    updateMessageLocally,
    deleteMessageLocally,
    setPartnerSeen,
    clearError,
    clearMessages,
    resetChatState
} = chatSlice.actions;

export default chatSlice.reducer;