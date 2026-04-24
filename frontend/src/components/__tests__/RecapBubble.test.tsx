import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RecapBubble } from '@/components/RecapBubble';

// RecapBubble must render inside an <ol> / <ul> to satisfy the HTML <li>
// nesting rule; wrap every test render for honest DOM hierarchy.
function renderBubble(ui: React.ReactNode) {
  return render(<ol>{ui}</ol>);
}

describe('<RecapBubble />', () => {
  it('renders a polite group labeled Recap', () => {
    renderBubble(
      <RecapBubble
        summary="You've connected sunlight, water, and CO2."
        conceptsRecapped={['sunlight-as-energy', 'CO2-in']}
        nextFocus="glucose output"
      />,
    );
    const group = screen.getByRole('group', { name: /progress recap/i });
    expect(group).toHaveAttribute('aria-live', 'polite');
    expect(group).toHaveAttribute('aria-atomic', 'false');
    expect(within(group).getByText(/^Recap$/i)).toBeInTheDocument();
  });

  it('shows the summary prose', () => {
    renderBubble(
      <RecapBubble summary="Short sentence one. Short sentence two." />,
    );
    expect(
      screen.getByText('Short sentence one. Short sentence two.'),
    ).toBeInTheDocument();
  });

  it('renders the concepts list when provided', () => {
    renderBubble(
      <RecapBubble
        summary="Recap prose"
        conceptsRecapped={['base case', 'recursive step']}
      />,
    );
    const items = screen.getAllByRole('listitem');
    // The outer <li> wrapper + two concept bullets.
    const bulletTexts = items.map((el) => el.textContent);
    expect(bulletTexts).toContain('base case');
    expect(bulletTexts).toContain('recursive step');
  });

  it('omits the concepts list when empty or undefined', () => {
    renderBubble(<RecapBubble summary="Just a summary" />);
    // Only the outer <li> (the bubble wrapper) should be present.
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('renders next-focus with a Next: prefix', () => {
    renderBubble(
      <RecapBubble summary="..." nextFocus="glucose production" />,
    );
    expect(screen.getByText(/Next:/)).toBeInTheDocument();
    expect(screen.getByText('glucose production')).toBeInTheDocument();
  });

  it('falls back to an italic placeholder while summary is empty and streaming', () => {
    renderBubble(<RecapBubble summary="" streaming />);
    expect(screen.getByText(/summarizing/i)).toBeInTheDocument();
    expect(screen.getByText(/streaming/i)).toBeInTheDocument();
  });
});