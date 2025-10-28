import React from "react";
import { SettingsSection, Toggle } from "../../components/ui";
import { SystemInfo } from "../../types";

interface GeneralSectionProps {
  systemInfo: SystemInfo | null;
  keepInBackground: boolean;
  startHidden: boolean;
  onKeepInBackgroundToggle: (enabled: boolean) => void;
  onStartHiddenToggle: (enabled: boolean) => void;
}

export const GeneralSection = React.forwardRef<
  HTMLDivElement,
  GeneralSectionProps
>(
  (
    {
      systemInfo,
      keepInBackground,
      startHidden,
      onKeepInBackgroundToggle,
      onStartHiddenToggle,
    },
    ref,
  ) => {
    const isLinux = systemInfo?.app.platform.includes("linux");

    return (
      <div ref={ref}>
        <SettingsSection
          title="General"
          subtitle="Application behavior settings"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-text">
                  Keep running in background when closed
                </div>
                <div className="text-xs text-text-dim">
                  When enabled, closing the window will hide YANTA instead of
                  quitting. Press Ctrl+Shift+Y anywhere to restore the window.
                  {isLinux && (
                    <span className="text-yellow-400">
                      {" "}
                      (Not available on Linux)
                    </span>
                  )}
                </div>
              </div>
              <Toggle
                checked={keepInBackground}
                onChange={onKeepInBackgroundToggle}
                disabled={isLinux}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-text">
                  Start hidden in background
                </div>
                <div className="text-xs text-text-dim">
                  When enabled, YANTA will start hidden. Press Ctrl+Shift+Y to
                  show it. Requires "Keep running in background" to be enabled.
                  {isLinux && (
                    <span className="text-yellow-400">
                      {" "}
                      (Not available on Linux)
                    </span>
                  )}
                </div>
              </div>
              <Toggle
                checked={startHidden}
                onChange={onStartHiddenToggle}
                disabled={!keepInBackground || isLinux}
              />
            </div>
          </div>
        </SettingsSection>
      </div>
    );
  },
);

GeneralSection.displayName = "GeneralSection";
