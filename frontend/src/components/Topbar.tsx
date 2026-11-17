import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useOutletContext } from "react-router-dom";

export interface ShellContext {
  /** The right-hand end of the top bar, where a page puts the stepper for the span it is showing. */
  slot: HTMLElement | null;
}

/**
 * Puts a page's span control (year, month) in the shell's top bar. Rendered outside the shell
 * (a page under test, say) it simply appears in place.
 */
export function TopbarControls({ children }: { children: ReactNode }) {
  const shell = useOutletContext<ShellContext | undefined>();
  if (!shell) return <>{children}</>;
  return shell.slot ? createPortal(children, shell.slot) : null;
}
