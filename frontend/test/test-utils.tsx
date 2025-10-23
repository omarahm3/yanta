import React from "react";
import { render } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { HotkeyProvider } from "../src/contexts/HotkeyContext";

export function renderWithHotkeys(
  ui: ReactElement,
  options?: Parameters<typeof render>[1],
) {
  return render(<HotkeyProvider>{ui}</HotkeyProvider>, options);
}

export function renderWithWrapper(
  ui: ReactElement,
  wrapper: ({ children }: { children: ReactNode }) => JSX.Element,
  options?: Parameters<typeof render>[1],
) {
  const Wrapper = wrapper;
  return render(<Wrapper>{ui}</Wrapper>, options);
}
