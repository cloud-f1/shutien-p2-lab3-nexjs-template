import {
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  KeyboardEvent,
  ReactNode,
} from "react";
import { getActivePreset } from "./preset";

interface TabsContextValue {
  value: string;
  setValue: (next: string) => void;
  /** Stable id prefix used to build aria-controls / aria-labelledby links. */
  baseId: string;
  /** Triggers register here so arrow-key navigation can move focus across them. */
  registerTrigger: (value: string, el: HTMLButtonElement | null) => void;
  /** Ordered list of registered trigger values for keyboard navigation. */
  orderedValues: React.MutableRefObject<string[]>;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext(component: string): TabsContextValue {
  const ctx = useContext(TabsContext);
  if (!ctx) {
    throw new Error(`<${component}> must be rendered inside <Tabs>`);
  }
  return ctx;
}

export interface TabsProps extends HTMLAttributes<HTMLDivElement> {
  /** Controlled active tab value. */
  value?: string;
  /** Initial active tab (uncontrolled). */
  defaultValue?: string;
  /** Fired whenever the active tab changes. */
  onValueChange?: (next: string) => void;
  children?: ReactNode;
}

interface TabsComponent {
  (props: TabsProps): JSX.Element;
  List: typeof TabsList;
  Trigger: typeof TabsTrigger;
  Panel: typeof TabsPanel;
}

/**
 * Tabs — compound component implementing the WAI-ARIA APG tabs pattern.
 *
 *     <Tabs defaultValue="profile">
 *       <Tabs.List>
 *         <Tabs.Trigger value="profile">Profile</Tabs.Trigger>
 *         <Tabs.Trigger value="security">Security</Tabs.Trigger>
 *       </Tabs.List>
 *       <Tabs.Panel value="profile">…</Tabs.Panel>
 *       <Tabs.Panel value="security">…</Tabs.Panel>
 *     </Tabs>
 *
 * Keyboard:
 *   - ArrowLeft / ArrowRight cycle triggers (wraps).
 *   - Home / End jump to first / last trigger.
 *   - Activates on focus (manual = no Enter required), matching APG default.
 */
function TabsRoot({
  value: controlledValue,
  defaultValue,
  onValueChange,
  className = "",
  children,
  ...rest
}: TabsProps) {
  const isControlled = controlledValue !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = useState<string>(
    defaultValue ?? "",
  );
  const value = isControlled ? (controlledValue as string) : uncontrolledValue;
  const baseId = useId();
  const orderedValues = useRef<string[]>([]);
  const triggerNodes = useRef<Map<string, HTMLButtonElement>>(new Map());

  const setValue = useCallback(
    (next: string) => {
      if (!isControlled) setUncontrolledValue(next);
      onValueChange?.(next);
    },
    [isControlled, onValueChange],
  );

  const registerTrigger = useCallback(
    (val: string, el: HTMLButtonElement | null) => {
      if (el) {
        triggerNodes.current.set(val, el);
        if (!orderedValues.current.includes(val)) {
          orderedValues.current.push(val);
        }
      } else {
        triggerNodes.current.delete(val);
        orderedValues.current = orderedValues.current.filter((v) => v !== val);
      }
    },
    [],
  );

  const ctx = useMemo<TabsContextValue>(
    () => ({ value, setValue, baseId, registerTrigger, orderedValues }),
    [value, setValue, baseId, registerTrigger],
  );

  const p = getActivePreset().tabs;
  const cls = [p.shell, className].filter(Boolean).join(" ");

  return (
    <TabsContext.Provider value={ctx}>
      <div className={cls} {...rest}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export interface TabsListProps extends HTMLAttributes<HTMLDivElement> {
  /** Accessible label for the tablist (overrides default). */
  ariaLabel?: string;
  children?: ReactNode;
}

export function TabsList({
  ariaLabel,
  className = "",
  children,
  ...rest
}: TabsListProps) {
  const p = getActivePreset().tabs;
  const cls = [p.list, className].filter(Boolean).join(" ");
  return (
    <div role="tablist" aria-label={ariaLabel} className={cls} {...rest}>
      {children}
    </div>
  );
}

export interface TabsTriggerProps
  extends Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    "value" | "role" | "aria-selected" | "aria-controls" | "id"
  > {
  /** Tab value — must match the corresponding `<Tabs.Panel value="…">`. */
  value: string;
  children?: ReactNode;
}

export function TabsTrigger({
  value: triggerValue,
  className = "",
  onClick,
  onKeyDown,
  disabled,
  children,
  ...rest
}: TabsTriggerProps) {
  const ctx = useTabsContext("Tabs.Trigger");
  const ref = useRef<HTMLButtonElement | null>(null);
  const setRef = useCallback(
    (el: HTMLButtonElement | null) => {
      ref.current = el;
      ctx.registerTrigger(triggerValue, el);
    },
    [ctx, triggerValue],
  );

  const isActive = ctx.value === triggerValue;
  const triggerId = `${ctx.baseId}-trigger-${triggerValue}`;
  const panelId = `${ctx.baseId}-panel-${triggerValue}`;

  function focusByOffset(offset: number) {
    const ordered = ctx.orderedValues.current;
    if (ordered.length === 0) return;
    const idx = ordered.indexOf(triggerValue);
    if (idx === -1) return;
    const nextIdx = (idx + offset + ordered.length) % ordered.length;
    const nextVal = ordered[nextIdx];
    ctx.setValue(nextVal);
    // Trigger ids are stable across renders; focusing directly avoids
    // racing async ticks in tests and matches the WAI-ARIA APG pattern
    // where Tab focus follows selection.
    const el = document.getElementById(
      `${ctx.baseId}-trigger-${nextVal}`,
    ) as HTMLButtonElement | null;
    el?.focus();
  }

  function focusBy(target: "first" | "last") {
    const ordered = ctx.orderedValues.current;
    if (ordered.length === 0) return;
    const nextVal = target === "first" ? ordered[0] : ordered[ordered.length - 1];
    ctx.setValue(nextVal);
    const el = document.getElementById(
      `${ctx.baseId}-trigger-${nextVal}`,
    ) as HTMLButtonElement | null;
    el?.focus();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      focusByOffset(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusByOffset(-1);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusBy("first");
    } else if (e.key === "End") {
      e.preventDefault();
      focusBy("last");
    }
    onKeyDown?.(e);
  }

  const p = getActivePreset().tabs;
  const cls = [
    p.trigger,
    isActive ? p.triggerActive : p.triggerInactive,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      {...rest}
      ref={setRef}
      type="button"
      role="tab"
      id={triggerId}
      aria-selected={isActive}
      aria-controls={panelId}
      tabIndex={isActive ? 0 : -1}
      disabled={disabled}
      className={cls}
      onClick={(e) => {
        if (!disabled) ctx.setValue(triggerValue);
        onClick?.(e);
      }}
      onKeyDown={handleKeyDown}
    >
      {children}
    </button>
  );
}

export interface TabsPanelProps extends HTMLAttributes<HTMLDivElement> {
  /** Panel value — matches `<Tabs.Trigger value="…">`. */
  value: string;
  /** Force render the panel content even when inactive (default false — unmounts). */
  forceMount?: boolean;
  children?: ReactNode;
}

export function TabsPanel({
  value: panelValue,
  forceMount = false,
  className = "",
  children,
  ...rest
}: TabsPanelProps) {
  const ctx = useTabsContext("Tabs.Panel");
  const isActive = ctx.value === panelValue;
  const triggerId = `${ctx.baseId}-trigger-${panelValue}`;
  const panelId = `${ctx.baseId}-panel-${panelValue}`;

  const p = getActivePreset().tabs;
  const cls = [p.panel, className].filter(Boolean).join(" ");

  if (!isActive && !forceMount) return null;

  return (
    <div
      role="tabpanel"
      id={panelId}
      aria-labelledby={triggerId}
      hidden={!isActive}
      tabIndex={0}
      className={cls}
      {...rest}
    >
      {children}
    </div>
  );
}

export const Tabs = TabsRoot as TabsComponent;
Tabs.List = TabsList;
Tabs.Trigger = TabsTrigger;
Tabs.Panel = TabsPanel;
