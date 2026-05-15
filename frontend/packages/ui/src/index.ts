export * from "./lib/utils";

// design token names
export { THEME_TOKEN_NAMES } from "./tokens";
export type { ThemeToken } from "./tokens";

// target architecture subpath namespaces
export * as uiIcons from "./icons";
export * as uiMotion from "./motion";
export * as uiPatterns from "./patterns";
export * as uiPrimitives from "./primitives";
export * as uiUtils from "./utils";

// ui primitives
export * from "./components/ui/button";
export * from "./components/ui/badge";
export * from "./components/ui/card";
export * from "./components/ui/alert";
export * from "./components/ui/input";
export * from "./components/ui/label";
export * from "./components/ui/skeleton";
export * from "./components/ui/toaster";
export * from "./components/ui/theme-toggle";
export * from "./components/ui/pagination";
export * from "./components/ui/copy-button";
export * from "./components/ui/page-header";
export * from "./components/ui/stat-card";
export * from "./components/ui/status-badge";
export * from "./components/ui/tab-bar";
export * from "./components/ui/data-table";
export { toast } from "sonner";

// protocol (presentational domain components)
export * from "./components/protocol/release-badge";
export * from "./components/protocol/read-only-banner";
export * from "./components/protocol/tx-stepper";
export * from "./components/protocol/tx-status-chip";
export * from "./components/protocol/error-callout";
export * from "./components/protocol/asset-selector";

// New Refactored Domain Components
export * from "./components/ui/shell-header";
export * from "./components/ui/room-strip";
export * from "./components/protocol/audit-tabs";

// i18n
export type { I18nKey, I18nPack } from "./i18n/keys";
export { I18nProvider, useI18n, registerI18nPack } from "./i18n/context";
export { en as enStrings } from "./i18n/en";
