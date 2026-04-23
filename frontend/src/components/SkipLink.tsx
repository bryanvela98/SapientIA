import type { ReactNode } from 'react';

/**
 * Visually-hidden anchor that reveals on focus. Should be the first
 * focusable element on a route so Tab from page load reaches it
 * immediately — keyboard users can bypass the header and jump to the
 * route's main interactive surface.
 */
export function SkipLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-background focus:text-foreground focus:px-4 focus:py-2 focus:ring-2 focus:ring-ring focus:outline-none focus:shadow-lg"
    >
      {children}
    </a>
  );
}