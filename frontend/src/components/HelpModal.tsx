import React, { useEffect } from "react";
import { useHelp } from "../hooks/useHelp";
import { useHotkeyContext } from "../contexts/HotkeyContext";

const formatHotkeyDisplay = (key: string): string => {
  return key
    .replace(/mod/gi, "Ctrl")
    .replace(/shift/gi, "Shift")
    .replace(/alt/gi, "Alt")
    .replace(/meta/gi, "Meta")
    .replace(/\+/g, "+")
    .split("+")
    .map((part) => {
      const keyMap: Record<string, string> = {
        Escape: "ESC",
        " ": "SPACE",
        Enter: "ENTER",
        Tab: "TAB",
        ArrowUp: "↑",
        ArrowDown: "↓",
        ArrowLeft: "←",
        ArrowRight: "→",
      };
      return keyMap[part] || part.toUpperCase();
    })
    .join("+");
};

export const HelpModal: React.FC = () => {
  const { isOpen, closeHelp, pageCommands, pageName } = useHelp();
  const { getRegisteredHotkeys } = useHotkeyContext();

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "?") {
        e.preventDefault();
        closeHelp();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, closeHelp]);

  if (!isOpen) return null;

  const allHotkeys = pageName === "SETTINGS"
    ? []
    : getRegisteredHotkeys()
        .filter((h) => h.description && h.description !== "Toggle help")
        .sort((a, b) => (a.description ?? "").localeCompare(b.description ?? ""));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={closeHelp}
    >
      <div
        className="relative w-full max-w-4xl max-h-[85vh] mx-4 sm:mx-6 overflow-hidden bg-surface border-2 border-accent/30 rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{
          boxShadow:
            "0 20px 40px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(88, 166, 255, 0.2)",
        }}
      >
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 sm:py-5 border-b border-border/40">
          <h2 className="text-lg sm:text-xl font-bold tracking-wide text-accent">
            HELP
          </h2>
          <div className="text-xs text-text-dim font-mono hidden sm:block">
            Press <span className="text-accent font-semibold">ESC</span> or{" "}
            <span className="text-accent font-semibold">?</span> to close
          </div>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(85vh-80px)]">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 xl:gap-8">
            {pageCommands.length > 0 && (
              <div>
                <h3 className="mb-4 sm:mb-6 text-sm font-bold tracking-wider text-text-dim uppercase">
                  {pageName} COMMANDS
                </h3>
                <div className="space-y-3 sm:space-y-4">
                  {pageCommands.map((cmd, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 sm:gap-4 font-mono text-sm group"
                    >
                      <div className="flex-shrink-0">
                        <code className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-bg border border-accent/20 rounded-md text-accent font-medium transition-all duration-200 group-hover:border-accent/40 group-hover:bg-accent/5 text-xs sm:text-sm">
                          {cmd.command}
                        </code>
                      </div>
                      <div className="flex-1 pt-0.5 sm:pt-1 text-text leading-relaxed text-xs sm:text-sm">
                        {cmd.description}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {allHotkeys.length > 0 && (
              <div>
                <h3 className="mb-4 sm:mb-6 text-sm font-bold tracking-wider text-text-dim uppercase">
                  KEYBOARD SHORTCUTS
                </h3>
                <div className="space-y-3 sm:space-y-4">
                  {allHotkeys.map((hotkey) => (
                    <div
                      key={hotkey.id}
                      className="flex items-start gap-3 sm:gap-4 font-mono text-sm group"
                    >
                      <div className="flex-shrink-0">
                        <code className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-bg border border-purple/20 rounded-md text-purple font-medium transition-all duration-200 group-hover:border-purple/40 group-hover:bg-purple/5 text-xs sm:text-sm">
                          {formatHotkeyDisplay(hotkey.key)}
                        </code>
                      </div>
                      <div className="flex-1 pt-0.5 sm:pt-1 text-text leading-relaxed text-xs sm:text-sm">
                        {hotkey.description}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {pageCommands.length === 0 && allHotkeys.length === 0 && (
            <div className="py-12 px-6 text-center">
              {pageName === "SETTINGS" ? (
                <div className="space-y-4">
                  <div className="text-6xl">🤔</div>
                  <div className="text-lg font-semibold text-text">
                    Looking for keyboard shortcuts?
                  </div>
                  <div className="text-text-dim">
                    They're literally right there on the page! ↓
                  </div>
                  <div className="text-sm text-text-dim/70 italic">
                    (Scroll up if you can't see them)
                  </div>
                </div>
              ) : (
                <div className="text-text-dim">
                  No help available for this page.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
