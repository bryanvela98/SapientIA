import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { VoiceCommandBanner } from '@/components/VoiceCommandBanner';

describe('<VoiceCommandBanner />', () => {
  it('renders nothing while idle', () => {
    const { container } = render(
      <VoiceCommandBanner state="idle" lastIntent={null} lastError={null} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the listening prompt with assertive live-region while listening', () => {
    render(
      <VoiceCommandBanner state="listening" lastIntent={null} lastError={null} />,
    );
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'assertive');
    expect(region).toHaveAttribute('data-voice-state', 'listening');
    expect(region).toHaveTextContent(/voice command/i);
  });

  it('shows the parsed label after a match', () => {
    render(
      <VoiceCommandBanner
        state="parsed"
        lastIntent={{ type: 'recap' }}
        lastError={null}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(/heard.*recap so far/i);
  });

  it('shows a check + label on dispatched', () => {
    render(
      <VoiceCommandBanner
        state="dispatched"
        lastIntent={{ type: 'minimize-on' }}
        lastError={null}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(/✓.*minimize ui/i);
  });

  it('shows the help list on no-match error', () => {
    render(
      <VoiceCommandBanner state="error" lastIntent={null} lastError="no-match" />,
    );
    const region = screen.getByRole('status');
    expect(region).toHaveTextContent(/didn't catch that/i);
    expect(region).toHaveTextContent(/recap, send, slow down/i);
  });

  it('shows the recognizer error message verbatim on a non-no-match error', () => {
    render(
      <VoiceCommandBanner
        state="error"
        lastIntent={null}
        lastError="STT error: not-allowed"
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('STT error: not-allowed');
  });
});