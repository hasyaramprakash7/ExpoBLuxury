// src/hooks/useDeferredMount.ts
import { useEffect, useState } from 'react';
import { InteractionManager } from 'react-native';

/**
 * Returns `false` on the very first render, then `true` after the current
 * navigation transition / touch gesture has finished.
 *
 * Keep the first frame of a heavy screen cheap:
 *   const ready = useDeferredMount();
 *   ...
 *   {ready ? <HeavyList /> : <View style={{ flex: 1 }} />}
 */
export const useDeferredMount = (): boolean => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setReady(true);
    });
    return () => task.cancel();
  }, []);

  return ready;
};

export default useDeferredMount;