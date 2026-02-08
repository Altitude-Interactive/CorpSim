"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { useActiveCompany } from "./active-company-provider";

export function ActiveCompanyCombobox() {
  const { showToast } = useToast();
  const { companies, activeCompany, activeCompanyId, setActiveCompanyId, isLoading } = useActiveCompany();
  const [open, setOpen] = React.useState(false);

  const copyActiveCompanyId = async () => {
    if (!activeCompany) {
      return;
    }

    try {
      await navigator.clipboard.writeText(activeCompany.id);
      showToast({
        title: "Company ID copied",
        description: activeCompany.id,
        variant: "success"
      });
    } catch {
      showToast({
        title: "Copy failed",
        description: "Clipboard permission denied.",
        variant: "error"
      });
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} className="w-72 justify-between">
            <span className="truncate">
              {isLoading
                ? "Loading companies..."
                : activeCompany
                  ? `${activeCompany.code} - ${activeCompany.name}`
                  : "Select company"}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0">
          <Command>
            <CommandInput placeholder="Search company..." />
            <CommandList>
              <CommandEmpty>No companies found.</CommandEmpty>
              <CommandGroup>
                {companies.map((company) => (
                  <CommandItem
                    key={company.id}
                    value={`${company.code} ${company.name} ${company.id}`}
                    onSelect={() => {
                      setActiveCompanyId(company.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        activeCompanyId === company.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="truncate text-sm">{company.code}</span>
                      <span className="truncate text-xs text-muted-foreground">{company.name}</span>
                      {company.isBot ? <Badge variant="warning">Bot</Badge> : null}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {activeCompany?.isBot ? <Badge variant="warning">Bot</Badge> : null}
      <Button
        variant="outline"
        size="icon"
        onClick={() => {
          void copyActiveCompanyId();
        }}
        disabled={!activeCompany}
        title="Copy active company ID"
      >
        <Copy className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
