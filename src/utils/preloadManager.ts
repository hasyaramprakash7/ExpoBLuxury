// src/utils/preloadManager.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const TAG = '⚡[PreloadManager]';

const log = (...args: any[]) => {
  if (__DEV__) console.log(TAG, ...args);
};
const logWarn = (...args: any[]) => {
  if (__DEV__) console.warn(TAG, '⚠️', ...args);
};
const logError = (...args: any[]) => {
  if (__DEV__) console.error(TAG, '❌', ...args);
};

const MAX_CACHE_SIZE = 30;
const preloadedUrls = new Map<string, number>();

const evictOldest = () => {
  if (preloadedUrls.size <= MAX_CACHE_SIZE) return;
  const entries = Array.from(preloadedUrls.entries()).sort(
    (a, b) => a[1] - b[1]
  );
  const toRemove = entries.slice(0, entries.length - MAX_CACHE_SIZE);
  toRemove.forEach(([url]) => {
    preloadedUrls.delete(url);
    log(`🗑️ Evicted from cache: ${url.slice(0, 60)}...`);
  });
};

export const SETTINGS_KEYS = {
  PRELOAD_ENABLED: '@bluxury/preload_enabled',
  REDUCED_DATA: '@bluxury/reduced_data',
  WIFI_ONLY_PRELOAD: '@bluxury/wifi_only_preload',
  QUALITY: '@bluxury/video_quality',
};

export type VideoQuality = 'auto' | 'hd' | 'sd' | 'low';

let _preloadEnabled = true;
let _reducedData = false;
let _wifiOnlyPreload = true;
let _quality: VideoQuality = 'auto';
let _settingsLoaded = false;

export const loadSettings = async (): Promise<void> => {
  if (_settingsLoaded) return;
  try {
    const [preload, reduced, wifi, quality] = await Promise.all([
      AsyncStorage.getItem(SETTINGS_KEYS.PRELOAD_ENABLED),
      AsyncStorage.getItem(SETTINGS_KEYS.REDUCED_DATA),
      AsyncStorage.getItem(SETTINGS_KEYS.WIFI_ONLY_PRELOAD),
      AsyncStorage.getItem(SETTINGS_KEYS.QUALITY),
    ]);

    _preloadEnabled = preload !== 'false';
    _reducedData = reduced === 'true';
    _wifiOnlyPreload = wifi !== 'false';
    _quality = (quality as VideoQuality) || 'auto';
    _settingsLoaded = true;

    log('📋 Settings loaded:', {
      preloadEnabled: _preloadEnabled,
      reducedData: _reducedData,
      wifiOnlyPreload: _wifiOnlyPreload,
      quality: _quality,
    });
  } catch (e) {
    logError('loadSettings failed:', e);
    _settingsLoaded = true;
  }
};

export const getSettings = () => ({
  preloadEnabled: _preloadEnabled,
  reducedData: _reducedData,
  wifiOnlyPreload: _wifiOnlyPreload,
  quality: _quality,
});

export const savePreloadEnabled = async (value: boolean) => {
  _preloadEnabled = value;
  try {
    await AsyncStorage.setItem(
      SETTINGS_KEYS.PRELOAD_ENABLED,
      value ? 'true' : 'false'
    );
    log('💾 preloadEnabled saved:', value);
  } catch (e) {
    logError('savePreloadEnabled failed:', e);
  }
};

export const saveReducedData = async (value: boolean) => {
  _reducedData = value;
  try {
    await AsyncStorage.setItem(
      SETTINGS_KEYS.REDUCED_DATA,
      value ? 'true' : 'false'
    );
    log('💾 reducedData saved:', value);
  } catch (e) {
    logError('saveReducedData failed:', e);
  }
};

export const saveWifiOnlyPreload = async (value: boolean) => {
  _wifiOnlyPreload = value;
  try {
    await AsyncStorage.setItem(
      SETTINGS_KEYS.WIFI_ONLY_PRELOAD,
      value ? 'true' : 'false'
    );
    log('💾 wifiOnlyPreload saved:', value);
  } catch (e) {
    logError('saveWifiOnlyPreload failed:', e);
  }
};

export const saveQuality = async (value: VideoQuality) => {
  _quality = value;
  try {
    await AsyncStorage.setItem(SETTINGS_KEYS.QUALITY, value);
    log('💾 quality saved:', value);
  } catch (e) {
    logError('saveQuality failed:', e);
  }
};

const extractCloudinaryPublicId = (url: string): string => {
  try {
    const marker = '/video/upload/';
    const idx = url.indexOf(marker);
    if (idx === -1) return '';
    let tail = url.slice(idx + marker.length);
    tail = tail.replace(/^(?:[^/]+\/)*?(v\d+\/)/, '$1');
    tail = tail.replace(/^v\d+\//, '');
    tail = tail.replace(/\.[a-z0-9]+$/i, '');
    return tail;
  } catch {
    return '';
  }
};

export const applyQuality = (hlsUrl: string, quality: VideoQuality): string => {
  if (!hlsUrl || !hlsUrl.endsWith('.m3u8')) return hlsUrl;
  if (!hlsUrl.includes('res.cloudinary.com')) return hlsUrl;
  if (quality === 'auto') return hlsUrl;

  const publicId = extractCloudinaryPublicId(hlsUrl);
  if (!publicId) return hlsUrl;

  const match = hlsUrl.match(/res\.cloudinary\.com\/([^/]+)\//);
  const cloudName = match ? match[1] : '';
  if (!cloudName) return hlsUrl;

  const profileMap: Record<VideoQuality, string> = {
    auto: 'sp_auto',
    hd: 'sp_hd',
    sd: 'sp_sd',
    low: 'sp_480p',
  };

  const profile = profileMap[quality] || 'sp_hd';
  return `https://res.cloudinary.com/${cloudName}/video/upload/${profile}/${publicId}.m3u8`;
};

export const preloadVideo = async (url: string): Promise<boolean> => {
  if (!url) return false;
  if (preloadedUrls.has(url)) {
    log(`✅ Already cached: ${url.slice(0, 60)}...`);
    return true;
  }

  try {
    log(`📥 Preloading: ${url.slice(0, 60)}...`);
    const t0 = Date.now();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-65535' },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (res.ok || res.status === 206) {
      preloadedUrls.set(url, Date.now());
      evictOldest();
      log(`✅ Preloaded in ${Date.now() - t0}ms: ${url.slice(0, 60)}...`);
      return true;
    } else {
      logWarn(`Preload returned ${res.status}: ${url.slice(0, 60)}...`);
      return false;
    }
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      logWarn(`Preload timeout: ${url.slice(0, 60)}...`);
    } else {
      logError('preloadVideo failed:', e?.message);
    }
    return false;
  }
};

export const preloadQueue = async (
  urls: string[],
  distance: number = 2
): Promise<void> => {
  if (!_preloadEnabled) {
    log('⏸️ Preload disabled in settings');
    return;
  }

  const queue = urls.slice(0, distance).filter(Boolean);
  if (queue.length === 0) return;

  log(`🚀 Preloading ${queue.length} video(s)`);
  await Promise.allSettled(queue.map((url) => preloadVideo(url)));
};

export const getCacheStats = () => ({
  size: preloadedUrls.size,
  maxSize: MAX_CACHE_SIZE,
  urls: Array.from(preloadedUrls.keys()).map((u) => u.slice(0, 60)),
});

export const clearPreloadCache = () => {
  preloadedUrls.clear();
  log('🗑️ Preload cache cleared');
};