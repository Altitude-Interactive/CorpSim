"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from "@/components/ui/command";
import { ToastOverlay } from "@/components/ui/toast-manager";
import { COMMAND_PAGE_NAVIGATION } from "@/lib/page-navigation";
import { useControlShortcut } from "./control-manager";

export function PageSearchCommand() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const commandPages = useMemo(
    () => COMMAND_PAGE_NAVIGATION.filter((page) => page.href !== pathname),
    [pathname]
  );

  const toggleOpen = useCallback(() => {
    setOpen((previous) => !previous);
  }, []);

  const shortcut = useMemo(
    () => ({
      id: "page-search-open",
      key: "k",
      modifier: "ctrlOrMeta" as const,
      allowWhenTyping: true,
      preventDefault: true,
      onTrigger: toggleOpen
    }),
    [toggleOpen]
  );

  useControlShortcut(shortcut);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      setOpen(false);
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <ToastOverlay
      backdrop="solid"
      variant="default"
      layerClassName="z-[9700] p-4 sm:p-8"
      panelClassName="max-w-2xl p-0"
      onBackdropMouseDown={() => setOpen(false)}
      labelledBy="page-search-title"
      describedBy="page-search-description"
    >
      <div className="sr-only">
        <h2 id="page-search-title">Page search</h2>
        <p id="page-search-description">Search and open pages.</p>
      </div>
      <Command label="Page search" className="rounded-2xl bg-card">
        <CommandInput autoFocus placeholder="Search pages..." />
        <CommandList className="max-h-[48vh]">
          <CommandEmpty>No pages found.</CommandEmpty>
          <CommandGroup heading="Pages">
            {commandPages.map((page) => (
              <CommandItem
                key={page.href}
                value={`${page.label} ${page.href}`}
                keywords={page.keywords}
                onSelect={() => {
                  setOpen(false);
                  router.push(page.href);
                }}
              >
                <span>{page.label}</span>
                <span className="ml-auto text-xs text-muted-foreground">{page.href}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
        <div className="border-t border-border px-3 py-2 text-right text-xs text-muted-foreground">
          Esc to close
        </div>
      </Command>
    </ToastOverlay>
  );
}
