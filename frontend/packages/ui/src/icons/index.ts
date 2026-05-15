export * as LucideIcons from "lucide-react";
export * as OutlineIcons from "@heroicons/react/24/outline";
export * as SolidIcons from "@heroicons/react/24/solid";

export const iconSizeClassName = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
  xl: "h-8 w-8"
} as const;

export type IconSize = keyof typeof iconSizeClassName;
