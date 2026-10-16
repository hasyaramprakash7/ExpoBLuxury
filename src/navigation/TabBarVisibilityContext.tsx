// src/navigation/TabBarVisibilityContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from "react";

type TabBarVisCtx = {
  hidden: boolean;
  hide: () => void;
  show: () => void;
  toggle: () => void;
};

const Ctx = createContext<TabBarVisCtx | null>(null);

export const TabBarVisibilityProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [hidden, setHidden] = useState(false);

  const hide = useCallback(() => setHidden(true), []);
  const show = useCallback(() => setHidden(false), []);
  const toggle = useCallback(() => setHidden((h) => !h), []);

  const value = useMemo(
    () => ({ hidden, hide, show, toggle }),
    [hidden, hide, show, toggle]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useTabBarVisibility = (): TabBarVisCtx => {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // Safe fallback — never crash if used outside the provider
    return {
      hidden: false,
      hide: () => {},
      show: () => {},
      toggle: () => {},
    };
  }
  return ctx;
};