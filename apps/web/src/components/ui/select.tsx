"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const DEFAULT_MAX_VISIBLE_ITEMS = 80;
const DEFAULT_SEARCH_THRESHOLD = 20;

type Direction = "ltr" | "rtl";

interface SelectSharedProps {
  children?: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  dir?: Direction;
  name?: string;
  autoComplete?: string;
  disabled?: boolean;
  required?: boolean;
  form?: string;
}

interface SelectProps extends SelectSharedProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}

interface SelectOption {
  value: string;
  label: React.ReactNode;
  searchText: string;
  disabled?: boolean;
}

interface SelectContextValue {
  value?: string;
  setValue: (value: string) => void;
  disabled: boolean;
  open: boolean;
  options: SelectOption[];
}

const SelectContext = React.createContext<SelectContextValue | null>(null);

function useSelectContext(component: string): SelectContextValue {
  const context = React.useContext(SelectContext);
  if (!context) {
    throw new Error(`${component} must be used within <Select>.`);
  }
  return context;
}

function normalizeNodeText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") {
    return "";
  }
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map((entry) => normalizeNodeText(entry)).join(" ");
  }
  if (React.isValidElement(node)) {
    const props = node.props as { children?: React.ReactNode };
    return normalizeNodeText(props.children);
  }

  return "";
}

interface SelectItemProps extends React.ComponentPropsWithoutRef<"div"> {
  value: string;
  disabled?: boolean;
  textValue?: string;
}

function collectSelectOptions(children: React.ReactNode): SelectOption[] {
  const deduped = new Map<string, SelectOption>();

  const walk = (nodes: React.ReactNode) => {
    React.Children.forEach(nodes, (node) => {
      if (!React.isValidElement(node)) {
        return;
      }

      if (node.type === SelectItem) {
        const itemProps = node.props as SelectItemProps;
        const label = itemProps.children;
        const normalizedLabel = normalizeNodeText(label);
        const textValue = itemProps.textValue ?? normalizedLabel;
        const searchText = `${itemProps.value} ${textValue}`.toLowerCase();

        deduped.set(itemProps.value, {
          value: itemProps.value,
          label,
          searchText,
          disabled: itemProps.disabled
        });
        return;
      }

      const props = node.props as { children?: React.ReactNode };
      if (props.children !== undefined) {
        walk(props.children);
      }
    });
  };

  walk(children);

  return Array.from(deduped.values());
}

function Select({
  children,
  value: valueProp,
  defaultValue,
  onValueChange,
  open: openProp,
  defaultOpen,
  onOpenChange,
  name,
  disabled = false,
  required,
  form
}: SelectProps) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue);
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen ?? false);

  const value = valueProp ?? uncontrolledValue;
  const open = disabled ? false : (openProp ?? uncontrolledOpen);

  const setOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (disabled && nextOpen) {
        return;
      }
      if (openProp === undefined) {
        setUncontrolledOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
    },
    [disabled, onOpenChange, openProp]
  );

  const setValue = React.useCallback(
    (nextValue: string) => {
      if (valueProp === undefined) {
        setUncontrolledValue(nextValue);
      }
      onValueChange?.(nextValue);
      setOpen(false);
    },
    [onValueChange, setOpen, valueProp]
  );

  const options = React.useMemo(() => collectSelectOptions(children), [children]);

  return (
    <SelectContext.Provider value={{ value, setValue, disabled, open, options }}>
      <Popover open={open} onOpenChange={setOpen}>
        {name ? (
          <input
            type="hidden"
            name={name}
            value={value ?? ""}
            required={required}
            disabled={disabled}
            form={form}
          />
        ) : null}
        {children}
      </Popover>
    </SelectContext.Provider>
  );
}

const SelectValue = React.forwardRef<HTMLSpanElement, React.ComponentPropsWithoutRef<"span"> & { placeholder?: React.ReactNode }>(
  ({ className, placeholder, ...props }, ref) => {
    const { options, value } = useSelectContext("SelectValue");
    const selectedOption = options.find((option) => option.value === value);

    return (
      <span
        ref={ref}
        className={cn("block truncate whitespace-nowrap", className)}
        {...props}
      >
        {selectedOption?.label ?? placeholder}
      </span>
    );
  }
);
SelectValue.displayName = "SelectValue";

const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<"button">
>(({ className, children, disabled: disabledProp, ...props }, ref) => {
  const { disabled, open } = useSelectContext("SelectTrigger");

  return (
    <PopoverTrigger asChild>
      <button
        ref={ref}
        type="button"
        disabled={disabled || disabledProp}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 overflow-hidden rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      >
        <span className="min-w-0 flex-1">{children}</span>
        <ChevronsUpDown
          aria-hidden="true"
          className={cn("h-4 w-4 shrink-0 opacity-70 transition-transform", open ? "rotate-180" : "")}
        />
      </button>
    </PopoverTrigger>
  );
});
SelectTrigger.displayName = "SelectTrigger";

interface SelectContentProps extends React.ComponentPropsWithoutRef<typeof PopoverContent> {
  position?: "item-aligned" | "popper";
  maxVisibleItems?: number;
  searchThreshold?: number;
  searchPlaceholder?: string;
  emptyMessage?: string;
}

const SelectContent = React.forwardRef<HTMLDivElement, SelectContentProps>(
  (
    {
      className,
      align = "start",
      sideOffset = 4,
      maxVisibleItems = DEFAULT_MAX_VISIBLE_ITEMS,
      searchThreshold = DEFAULT_SEARCH_THRESHOLD,
      searchPlaceholder = "Search...",
      emptyMessage = "No options found.",
      ...props
    },
    ref
  ) => {
    const { options, open, value, setValue } = useSelectContext("SelectContent");
    const [query, setQuery] = React.useState("");

    React.useEffect(() => {
      if (!open) {
        setQuery("");
      }
    }, [open]);

    const normalizedQuery = query.trim().toLowerCase();

    const filteredOptions = React.useMemo(() => {
      if (!normalizedQuery) {
        return options;
      }

      return options.filter((option) => option.searchText.includes(normalizedQuery));
    }, [normalizedQuery, options]);

    const visibleOptions = React.useMemo(() => {
      const head = filteredOptions.slice(0, maxVisibleItems);
      if (!value || head.some((option) => option.value === value)) {
        return head;
      }

      const selectedOption = filteredOptions.find((option) => option.value === value);
      if (!selectedOption) {
        return head;
      }

      return [selectedOption, ...head.slice(0, Math.max(0, maxVisibleItems - 1))];
    }, [filteredOptions, maxVisibleItems, value]);

    const showSearch = options.length > searchThreshold;
    const hasTruncatedResults = filteredOptions.length > visibleOptions.length;

    return (
      <PopoverContent
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "w-[var(--radix-popover-trigger-width)] min-w-[8rem] p-0",
          className
        )}
        {...props}
      >
        <Command shouldFilter={false}>
          {showSearch ? (
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder={searchPlaceholder}
            />
          ) : null}
          <CommandList className="max-h-64">
            {visibleOptions.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">{emptyMessage}</p>
            ) : (
              <CommandGroup>
                {visibleOptions.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.searchText}
                    disabled={option.disabled}
                    onSelect={() => {
                      if (!option.disabled) {
                        setValue(option.value);
                      }
                    }}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        option.value === value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
        {hasTruncatedResults ? (
          <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
            Showing first {visibleOptions.length} matches. Keep typing to narrow results.
          </p>
        ) : null}
      </PopoverContent>
    );
  }
);
SelectContent.displayName = "SelectContent";

const SelectItem = React.forwardRef<HTMLDivElement, SelectItemProps>(() => null);
SelectItem.displayName = "SelectItem";

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
