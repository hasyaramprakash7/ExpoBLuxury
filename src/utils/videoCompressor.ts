// src/utils/videoCompressor.ts
import { Video } from 'react-native-compressor';
import * as FileSystem from 'expo-file-system/legacy';

const TAG = '🎬[VideoCompressor]';

const log = (...args: any[]) => {
  if (__DEV__) console.log(TAG, ...args);
};
const logError = (...args: any[]) => {
  if (__DEV__) console.error(TAG, '❌', ...args);
};

export interface CompressionResult {
  uri: string;
  originalSize: number;
  compressedSize: number;
  savedPercent: number;
  durationMs: number;
  compressed: boolean;
}

export const getFileSize = async (uri: string): Promise<number> => {
  try {
    if (!uri || !uri.startsWith('file://')) return 0;
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists && 'size' in info) {
      return info.size || 0;
    }
    return 0;
  } catch (e) {
    logError('getFileSize failed:', e);
    return 0;
  }
};

export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

export const compressVideo = async (
  uri: string,
  onProgress?: (progress: number) => void,
  options?: {
    maxSize?: number;
    bitrate?: number;
    compressionMethod?: 'auto' | 'manual';
  }
): Promise<CompressionResult> => {
  const t0 = Date.now();

  const {
    maxSize = 1280,
    bitrate = 2000000,
    compressionMethod = 'auto',
  } = options || {};

  log('══════════════════════════════════════');
  log('🚀 compressVideo START');
  log('   uri        :', uri?.slice(0, 80));
  log('   maxSize    :', maxSize);
  log('   bitrate    :', bitrate);
  log('   method     :', compressionMethod);

  const originalSize = await getFileSize(uri);
  log('   originalSize:', formatBytes(originalSize));

  // If video is already tiny (< 2 MB), skip compression
  if (originalSize > 0 && originalSize < 2 * 1024 * 1024) {
    log('   ⚡ Skipping compression — file < 2 MB');
    log('══════════════════════════════════════');
    return {
      uri,
      originalSize,
      compressedSize: originalSize,
      savedPercent: 0,
      durationMs: Date.now() - t0,
      compressed: false,
    };
  }

  try {
    let lastLoggedPercent = -1;

    log('   🔄 Compressing...');
    const compressedUri = await Video.compress(
      uri,
      {
        compressionMethod,
        maxSize,
        bitrate,
        minimumFileSizeForCompress: 2,
      },
      (progress: number) => {
        const percent = Math.round(progress * 100);
        if (percent >= lastLoggedPercent + 10 || percent === 100) {
          log(`   📊 Progress: ${percent}%`);
          lastLoggedPercent = percent;
        }
        onProgress?.(progress);
      }
    );

    const compressedSize = await getFileSize(compressedUri);
    const savedPercent =
      originalSize > 0
        ? Math.round((1 - compressedSize / originalSize) * 100)
        : 0;
    const durationMs = Date.now() - t0;

    log('   ✅ Compression complete');
    log('   originalSize  :', formatBytes(originalSize));
    log('   compressedSize:', formatBytes(compressedSize));
    log('   savedPercent  :', `${savedPercent}%`);
    log('   duration      :', `${durationMs}ms`);
    log('   resultUri     :', compressedUri?.slice(0, 80));
    log('══════════════════════════════════════');

    return {
      uri: compressedUri,
      originalSize,
      compressedSize,
      savedPercent,
      durationMs,
      compressed: true,
    };
  } catch (e: any) {
    logError('compressVideo FAILED:', e?.message);
    logError('   Falling back to original file');
    log('══════════════════════════════════════');

    return {
      uri,
      originalSize,
      compressedSize: originalSize,
      savedPercent: 0,
      durationMs: Date.now() - t0,
      compressed: false,
    };
  }
};

export const cleanupCompressed = async (uri: string) => {
  if (!uri || !uri.startsWith('file://')) return;
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
    log('🗑️ Cleaned up:', uri?.slice(0, 80));
  } catch (e) {
    logError('cleanupCompressed failed:', e);
  }
};