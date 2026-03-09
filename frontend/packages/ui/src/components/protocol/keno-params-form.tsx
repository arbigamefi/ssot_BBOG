import * as React from "react";

import { MaskPickerGrid } from "./mask-picker-grid";

export type KenoParamsFormProps = {
  title?: string;
  description?: string;
  /** Bitmask (uint40) as user-typed string. Accepts hex (0x...) or decimal. */
  mask: string;
  onMaskChange?: (mask: string) => void;
  disabled?: boolean;
  error?: string;
  className?: string;
};

export function KenoParamsForm(props: KenoParamsFormProps) {
  const {
    title = "Pick your Keno numbers",
    description = "Tap 1 to 10 numbers on the board, then move right to size the ticket.",
    mask,
    onMaskChange,
    disabled = false,
    error,
    className,
  } = props;

  const cells = React.useMemo(
    () => Array.from({ length: 40 }, (_value, index) => ({ label: String(index + 1) })),
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
      maxSelections={10}
      quickPickCounts={[3, 5, 8]}
      helperText="The packed mask stays available only if you need to audit the exact encoding."
      rawMaskLabel="Advanced packed mask"
    />
  );
}
