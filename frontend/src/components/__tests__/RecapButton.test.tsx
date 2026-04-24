import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { RecapButton } from '@/components/RecapButton';

describe('<RecapButton />', () => {
  it('is disabled and explains why when no concepts are earned', async () => {
    const onRecap = vi.fn();
    render(<RecapButton onRecap={onRecap} earnedCount={0} />);
    const btn = screen.getByRole('button', { name: /recap so far/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('title', expect.stringMatching(/unlock/i));
    await userEvent.click(btn);
    expect(onRecap).not.toHaveBeenCalled();
  });

  it('is enabled after the first earned concept', async () => {
    const onRecap = vi.fn();
    render(<RecapButton onRecap={onRecap} earnedCount={1} />);
    const btn = screen.getByRole('button', { name: /recap so far/i });
    expect(btn).toBeEnabled();
    await userEvent.click(btn);
    expect(onRecap).toHaveBeenCalledOnce();
  });

  it('respects the external disabled prop (streaming guard)', async () => {
    const onRecap = vi.fn();
    render(<RecapButton onRecap={onRecap} earnedCount={3} disabled />);
    const btn = screen.getByRole('button', { name: /recap so far/i });
    expect(btn).toBeDisabled();
    await userEvent.click(btn);
    expect(onRecap).not.toHaveBeenCalled();
  });
});