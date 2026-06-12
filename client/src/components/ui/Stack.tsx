import { forwardRef } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { getActivePreset } from "./preset";

export type StackDirection = "vertical" | "horizontal";
export type StackGap = "sm" | "md" | "lg" | "xl";
export type StackAlign = "start" | "center" | "end" | "stretch" | "baseline";
export type StackJustify =
  | "start"
  | "center"
  | "end"
  | "between"
  | "around"
  | "evenly";

export interface StackProps extends HTMLAttributes<HTMLDivElement> {
  /** Stack direction — `vertical` (default) renders flex-col, `horizontal` renders flex-row. */
  direction?: StackDirection;
  /** Gap size token — resolved via the active Preset's `stack.gap` slot. */
  gap?: StackGap;
  /** Align items along the cross axis. */
  align?: StackAlign;
  /** Justify content along the main axis. */
  justify?: StackJustify;
  /** Allow children to wrap onto multiple lines. */
  wrap?: boolean;
  /** Render content as the inline-flex variant instead of block. */
  inline?: boolean;
  children?: ReactNode;
}

/**
 * Stack — preset-controlled flexbox spacing primitive.
 *
 * Replaces ad-hoc `<div className="flex flex-col gap-4">` patterns. Three
 * common shapes:
 *
 *     <Stack gap="md">…</Stack>                          // vertical, gap-4
 *     <Stack direction="horizontal" gap="sm">…</Stack>   // row, gap-2
 *     <Stack gap="lg" align="center" justify="between">…</Stack>
 *
 * Aliases `<HStack>` and `<VStack>` are exported below for convenience.
 */
export const Stack = forwardRef<HTMLDivElement, StackProps>(function Stack(
  {
    direction = "vertical",
    gap = "md",
    align,
    justify,
    wrap = false,
    inline = false,
    className = "",
    children,
    ...rest
  },
  ref,
) {
  const p = getActivePreset().stack;
  const cls = [
    inline ? p.inline : p.shell,
    direction === "vertical" ? p.directions.vertical : p.directions.horizontal,
    p.gaps[gap],
    align ? p.aligns[align] : "",
    justify ? p.justifies[justify] : "",
    wrap ? p.wrap : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={ref} className={cls} {...rest}>
      {children}
    </div>
  );
});

/** Horizontal stack — alias for `<Stack direction="horizontal" …>`. */
export const HStack = forwardRef<HTMLDivElement, Omit<StackProps, "direction">>(
  function HStack(props, ref) {
    return <Stack ref={ref} {...props} direction="horizontal" />;
  },
);

/** Vertical stack — alias for `<Stack direction="vertical" …>` (the default). */
export const VStack = forwardRef<HTMLDivElement, Omit<StackProps, "direction">>(
  function VStack(props, ref) {
    return <Stack ref={ref} {...props} direction="vertical" />;
  },
);
