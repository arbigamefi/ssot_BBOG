import * as React from "react";

import { MaskPickerGrid } from "./mask-picker-grid";

export type RouletteParamsFormProps = {
  title?: string;
  description?: string;
  /** Bitmask (uint40) as user-typed string. Accepts hex (0x...) or decimal. */
  mask: string;
  onMaskChange?: (mask: string) => void;
  disabled?: boolean;
  error?: string;
  className?: string;
};

export function RouletteParamsForm(props: RouletteParamsFormProps) {
  const {
    title = "Build your roulette selection",
    description = "Use the legacy 40-cell board directly instead of typing a mask by hand.",
    mask,
    onMaskChange,
    disabled = false,
    error,
    className,
  } = props;

  const cells = React.useMemo(
    () =>
      Array.from({ length: 40 }, (_value, index) => ({
        label: String(index + 1).padStart(2, "0"),
      })),
    []
  );

  return (
    <MaskPickerGrid
      title={title}
      description={description}
      mask={mask}
      onMaskChange={onMaskChange}
      disabled={disabled}
      error={error}
      className={className}
      cells={cells}
      minSelections={1}
      quickPickCounts={[1, 3, 6]}
      helperText="This board mirrors the current legacy mask surface. Pick cells visually, then verify the packed value only if you need to audit the exact encoding."
      rawMaskLabel="Advanced legacy mask"
    />
  );
}
