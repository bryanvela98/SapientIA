import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

type RenderOptions = { initialPath?: string };

// Thin wrapper: most routed components need MemoryRouter to mount in tests.
// Kept separate from `render` so tests can still use the bare version for
// components that don't depend on routing.
export function renderWithRouter(
  ui: ReactElement,
  { initialPath = '/' }: RenderOptions = {},
) {
  return render(<MemoryRouter initialEntries={[initialPath]}>{ui}</MemoryRouter>);
}