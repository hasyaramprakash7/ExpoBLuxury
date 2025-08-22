// src/features/chat/chatSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import io, { Socket } from 'socket.io-client';
import api from '../../../utils/api'; // Assuming you have a configured axios instance

// Define message and conversation types
interface Message {
    _id: string;
    sender: string;
    receiver: string;
    content: string;
    timestamp: string;
}

interface ConversationPartner {
    _id: string;
    name: string;
    phone: string;
    // Add other fields as needed
}

interface Conversation {
    id: string;
    partner: ConversationPartner;
    lastMessage: Message;
}

interface ChatState {
    socket: Socket | null;
    conversations: Conversation[];
    activePartnerId: string | null;
    messages: Message[];
    loading: boolean;
    error: string | null;
}

const initialState: ChatState = {
    socket: null,
    conversations: [],
    activePartnerId: null,
    messages: [],
    loading: false,
    error: null,
};

// Async Thunk to fetch chat messages for a specific partner
export const fetchMessages = createAsyncThunk<
    Message[],
    string, // partnerId
    { rejectValue: string; state: { auth: { user: { _id: string } } } }
>(
    "chat/fetchMessages",
    async (partnerId, { rejectWithValue, getState }) => {
        try {
            const userId = getState().auth.user._id; // Assuming auth slice stores user info
            const res = await api.get(`/chat/${partnerId}/messages`);
            return res.data.messages;
        } catch (err: any) {
            return rejectWithValue(err.response?.data?.message || "Failed to fetch messages");
        }
    }
);

const chatSlice = createSlice({
    name: "chat",
    initialState,
    reducers: {
        // Initializes the WebSocket connection
        connectSocket: (state, action: PayloadAction<string>) => {
            if (!state.socket) {
                const token = action.payload;
                const newSocket = io('YOUR_API_URL', {
                    auth: { token },
                });
                state.socket = newSocket;
                console.log("Chat socket connected");
            }
        },
        // Handles a new message received from the socket
        receiveMessage: (state, action: PayloadAction<Message>) => {
            const newMessage = action.payload;
            // Add message to the messages array if it's for the active chat
            if (state.activePartnerId && (newMessage.sender === state.activePartnerId || newMessage.receiver === state.activePartnerId)) {
                state.messages.push(newMessage);
            }
            // Update the last message in the conversations list
            const conversation = state.conversations.find(conv => conv.id === newMessage.sender || conv.id === newMessage.receiver);
            if (conversation) {
                conversation.lastMessage = newMessage;
            }
        },
        // Sets the active chat partner and clears messages for the new chat
        setActivePartner: (state, action: PayloadAction<string>) => {
            state.activePartnerId = action.payload;
            state.messages = []; // Clear old messages
        },
        // Action to be dispatched when the user sends a message
        sendChatMessage: (state, action: PayloadAction<{ receiverId: string, content: string }>) => {
            if (state.socket) {
                state.socket.emit("sendMessage", action.payload);
            }
        },
        disconnectSocket: (state) => {
            if (state.socket) {
                state.socket.disconnect();
                state.socket = null;
            }
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchMessages.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchMessages.fulfilled, (state, action: PayloadAction<Message[]>) => {
                state.loading = false;
                state.messages = action.payload;
            })
            .addCase(fetchMessages.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            });
    },
});

export const {
    connectSocket,
    receiveMessage,
    setActivePartner,
    sendChatMessage,
    disconnectSocket,
} = chatSlice.actions;

export const chatReducer = chatSlice.reducer;