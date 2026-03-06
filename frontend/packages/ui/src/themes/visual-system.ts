/**
 * 统一视觉系统
 * 定义所有视觉元素的标准样式，确保整个应用的一致性
 */

// 圆角半径系统
export const RADIUS = {
  xs: "rounded-sm", // 2px
  sm: "rounded-md", // 6px
  md: "rounded-lg", // 8px
  lg: "rounded-xl", // 12px
  xl: "rounded-2xl", // 16px
  "2xl": "rounded-3xl", // 24px
  full: "rounded-full", // 50%
} as const;

// 阴影系统
export const SHADOWS = {
  none: "shadow-none",
  sm: "shadow-sm", // 0 1px 2px 0 rgb(0 0 0 / 0.05)
  md: "shadow-md", // 0 4px 6px -1px rgb(0 0 0 / 0.1)
  lg: "shadow-lg", // 0 10px 15px -3px rgb(0 0 0 / 0.1)
  xl: "shadow-xl", // 0 20px 25px -5px rgb(0 0 0 / 0.1)
  "2xl": "shadow-2xl", // 0 25px 50px -12px rgb(0 0 0 / 0.25)
  glass: "shadow-lg shadow-black/40",
  glow: "shadow-lg shadow-indigo-900/30",
} as const;

// 边框系统
export const BORDERS = {
  none: "border-0",
  thin: "border border-slate-600/20",
  medium: "border border-slate-600/30",
  thick: "border border-slate-600/40",
  accent: "border border-indigo-500/30",
  success: "border border-emerald-500/30",
  warning: "border border-amber-500/30",
  error: "border border-rose-500/30",
  glass: "border border-white/10",
} as const;

// 间距系统
export const SPACING = {
  xs: "p-1", // 4px
  sm: "p-2", // 8px
  md: "p-3", // 12px
  lg: "p-4", // 16px
  xl: "p-6", // 24px
  "2xl": "p-8", // 32px
} as const;

export const GAPS = {
  xs: "gap-1", // 4px
  sm: "gap-2", // 8px
  md: "gap-3", // 12px
  lg: "gap-4", // 16px
  xl: "gap-6", // 24px
  "2xl": "gap-8", // 32px
} as const;

// 背景系统
export const BACKGROUNDS = {
  // 玻璃态背景
  glass: {
    primary: "bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-md",
    secondary: "bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-sm",
    subtle: "bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm",
  },

  // 状态背景
  status: {
    live: "bg-gradient-to-r from-cyan-500/20 to-blue-500/20",
    rolling: "bg-gradient-to-r from-amber-500/20 to-orange-500/20",
    result: "bg-gradient-to-r from-emerald-500/20 to-green-500/20",
    refunded: "bg-gradient-to-r from-slate-500/20 to-gray-500/20",
  },

  // 按钮背景
  button: {
    primary: "bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400",
    secondary: "bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-500 hover:to-slate-600",
    success: "bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400",
    warning: "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400",
    error: "bg-gradient-to-r from-rose-500 to-red-500 hover:from-rose-400 hover:to-red-400",
    ghost: "bg-slate-700/40 hover:bg-slate-700/60",
  },
} as const;

// 文本系统
export const TEXT = {
  // 大小
  xs: "text-xs", // 12px
  sm: "text-sm", // 14px
  base: "text-base", // 16px
  lg: "text-lg", // 18px
  xl: "text-xl", // 20px
  "2xl": "text-2xl", // 24px
  "3xl": "text-3xl", // 30px

  // 颜色
  primary: "text-white",
  secondary: "text-slate-300",
  muted: "text-slate-400",
  accent: "text-indigo-300",
  success: "text-emerald-300",
  warning: "text-amber-300",
  error: "text-rose-300",

  // 渐变文本
  gradient: {
    primary: "bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent",
    accent: "bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent",
    rainbow: "bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent",
  },
} as const;

// 组合样式
export const COMPONENTS = {
  // 卡片
  card: {
    base: `${BACKGROUNDS.glass.secondary} ${BORDERS.medium} ${RADIUS.xl} ${SHADOWS.glass}`,
    elevated: `${BACKGROUNDS.glass.primary} ${BORDERS.thick} ${RADIUS.xl} ${SHADOWS.xl}`,
    subtle: `${BACKGROUNDS.glass.subtle} ${BORDERS.thin} ${RADIUS.lg} ${SHADOWS.sm}`,
  },

  // 按钮
  button: {
    primary: `${BACKGROUNDS.button.primary} ${TEXT.primary} font-semibold ${RADIUS.md} ${SPACING.md} transition-all duration-200 ${SHADOWS.sm} hover:${SHADOWS.md}`,
    secondary: `${BACKGROUNDS.button.secondary} ${TEXT.primary} font-semibold ${RADIUS.md} ${SPACING.md} transition-all duration-200 ${SHADOWS.sm} hover:${SHADOWS.md}`,
    error: `${BACKGROUNDS.button.error} ${TEXT.primary} font-semibold ${RADIUS.md} ${SPACING.md} transition-all duration-200 ${SHADOWS.sm} hover:${SHADOWS.md}`,
    ghost: `${BACKGROUNDS.button.ghost} ${TEXT.secondary} font-medium ${RADIUS.md} ${SPACING.sm} transition-all duration-200`,
  },

  // 输入框
  input: {
    base: `${BACKGROUNDS.glass.subtle} ${BORDERS.medium} ${RADIUS.md} ${TEXT.primary} placeholder:text-slate-400 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20`,
  },

  // 标签/徽章
  badge: {
    base: `${RADIUS.full} ${SPACING.sm} ${TEXT.xs} font-medium`,
    success: `${BACKGROUNDS.status.result} ${TEXT.success} ${BORDERS.success}`,
    warning: `${BACKGROUNDS.status.rolling} ${TEXT.warning} ${BORDERS.warning}`,
    error: `${BACKGROUNDS.status.refunded} ${TEXT.error} ${BORDERS.error}`,
  },
} as const;

// 动画系统
export const ANIMATIONS = {
  fade: "transition-opacity duration-200",
  slide: "transition-transform duration-200",
  scale: "transition-transform duration-200 hover:scale-105",
  glow: "transition-all duration-300 hover:shadow-lg hover:shadow-indigo-900/30",
  pulse: "animate-pulse",
  spin: "animate-spin",
} as const;

// 响应式断点
export const BREAKPOINTS = {
  sm: "sm:", // 640px
  md: "md:", // 768px
  lg: "lg:", // 1024px
  xl: "xl:", // 1280px
  "2xl": "2xl:", // 1536px
} as const;
