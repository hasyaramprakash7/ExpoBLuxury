// src/navigation/shopDetailMode.ts
import { useEffect, useState } from "react";

type Listener = (inDetail: boolean) => void;

let inShopDetail = false;
const listeners = new Set<Listener>();

export const notifyShopDetailEnter = () => {
  if (inShopDetail) return;
  inShopDetail = true;
  listeners.forEach((l) => l(true));
};

export const notifyShopDetailExit = () => {
  if (!inShopDetail) return;
  inShopDetail = false;
  listeners.forEach((l) => l(false));
};

export const isInShopDetail = () => inShopDetail;

export const useShopDetailMode = () => {
  const [value, setValue] = useState(inShopDetail);
  useEffect(() => {
    const l: Listener = (v) => setValue(v);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return {
    inShopDetail: value,
    enter: notifyShopDetailEnter,
    exit: notifyShopDetailExit,
  };
};