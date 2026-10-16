// src/hooks/useVideoPreload.ts
import { useEffect, useRef } from 'react';
import {
  loadSettings,
  preloadQueue,
  applyQuality,
  getSettings,
} from '../utils/preloadManager';

const TAG = '⚡[useVideoPreload]';

const log = (...args: any[]) => {
  if (__DEV__) console.log(TAG, ...args);
};

export const useVideoPreload = (
  data: any[],
  activeIndex: number,
  preloadDistance: number = 2
) => {
  const lastPreloadedIndexRef = useRef<number>(-1);
  const lastDataLengthRef = useRef<number>(0);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (!data || data.length === 0) return;
    if (activeIndex < 0) return;

    if (
      lastPreloadedIndexRef.current === activeIndex &&
      lastDataLengthRef.current === data.length
    ) {
      return;
    }

    lastPreloadedIndexRef.current = activeIndex;
    lastDataLengthRef.current = data.length;

    const settings = getSettings();
    if (!settings.preloadEnabled) {
      return;
    }

    const urlsToPreload: string[] = [];

    for (let i = 1; i <= preloadDistance; i++) {
      const nextAd = data[activeIndex + i];
      if (!nextAd) break;
      if (nextAd.mediaType !== 'video') continue;

      let url = nextAd.hlsUrl || nextAd.video || '';
      if (!url) continue;

      if (settings.quality !== 'auto' && url.endsWith('.m3u8')) {
        url = applyQuality(url, settings.quality);
      }

      urlsToPreload.push(url);
    }

    if (urlsToPreload.length > 0) {
      log(
        `📥 Preloading ${urlsToPreload.length} video(s) ahead of index ${activeIndex}`
      );
      preloadQueue(urlsToPreload, preloadDistance);
    }
  }, [activeIndex, data, preloadDistance]);
};