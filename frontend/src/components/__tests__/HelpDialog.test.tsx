import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { HelpDialog } from '@/components/HelpDialog';

function open(props: Partial<Parameters<typeof HelpDialog>[0]> = {}) {
  return render(
    <HelpDialog
      voiceSupported
      sttSupported
      ttsSupported
      {...props}
    />,
  );
}

describe('<HelpDialog />', () => {
  it('keeps the dialog content closed until the trigger is clicked', () => {
    open();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens with keyboard + voice sections when activated', async () => {
    const user = userEvent.setup();
    open();
    await user.click(screen.getByRole('button', { name: /keyboard shortcuts and voice commands/i }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent(/keyboard/i);
    expect(dialog).toHaveTextContent(/voice commands/i);
  });

  it('lists every voice intent label and at least one phrase variant', async () => {
    const user = userEvent.setup();
    open();
    await user.click(screen.getByRole('button', { name: /keyboard shortcuts and voice commands/i }));

    const labels = [
      'Recap so far',
      'Send',
      'Slow pacing',
      'Normal pacing',
      'Read aloud',
      'Stop reading',
      'Stop',
      'Minimize UI',
      'Restore UI',
    ];
    for (const label of labels) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    // Spot-check a phrase from each grammar entry rendered with quote marks.
    expect(screen.getByText(/"recap"/i)).toBeInTheDocument();
    expect(screen.getByText(/"stop reading"/i)).toBeInTheDocument();
  });

  it('marks Shift+V row unsupported when voiceSupported=false', async () => {
    const user = userEvent.setup();
    open({ voiceSupported: false, sttSupported: false });
    await user.click(screen.getByRole('button', { name: /keyboard shortcuts and voice commands/i }));

    expect(
      screen.getAllByText(/not available in this browser/i).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(/voice commands aren't available in this browser/i),
    ).toBeInTheDocument();
  });

  it('marks the K row unsupported when ttsSupported=false', async () => {
    const user = userEvent.setup();
    open({ ttsSupported: false });
    await user.click(screen.getByRole('button', { name: /keyboard shortcuts and voice commands/i }));

    const dialog = screen.getByRole('dialog');
    // Find the row for K and assert it has the unsupported tag.
    const kbd = dialog.querySelectorAll('kbd');
    const kRow = Array.from(kbd).find((el) => el.textContent === 'K');
    expect(kRow).toBeTruthy();
    const row = kRow!.closest('li');
    expect(row).toHaveTextContent(/not available in this browser/i);
  });
});