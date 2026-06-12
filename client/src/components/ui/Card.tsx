import { forwardRef } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { getActivePreset } from "./preset";

export type CardVariant = "default" | "panel" | "glow" | "subtle";
export type CardPadding = "sm" | "md" | "lg";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Visual variant — `default` (full card), `panel` (lighter), `glow`, `subtle`. */
  variant?: CardVariant;
  /** Inner padding token. */
  padding?: CardPadding;
  /** Optional header slot rendered above the body. */
  header?: ReactNode;
  /** Optional footer slot rendered below the body. */
  footer?: ReactNode;
  children?: ReactNode;
}

/**
 * Card — flexible content container with optional `header` / `footer` slots.
 *
 *     <Card header={<h3>Recent activity</h3>}>
 *       …body…
 *     </Card>
 *
 *     <Card variant="panel" padding="lg" footer={<Button>View all</Button>}>
 *       …
 *     </Card>
 *
 * For granular composition use `<CardHeader>` / `<CardFooter>` directly.
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  {
    variant = "default",
    padding = "md",
    header,
    footer,
    className = "",
    children,
    ...rest
  },
  ref,
) {
  const p = getActivePreset().card;
  const cls = [p.shell, p.variants[variant], p.paddings[padding], className]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={ref} className={cls} {...rest}>
      {header ? <div className={p.header}>{header}</div> : null}
      <div className={p.body}>{children}</div>
      {footer ? <div className={p.footer}>{footer}</div> : null}
    </div>
  );
});

export interface CardHeaderProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** Title content (string or element). */
  title?: ReactNode;
  /** Subtitle / supporting text. */
  subtitle?: ReactNode;
  /** Trailing actions slot (e.g. `<Button>`). */
  actions?: ReactNode;
  children?: ReactNode;
}

/** Optional header sub-component for `<Card>` — title + actions row. */
export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  function CardHeader(
    { title, subtitle, actions, className = "", children, ...rest },
    ref,
  ) {
    const p = getActivePreset().card;
    const cls = [p.headerInline, className].filter(Boolean).join(" ");
    return (
      <div ref={ref} className={cls} {...rest}>
        {(title || subtitle) && (
          <div className={p.headerTitleColumn}>
            {title ? <div className={p.title}>{title}</div> : null}
            {subtitle ? <div className={p.subtitle}>{subtitle}</div> : null}
          </div>
        )}
        {children}
        {actions ? <div className={p.headerActions}>{actions}</div> : null}
      </div>
    );
  },
);

export interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}

/** Optional footer sub-component for `<Card>` — action row. */
export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  function CardFooter({ className = "", children, ...rest }, ref) {
    const p = getActivePreset().card;
    const cls = [p.footerInline, className].filter(Boolean).join(" ");
    return (
      <div ref={ref} className={cls} {...rest}>
        {children}
      </div>
    );
  },
);
