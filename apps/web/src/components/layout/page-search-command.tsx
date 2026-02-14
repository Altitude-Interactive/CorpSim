"use client";

import { useEffect, useMemo } from "react";
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
import { useControlManager, useControlShortcut } from "./control-manager";

const PAGE_SEARCH_PANEL_ID = "page-search";

export function PageSearchCommand() {
  const router = useRouter();
  const pathname = usePathname();
  const { isPanelOpen, togglePanel, closePanel } = useControlManager();
  const open = isPanelOpen(PAGE_SEARCH_PANEL_ID);

  const commandPages = useMemo(
    () => COMMAND_PAGE_NAVIGATION.filter((page) => page.href !== pathname),
    [pathname]
  );

  const shortcut = useMemo(
    () => ({
      id: "page-search-open",
      key: "k",
      modifier: "ctrlOrMeta" as const,
      allowWhenTyping: true,
      preventDefault: true,
      title: "Search pages",
      description: "Open page search",
      onTrigger: () => {
        togglePanel(PAGE_SEARCH_PANEL_ID);
      }
    }),
    [togglePanel]
  );

  useControlShortcut(shortcut);

  useEffect(() => {
    closePanel(PAGE_SEARCH_PANEL_ID);
  }, [closePanel, pathname]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      closePanel(PAGE_SEARCH_PANEL_ID);
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [closePanel, open]);

  if (!open) {
    return null;
  }

  return (
    <ToastOverlay
      backdrop="solid"
      variant="default"
      layerClassName="z-[9700] p-4 sm:p-8"
      panelClassName="max-w-2xl p-0"
      onBackdropMouseDown={() => closePanel(PAGE_SEARCH_PANEL_ID)}
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
                  closePanel(PAGE_SEARCH_PANEL_ID);
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
