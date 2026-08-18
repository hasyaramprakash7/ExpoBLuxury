// src/features/leadSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '../userScreens/utils/api';
import { updateVendorStats } from '../features/vendor/vendorAuthSlice';

export interface Lead {
    _id: string;
    vendor: string;
    user: { _id: string; name: string; phone: string; email?: string; profilePic?: string };
    message: string;
    type: 'call' | 'whatsapp' | 'email' | 'quote' | 'view';
    status: 'new' | 'seen' | 'replied' | 'converted';
    viewedAt?: string;
    createdAt: string;
    updatedAt?: string;
}

interface LeadState {
    leads: Lead[];
    loading: boolean;
    error: string | null;
    stats: {
        total: number;
        today: number;
        byType: Record<string, number>;
        byStatus: Record<string, number>;
    } | null;
    pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    } | null;
    _statsLocked: boolean;
    _viewIds: Set<string>;
}

const initialState: LeadState = {
    leads: [],
    loading: false,
    error: null,
    stats: null,
    pagination: null,
    _statsLocked: false,
    _viewIds: new Set<string>(),
};

// ============================================================
// THUNKS
// ============================================================

// Create a general lead
export const createLead = createAsyncThunk(
    'leads/create',
    async (payload: { vendorId: string; message: string; type?: string }, { rejectWithValue }) => {
        try {
            const res = await api.post('/leads', payload);
            return res.data.data;
        } catch (err: any) {
            return rejectWithValue(err.response?.data?.message || 'Failed to send enquiry');
        }
    }
);

// Create a view lead (when user views a shop)
export const createViewLead = createAsyncThunk(
    'leads/createView',
    async ({ vendorId, shopName, userId, userName }: {
        vendorId: string;
        shopName: string;
        userId?: string;
        userName?: string;
    }, { rejectWithValue }) => {
        try {
            const payload: any = {
                vendorId,
                message: `${userName || 'Someone'} viewed your shop "${shopName}"`,
                type: 'view'
            };
            if (userId) payload.userId = userId;
            if (userName) payload.userName = userName;

            const res = await api.post('/leads', payload);
            return res.data.data;
        } catch (err: any) {
            console.log('View lead creation failed:', err);
            return rejectWithValue(err.response?.data?.message || 'Failed to track view');
        }
    }
);

// Create a call lead (when user clicks call button)
export const createCallLead = createAsyncThunk(
    'leads/createCall',
    async ({ vendorId, shopName, phone }: { vendorId: string; shopName: string; phone: string }, { rejectWithValue }) => {
        try {
            const res = await api.post('/leads', {
                vendorId,
                message: `User requested a call from "${shopName}"`,
                type: 'call'
            });
            return res.data.data;
        } catch (err: any) {
            console.log('Call lead creation failed:', err);
            return rejectWithValue(err.response?.data?.message || 'Failed to track call');
        }
    }
);

// Create a WhatsApp lead (when user clicks WhatsApp button)
export const createWhatsAppLead = createAsyncThunk(
    'leads/createWhatsApp',
    async ({ vendorId, shopName, phone }: { vendorId: string; shopName: string; phone: string }, { rejectWithValue }) => {
        try {
            const res = await api.post('/leads', {
                vendorId,
                message: `User sent a WhatsApp message to "${shopName}"`,
                type: 'whatsapp'
            });
            return res.data.data;
        } catch (err: any) {
            console.log('WhatsApp lead creation failed:', err);
            return rejectWithValue(err.response?.data?.message || 'Failed to track WhatsApp');
        }
    }
);

// Fetch vendor leads with filters
export const fetchVendorLeads = createAsyncThunk(
    'leads/fetchVendor',
    async ({ status, type, page = 1, limit = 100 }: { status?: string; type?: string; page?: number; limit?: number } = {}, { rejectWithValue }) => {
        try {
            const params = new URLSearchParams();
            if (status) params.append('status', status);
            if (type) params.append('type', type);
            params.append('page', String(page));
            params.append('limit', String(limit));

            const res = await api.get(`/leads/vendor?${params.toString()}`);
            return res.data;
        } catch (err: any) {
            return rejectWithValue(err.response?.data?.message || 'Failed to fetch leads');
        }
    }
);

// Fetch lead statistics
export const fetchLeadStats = createAsyncThunk(
    'leads/fetchStats',
    async (_, { rejectWithValue }) => {
        try {
            const res = await api.get('/leads/vendor/stats');
            return res.data.data;
        } catch (err: any) {
            return rejectWithValue(err.response?.data?.message || 'Failed to fetch stats');
        }
    }
);

// Update a single lead status
export const updateLeadStatus = createAsyncThunk(
    'leads/updateStatus',
    async ({ leadId, status }: { leadId: string; status: string }, { rejectWithValue }) => {
        try {
            const res = await api.put(`/leads/${leadId}`, { status });
            return res.data.data;
        } catch (err: any) {
            return rejectWithValue(err.response?.data?.message || 'Failed to update lead');
        }
    }
);

// Bulk update lead status
export const bulkUpdateLeadStatus = createAsyncThunk(
    'leads/bulkUpdate',
    async ({ leadIds, status }: { leadIds: string[]; status: string }, { rejectWithValue }) => {
        try {
            const res = await api.patch('/leads/bulk', { leadIds, status });
            return res.data.data;
        } catch (err: any) {
            return rejectWithValue(err.response?.data?.message || 'Failed to update leads');
        }
    }
);

// 🔥 NEW: Delete a single lead
export const deleteLead = createAsyncThunk(
    'leads/delete',
    async ({ leadId }: { leadId: string }, { rejectWithValue }) => {
        try {
            const res = await api.delete(`/leads/${leadId}`);
            return { leadId, message: res.data.message };
        } catch (err: any) {
            return rejectWithValue(err.response?.data?.message || 'Failed to delete lead');
        }
    }
);

// 🔥 NEW: Delete all leads
export const deleteAllLeads = createAsyncThunk(
    'leads/deleteAll',
    async (_, { rejectWithValue }) => {
        try {
            const res = await api.delete('/leads/all');
            return res.data;
        } catch (err: any) {
            return rejectWithValue(err.response?.data?.message || 'Failed to delete leads');
        }
    }
);

// 🔥 NEW: Clear local leads (for logout/refresh)
export const clearLocalLeads = createAsyncThunk(
    'leads/clearLocal',
    async (_, { rejectWithValue }) => {
        try {
            return { success: true };
        } catch (err: any) {
            return rejectWithValue('Failed to clear leads');
        }
    }
);

// ============================================================
// HELPER: Calculate stats from leads
// ============================================================
const calculateStatsFromLeads = (leads: Lead[]) => {
    const stats = {
        total: leads.length,
        today: 0,
        byType: {} as Record<string, number>,
        byStatus: {} as Record<string, number>,
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    leads.forEach((lead) => {
        stats.byType[lead.type] = (stats.byType[lead.type] || 0) + 1;
        stats.byStatus[lead.status] = (stats.byStatus[lead.status] || 0) + 1;
        const leadDate = new Date(lead.createdAt);
        if (leadDate >= today) {
            stats.today += 1;
        }
    });

    ['new', 'seen', 'replied', 'converted'].forEach(status => {
        if (!stats.byStatus[status]) stats.byStatus[status] = 0;
    });

    ['call', 'whatsapp', 'email', 'quote', 'view'].forEach(type => {
        if (!stats.byType[type]) stats.byType[type] = 0;
    });

    return stats;
};

// ============================================================
// SLICE
// ============================================================

const leadSlice = createSlice({
    name: 'leads',
    initialState,
    reducers: {
        clearLeads: (state) => {
            state.leads = [];
            state.pagination = null;
            state.stats = null;
            state._statsLocked = false;
            state._viewIds = new Set<string>();
            console.log('🗑️ [clearLeads] All leads cleared from Redux state');
        },
        clearStats: (state) => {
            state.stats = null;
            state._statsLocked = false;
        },
        addLead: (state, action: PayloadAction<Lead>) => {
            const exists = state.leads.some(l => l._id === action.payload._id);
            if (!exists) {
                if (action.payload.type === 'view') {
                    state._viewIds.add(action.payload._id);
                }
                state.leads = [action.payload, ...state.leads];
                state.stats = calculateStatsFromLeads(state.leads);
                state._statsLocked = true;
                console.log('📊 [addLead] Stats recalculated:', state.stats);
                console.log('📊 [addLead] Total leads now:', state.leads.length);
            }
        },
        updateLeadInState: (state, action: PayloadAction<Lead>) => {
            const index = state.leads.findIndex(l => l._id === action.payload._id);
            if (index !== -1) {
                state.leads[index] = action.payload;
                state.stats = calculateStatsFromLeads(state.leads);
                state._statsLocked = true;
            }
        },
        refreshStats: (state) => {
            state.stats = calculateStatsFromLeads(state.leads);
            state._statsLocked = true;
            console.log('📊 [refreshStats] Stats recalculated:', state.stats);
        },
        unlockStats: (state) => {
            state._statsLocked = false;
        },
        mergeLeads: (state, action: PayloadAction<{ leads: Lead[]; stats: any; pagination: any }>) => {
            const { leads: newLeads, stats: newStats, pagination } = action.payload;
            const existingMap = new Map<string, Lead>();
            state.leads.forEach(lead => existingMap.set(lead._id, lead));

            newLeads.forEach(lead => {
                if (!existingMap.has(lead._id)) {
                    existingMap.set(lead._id, lead);
                }
            });

            state.leads = Array.from(existingMap.values()).sort((a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );

            state.pagination = pagination;
            state.stats = calculateStatsFromLeads(state.leads);
            state._statsLocked = true;

            console.log('📊 [mergeLeads] Merged leads:', state.leads.length);
            console.log('📊 [mergeLeads] Stats:', state.stats);
        },
        // 🔥 NEW: Remove a lead from state (for optimistic updates)
        removeLead: (state, action: PayloadAction<string>) => {
            const leadId = action.payload;
            state.leads = state.leads.filter(l => l._id !== leadId);
            state.stats = calculateStatsFromLeads(state.leads);
            state._statsLocked = true;
            console.log(`🗑️ [removeLead] Lead ${leadId} removed from state`);
            console.log('📊 [removeLead] Stats recalculated:', state.stats);
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(createLead.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(createLead.fulfilled, (state, action) => {
                state.loading = false;
                const exists = state.leads.some(l => l._id === action.payload._id);
                if (!exists) {
                    state.leads = [action.payload, ...state.leads];
                    state.stats = calculateStatsFromLeads(state.leads);
                    state._statsLocked = true;
                }
            })
            .addCase(createLead.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            .addCase(createViewLead.fulfilled, (state, action) => {
                const exists = state.leads.some(l => l._id === action.payload._id);
                if (!exists) {
                    state.leads = [action.payload, ...state.leads];
                    state.stats = calculateStatsFromLeads(state.leads);
                    state._statsLocked = true;
                }
            })
            .addCase(createViewLead.rejected, () => { })
            .addCase(createCallLead.fulfilled, (state, action) => {
                const exists = state.leads.some(l => l._id === action.payload._id);
                if (!exists) {
                    state.leads = [action.payload, ...state.leads];
                    state.stats = calculateStatsFromLeads(state.leads);
                    state._statsLocked = true;
                }
            })
            .addCase(createCallLead.rejected, () => { })
            .addCase(createWhatsAppLead.fulfilled, (state, action) => {
                const exists = state.leads.some(l => l._id === action.payload._id);
                if (!exists) {
                    state.leads = [action.payload, ...state.leads];
                    state.stats = calculateStatsFromLeads(state.leads);
                    state._statsLocked = true;
                }
            })
            .addCase(createWhatsAppLead.rejected, () => { })
            .addCase(fetchVendorLeads.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchVendorLeads.fulfilled, (state, action) => {
                state.loading = false;
                const newLeads = action.payload.data || [];
                const newStats = action.payload.stats;
                const pagination = action.payload.pagination || null;

                const existingMap = new Map<string, Lead>();
                state.leads.forEach(lead => existingMap.set(lead._id, lead));

                newLeads.forEach((lead: Lead) => {
                    if (!existingMap.has(lead._id)) {
                        existingMap.set(lead._id, lead);
                    }
                });

                state.leads = Array.from(existingMap.values()).sort((a, b) =>
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                );

                state.pagination = pagination;
                state.stats = calculateStatsFromLeads(state.leads);
                state._statsLocked = true;

                console.log('📊 [fetchVendorLeads] Merged leads:', state.leads.length);
                console.log('📊 [fetchVendorLeads] Stats:', state.stats);
            })
            .addCase(fetchVendorLeads.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            .addCase(fetchLeadStats.fulfilled, (state, action) => {
                if (state._statsLocked && state.stats) {
                    console.log('📊 [fetchLeadStats] Stats are locked, keeping existing stats:', state.stats);
                    return;
                }
                const localStats = calculateStatsFromLeads(state.leads);
                if (action.payload && action.payload.total > 0) {
                    state.stats = {
                        total: action.payload.total || localStats.total,
                        today: action.payload.today || localStats.today,
                        byType: { ...localStats.byType, ...action.payload.byType },
                        byStatus: { ...localStats.byStatus, ...action.payload.byStatus },
                    };
                } else {
                    state.stats = localStats;
                }
                state._statsLocked = true;
                console.log('📊 [fetchLeadStats] Stats updated:', state.stats);
            })
            .addCase(updateLeadStatus.fulfilled, (state, action) => {
                const index = state.leads.findIndex(l => l._id === action.payload._id);
                if (index !== -1) {
                    state.leads[index] = { ...state.leads[index], ...action.payload };
                    state.stats = calculateStatsFromLeads(state.leads);
                    state._statsLocked = true;
                }
            })
            .addCase(bulkUpdateLeadStatus.fulfilled, (state) => {
                state.stats = calculateStatsFromLeads(state.leads);
                state._statsLocked = true;
            })
            // 🔥 NEW: Delete lead handlers
            .addCase(deleteLead.fulfilled, (state, action) => {
                const { leadId } = action.payload;
                state.leads = state.leads.filter(l => l._id !== leadId);
                state.stats = calculateStatsFromLeads(state.leads);
                state._statsLocked = true;
                console.log(`🗑️ [deleteLead] Lead ${leadId} deleted successfully`);
                console.log('📊 [deleteLead] Stats recalculated:', state.stats);
            })
            .addCase(deleteLead.rejected, (state, action) => {
                state.error = action.payload as string;
                console.error('❌ [deleteLead] Failed to delete lead:', action.payload);
            })
            // 🔥 NEW: Delete all leads handler
            .addCase(deleteAllLeads.fulfilled, (state) => {
                state.leads = [];
                state.stats = null;
                state._statsLocked = false;
                state._viewIds = new Set<string>();
                console.log('🗑️ [deleteAllLeads] All leads deleted successfully');
            })
            .addCase(deleteAllLeads.rejected, (state, action) => {
                state.error = action.payload as string;
                console.error('❌ [deleteAllLeads] Failed to delete leads:', action.payload);
            })
            // 🔥 NEW: Clear local leads (for logout/refresh)
            .addCase(clearLocalLeads.fulfilled, (state) => {
                state.leads = [];
                state.stats = null;
                state.pagination = null;
                state._statsLocked = false;
                state._viewIds = new Set<string>();
                console.log('🗑️ [clearLocalLeads] Local leads cleared');
            });
    },
});

export const {
    clearLeads,
    clearStats,
    addLead,
    updateLeadInState,
    refreshStats,
    unlockStats,
    mergeLeads,
    removeLead, // 🔥 NEW: Export removeLead
} = leadSlice.actions;
export default leadSlice.reducer;