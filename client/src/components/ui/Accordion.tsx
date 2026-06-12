import {
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  useState,
} from "react";
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  ReactNode,
} from "react";
import { getActivePreset } from "./preset";

export type AccordionType = "single" | "multiple";

interface AccordionContextValue {
  type: AccordionType;
  open: Set<string>;
  toggle: (value: string) => void;
  baseId: string;
}

const AccordionContext = createContext<AccordionContextValue | null>(null);
const ItemContext = createContext<{ value: string } | null>(null);

function useAccordionContext(component: string): AccordionContextValue {
  const ctx = useContext(AccordionContext);
  if (!ctx) {
    throw new Error(`<${component}> must be rendered inside <Accordion>`);
  }
  return ctx;
}

function useItemContext(component: string): { value: string } {
  const ctx = useContext(ItemContext);
  if (!ctx) {
    throw new Error(`<${component}> must be rendered inside <Accordion.Item>`);
  }
  return ctx;
}

export interface AccordionProps extends HTMLAttributes<HTMLDivElement> {
  /** `single` (default) — only one item open at a time. `multiple` — any number. */
  type?: AccordionType;
  /** Controlled value(s). For type="single" pass a string; for "multiple" pass string[]. */
  value?: string | string[];
  /** Initial open value(s) — uncontrolled. */
  defaultValue?: string | string[];
  /** Fired whenever the open set changes (single → string, multiple → string[]). */
  onValueChange?: (next: string | string[]) => void;
  children?: ReactNode;
}

interface AccordionComponent {
  (props: AccordionProps): JSX.Element;
  Item: typeof AccordionItem;
  Trigger: typeof AccordionTrigger;
  Panel: typeof AccordionPanel;
}

function toSet(v: string | string[] | undefined): Set<string> {
  if (v === undefined) return new Set();
  if (typeof v === "string") return v ? new Set([v]) : new Set();
  return new Set(v);
}

function AccordionRoot({
  type = "single",
  value: controlledValue,
  defaultValue,
  onValueChange,
  className = "",
  children,
  ...rest
}: AccordionProps) {
  const isControlled = controlledValue !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = useState<Set<string>>(() =>
    toSet(defaultValue),
  );
  const open = isControlled ? toSet(controlledValue) : uncontrolledOpen;
  const baseId = useId();

  const toggle = useCallback(
    (val: string) => {
      const next = new Set(open);
      const wasOpen = next.has(val);
      if (type === "single") {
        next.clear();
        if (!wasOpen) next.add(val);
      } else {
        if (wasOpen) next.delete(val);
        else next.add(val);
      }
      if (!isControlled) setUncontrolledOpen(next);
      if (onValueChange) {
        if (type === "single") {
          onValueChange(next.size ? Array.from(next)[0] : "");
        } else {
          onValueChange(Array.from(next));
        }
      }
    },
    [open, type, isControlled, onValueChange],
  );

  const ctx = useMemo<AccordionContextValue>(
    () => ({ type, open, toggle, baseId }),
    [type, open, toggle, baseId],
  );

  const p = getActivePreset().accordion;
  const cls = [p.shell, className].filter(Boolean).join(" ");

  return (
    <AccordionContext.Provider value={ctx}>
      <div className={cls} {...rest}>
        {children}
      </div>
    </AccordionContext.Provider>
  );
}

export interface AccordionItemProps extends HTMLAttributes<HTMLDivElement> {
  /** Item value — must be unique inside this Accordion. */
  value: string;
  children?: ReactNode;
}

export function AccordionItem({
  value: itemValue,
  className = "",
  children,
  ...rest
}: AccordionItemProps) {
  const ctx = useAccordionContext("Accordion.Item");
  const isOpen = ctx.open.has(itemValue);
  const p = getActivePreset().accordion;
  const cls = [p.item, className].filter(Boolean).join(" ");
  return (
    <ItemContext.Provider value={{ value: itemValue }}>
      <div className={cls} data-open={isOpen} {...rest}>
        {children}
      </div>
    </ItemContext.Provider>
  );
}

export interface AccordionTriggerProps
  extends Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    "type" | "aria-expanded" | "aria-controls" | "id"
  > {
  children?: ReactNode;
}

export function AccordionTrigger({
  className = "",
  onClick,
  children,
  ...rest
}: AccordionTriggerProps) {
  const ctx = useAccordionContext("Accordion.Trigger");
  const item = useItemContext("Accordion.Trigger");
  const isOpen = ctx.open.has(item.value);
  const triggerId = `${ctx.baseId}-trigger-${item.value}`;
  const panelId = `${ctx.baseId}-panel-${item.value}`;

  const p = getActivePreset().accordion;
  const cls = [p.trigger, isOpen ? p.triggerOpen : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      {...rest}
      type="button"
      id={triggerId}
      aria-expanded={isOpen}
      aria-controls={panelId}
      className={cls}
      onClick={(e) => {
        ctx.toggle(item.value);
        onClick?.(e);
      }}
    >
      <span className={p.summary}>{children}</span>
      <span aria-hidden="true" className={p.icon}>
        {isOpen ? "−" : "+"}
      </span>
    </button>
  );
}

export interface AccordionPanelProps extends HTMLAttributes<HTMLDivElement> {
  /** Force render even when collapsed (default: unmounts when closed). */
  forceMount?: boolean;
  children?: ReactNode;
}

export function AccordionPanel({
  forceMount = false,
  className = "",
  children,
  ...rest
}: AccordionPanelProps) {
  const ctx = useAccordionContext("Accordion.Panel");
  const item = useItemContext("Accordion.Panel");
  const isOpen = ctx.open.has(item.value);
  const triggerId = `${ctx.baseId}-trigger-${item.value}`;
  const panelId = `${ctx.baseId}-panel-${item.value}`;

  const p = getActivePreset().accordion;
  const cls = [p.panel, className].filter(Boolean).join(" ");

  if (!isOpen && !forceMount) return null;

  return (
    <div
      role="region"
      id={panelId}
      aria-labelledby={triggerId}
      hidden={!isOpen}
      className={cls}
      {...rest}
    >
      {children}
    </div>
  );
}

export const Accordion = AccordionRoot as AccordionComponent;
Accordion.Item = AccordionItem;
Accordion.Trigger = AccordionTrigger;
Accordion.Panel = AccordionPanel;
