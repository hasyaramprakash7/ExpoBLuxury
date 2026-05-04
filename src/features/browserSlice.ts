// import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// export interface HistoryItem {
//   url: string;
//   name: string;
//   icon: string;
//   timestamp: number;
// }

// export interface SavedSong {
//   id: string;
//   title: string;
//   url: string;
// }

// // NEW: Added UpNextItem to store the scraped playlist
// export interface UpNextItem {
//   title: string;
//   url: string;
//   thumbnail: string;
// }

// interface NowPlayingMeta {
//   title: string | null;
//   thumbnail: string | null;
//   upNext: UpNextItem[]; // NEW
// }

// interface BrowserState {
//   history: HistoryItem[];
//   activeApp: HistoryItem | null;
//   isBrowserVisible: boolean;
//   isPlaying: boolean;
//   isMuted: boolean;
//   savedSongs: SavedSong[];
//   browserCommand: string | null;
//   nowPlaying: NowPlayingMeta;
// }

// const initialState: BrowserState = { 
//   history: [],
//   activeApp: null,
//   isBrowserVisible: false,
//   isPlaying: true, 
//   isMuted: false,
//   savedSongs: [],
//   browserCommand: null,
//   nowPlaying: { title: null, thumbnail: null, upNext: [] }
// };

// const browserSlice = createSlice({
//   name: "browser",
//   initialState,
//   reducers: {
//     addToHistory: (state, action: PayloadAction<HistoryItem>) => {
//       if (!action.payload.url || action.payload.url === "about:blank") return;

//       const existingIndex = state.history.findIndex(item => item.name === action.payload.name);

//       if (existingIndex !== -1) {
//         state.history[existingIndex] = action.payload;
//       } else {
//         state.history.push(action.payload);
//       }

//       if (state.history.length > 5) state.history.shift();
//       state.activeApp = action.payload;
//     },
//     removeFromHistory: (state, action: PayloadAction<{ name: string }>) => {
//       state.history = state.history.filter(item => item.name !== action.payload.name);
//       if (state.activeApp?.name === action.payload.name) {
//         state.activeApp = null;
//         state.isBrowserVisible = false;
//       }
//     },
//     clearHistory: (state) => {
//       state.history = [];
//       state.activeApp = null;
//       state.isBrowserVisible = false;
//     },
//     showBrowser: (state) => {
//       state.isBrowserVisible = true;
//     },
//     hideBrowser: (state) => {
//       state.isBrowserVisible = false;
//     },
//     setActiveApp: (state, action: PayloadAction<HistoryItem>) => {
//       state.activeApp = action.payload;
//     },
//     togglePlay: (state) => {
//       state.isPlaying = !state.isPlaying;
//     },
//     toggleMute: (state) => {
//       state.isMuted = !state.isMuted;
//     },
//     saveSong: (state, action: PayloadAction<SavedSong>) => {
//       const exists = state.savedSongs.find(s => s.url === action.payload.url);
//       if (!exists) {
//         state.savedSongs.push(action.payload);
//       }
//     },
//     removeSong: (state, action: PayloadAction<string>) => {
//       state.savedSongs = state.savedSongs.filter(s => s.id !== action.payload);
//     },
//     setBrowserCommand: (state, action: PayloadAction<string>) => {
//       state.browserCommand = action.payload;
//     },
//     clearBrowserCommand: (state) => {
//       state.browserCommand = null;
//     },
//     setNowPlaying: (state, action: PayloadAction<NowPlayingMeta>) => {
//       state.nowPlaying = action.payload;
//     }
//   },
// });

// export const { 
//   addToHistory, 
//   clearHistory, 
//   removeFromHistory,
//   showBrowser,
//   hideBrowser,
//   setActiveApp,
//   togglePlay,
//   toggleMute,
//   saveSong,
//   removeSong,
//   setBrowserCommand,
//   clearBrowserCommand,
//   setNowPlaying
// } = browserSlice.actions;

// export default browserSlice.reducer;