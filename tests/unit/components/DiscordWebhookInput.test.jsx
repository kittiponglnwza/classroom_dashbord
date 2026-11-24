import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DiscordWebhookInput from '../../../src/components/DiscordWebhookInput';

const VALID_WEBHOOK = 'https://discord.com/api/webhooks/1234567890123/AbCdEfGhIjKlMnOpQrStUvWxYz1234';

describe('DiscordWebhookInput', () => {
  it('shows masked token preview for a valid webhook instead of full raw secret or dot wall', () => {
    render(<DiscordWebhookInput id="wh-1" value={VALID_WEBHOOK} onChange={vi.fn()} lang="en" />);

    const preview = screen.getByTestId('discord-webhook-masked-preview');
    expect(preview).toHaveTextContent('https://discord.com/api/webhooks/1234567890123/AbCd••••••••1234');
    expect(preview.textContent).not.toContain('EfGhIjKl');

    fireEvent.click(screen.getByRole('button', { name: 'Reveal full URL' }));
    expect(preview).toHaveTextContent(VALID_WEBHOOK);

    fireEvent.click(screen.getByRole('button', { name: 'Hide full URL' }));
    expect(preview).toHaveTextContent('AbCd••••••••1234');
  });

  it('switches to editable input on preview click and clears cleanly via Clear button', () => {
    function Harness() {
      const [val, setVal] = useState(VALID_WEBHOOK);
      return <DiscordWebhookInput id="wh-2" value={val} onChange={setVal} lang="en" />;
    }

    render(<Harness />);
    expect(screen.getByTestId('discord-webhook-masked-preview')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear Webhook URL' }));
    const input = screen.getByPlaceholderText(/https:\/\/discord\.com\/api\/webhooks/i);
    expect(input.value).toBe('');
    expect(screen.queryByTestId('discord-webhook-masked-preview')).toBeNull();
  });
});
