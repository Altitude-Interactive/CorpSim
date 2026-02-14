"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useUiSfx } from "@/components/layout/ui-sfx-provider";

export function UiSfxSettings() {
  const { snapshot, play, unlock, setEnabled, setVolume } = useUiSfx();
  const [isOpen, setIsOpen] = useState(false);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (!wasOpen.current && isOpen) {
      play("ui_open");
    }
    if (wasOpen.current && !isOpen) {
      play("ui_close");
    }
    wasOpen.current = isOpen;
  }, [isOpen, play]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" aria-label="UI sound settings">
          {snapshot.enabled ? (
            <Volume2 className="h-3.5 w-3.5" />
          ) : (
            <VolumeX className="h-3.5 w-3.5" />
          )}
          <span className="ml-2 hidden md:inline">Sound</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3">
        <div className="space-y-3">
          <p className="text-sm font-semibold">UI Sounds</p>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>Enabled</span>
            <input
              type="checkbox"
              checked={snapshot.enabled}
              onChange={(event) => {
                const enabled = event.target.checked;
                setEnabled(enabled);
                if (enabled) {
                  void unlock().then((didUnlock) => {
                    if (didUnlock) {
                      play("feedback_success", { volumeMultiplier: 0.6 });
                    }
                  });
                }
              }}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-2 block">Volume: {Math.round(snapshot.volume * 100)}%</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(snapshot.volume * 100)}
              onChange={(event) => {
                const value = Number.parseInt(event.target.value, 10);
                setVolume(value / 100);
                if (snapshot.enabled) {
                  play("feedback_neutral", {
                    volumeMultiplier: 0.6,
                    throttleMs: 180
                  });
                }
              }}
              className="w-full"
              disabled={!snapshot.enabled}
            />
          </label>
          {snapshot.isUnlocked ? (
            <p className="text-xs text-emerald-300">Audio unlocked</p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Audio is locked until browser interaction allows playback.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  void unlock();
                }}
              >
                Unlock Audio
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
