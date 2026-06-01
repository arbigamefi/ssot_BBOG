"use client";

export const WALLET_CONNECT_REQUEST_EVENT = "ssot:wallet-connect-request";

export function requestWalletConnect() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(WALLET_CONNECT_REQUEST_EVENT));
}
