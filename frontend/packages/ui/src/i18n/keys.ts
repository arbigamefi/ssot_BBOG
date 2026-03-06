/**
 * i18n string keys.
 *
 * Every user-facing string that participates in i18n MUST be represented
 * as a key in this union. The string packs (en.ts, zh.ts, etc.) provide
 * concrete translations for each key.
 *
 * Naming convention:
 *   <component>.<context>   e.g. "error.title", "referral.bindButton"
 */
export type I18nKey =
  // ——— ErrorCallout ———
  | "error.defaultTitle"
  // ——— Common ———
  | "common.loading"
  | "common.refresh"
  | "common.noData"
  | "common.connectWallet"
  | "common.readOnlyNotice"
  // ——— Liquidity ———
  | "liquidity.title"
  | "liquidity.description"
  | "liquidity.deposit"
  | "liquidity.withdraw"
  | "liquidity.redeem"
  // ——— Referral ———
  | "referral.title"
  | "referral.description"
  | "referral.currentReferrer"
  | "referral.noBound"
  | "referral.bindButton"
  | "referral.bindSuccess"
  // ——— Bets ———
  | "bets.title"
  | "bets.detail"
  | "bets.refundButton"
  | "bets.finalizeButton"
  | "bets.notFound";

/**
 * A complete string pack maps every key to its translated string.
 * Interpolation is left to the consumer (simple template literals).
 */
export type I18nPack = Record<I18nKey, string>;
