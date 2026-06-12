export { Breadcrumb, type Crumb, type BreadcrumbProps } from "./Breadcrumb";
export { useBreadcrumbs } from "./useBreadcrumbs";
export { PageContainer, type PageContainerProps } from "./PageContainer";
export { Button, type ButtonProps } from "./Button";
export { SearchInput, type SearchInputProps } from "./SearchInput";
export {
  FilterSelect,
  type FilterSelectProps,
  type FilterOption,
} from "./FilterSelect";
export { Pagination, type PaginationProps } from "./Pagination";
export { FormField, type FormFieldProps } from "./FormField";
export {
  DataTable,
  type Column,
  type RowAction,
  type FilterDef,
  type DataTableProps,
} from "./DataTable";

// Public-surface primitives (E168) — outer shell + marketing/static blocks.
export { PublicLayout, type PublicLayoutProps } from "./PublicLayout";
export { NavBar, type NavBarProps, type NavBarLink } from "./NavBar";
export { Footer, type FooterProps, type FooterLink } from "./Footer";
export { HeroSection, type HeroSectionProps } from "./HeroSection";
export {
  FeatureGrid,
  FeatureCard,
  type FeatureGridProps,
  type FeatureCardProps,
} from "./FeatureGrid";
export { Section, type SectionProps } from "./Section";
export { CTABanner, type CTABannerProps } from "./CTABanner";
export { Prose, type ProseProps } from "./Prose";
export { EmptyState, type EmptyStateProps } from "./EmptyState";

// Modular skin / preset system — swap the entire visual style without
// touching any primitive. See `docs/design/design.md` § "Swapping the
// visual preset" for the recipe.
export {
  type Preset,
  type ButtonPreset,
  type TablePreset,
  type PaginationPreset,
  type BreadcrumbPreset,
  type SearchInputPreset,
  type FilterSelectPreset,
  type FormFieldPreset,
  type PageContainerPreset,
  type PublicLayoutPreset,
  type NavBarPreset,
  type FooterPreset,
  type HeroSectionPreset,
  type FeatureGridPreset,
  type SectionPreset,
  type CTABannerPreset,
  type ProsePreset,
  type EmptyStatePreset,
  type AuthLayoutPreset,
  type AuthCardPreset,
  type DividerLabelPreset,
  type BannerPreset,
  defaultPreset,
  getActivePreset,
  setActivePreset,
  resetActivePreset,
} from "./preset";
// Brand presets — re-export from `presets/` (E179) to avoid the circular
// import that would happen if `preset.ts` itself re-exported them.
export { compactPreset } from "./presets/compact";
export { editorialPreset } from "./presets/editorial";
export { densePreset } from "./presets/dense";

// E169 — auth surface primitives
export { AuthLayout, type AuthLayoutProps } from "./AuthLayout";
export { AuthCard, type AuthCardProps } from "./AuthCard";
export { DividerLabel, type DividerLabelProps } from "./DividerLabel";
export { Banner, type BannerProps, type BannerVariant } from "./Banner";
export { PasswordField, type PasswordFieldProps } from "./PasswordField";
export { SocialButtons, type SocialButtonsProps } from "./SocialButtons";

// E173 — form primitives
export { TextInput, type TextInputProps } from "./TextInput";
export { TextArea, type TextAreaProps } from "./TextArea";
export { NumberInput, type NumberInputProps } from "./NumberInput";
export {
  Select,
  type SelectProps,
  type SelectOption,
} from "./Select";
export { Checkbox, type CheckboxProps } from "./Checkbox";
export {
  RadioGroup,
  type RadioGroupProps,
  type RadioOption,
} from "./RadioGroup";
export { Toggle, type ToggleProps } from "./Toggle";
export {
  type TextInputPreset,
  type TextAreaPreset,
  type NumberInputPreset,
  type SelectPreset,
  type CheckboxPreset,
  type RadioGroupPreset,
  type TogglePreset,
} from "./preset";

// E174 — overlay primitives
export { Modal, type ModalProps, type ModalSize } from "./Modal";
export { Drawer, type DrawerProps, type DrawerSide } from "./Drawer";
export {
  ToastProvider,
  useToast,
  type ToastProviderProps,
  type ToastOptions,
  type ToastVariant,
} from "./Toast";
export {
  type ModalPreset,
  type DrawerPreset,
  type ToastPreset,
} from "./preset";

// E175 — dashboard chrome primitives
export { DropdownMenu, type DropdownMenuProps } from "./DropdownMenu";
export { NavItem, type NavItemProps } from "./NavItem";
export {
  type DropdownMenuPreset,
  type NavItemPreset,
} from "./preset";

// E178 — layout primitives
export {
  Card,
  CardHeader,
  CardFooter,
  type CardProps,
  type CardHeaderProps,
  type CardFooterProps,
  type CardVariant,
  type CardPadding,
} from "./Card";
export {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsPanel,
  type TabsProps,
  type TabsListProps,
  type TabsTriggerProps,
  type TabsPanelProps,
} from "./Tabs";
export {
  Stack,
  HStack,
  VStack,
  type StackProps,
  type StackDirection,
  type StackGap,
  type StackAlign,
  type StackJustify,
} from "./Stack";
export { Disclosure, type DisclosureProps } from "./Disclosure";
export {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionPanel,
  type AccordionProps,
  type AccordionItemProps,
  type AccordionTriggerProps,
  type AccordionPanelProps,
  type AccordionType,
} from "./Accordion";
export {
  type CardPreset,
  type TabsPreset,
  type StackPreset,
  type DisclosurePreset,
  type AccordionPreset,
} from "./preset";
