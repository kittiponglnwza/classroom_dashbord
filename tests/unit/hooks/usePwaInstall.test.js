import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { usePwaInstall } from '../../../src/hooks/usePwaInstall';

describe('usePwaInstall', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults to canInstall=false and isInstalled=false', () => {
    const { result } = renderHook(() => usePwaInstall());

    expect(result.current.canInstall).toBe(false);
    expect(result.current.isInstalled).toBe(false);
  });

  it('sets canInstall=true when beforeinstallprompt fires', () => {
    const { result } = renderHook(() => usePwaInstall());

    const promptEvent = new Event('beforeinstallprompt');
    promptEvent.preventDefault = vi.fn();
    promptEvent.prompt = vi.fn();
    promptEvent.userChoice = Promise.resolve({ outcome: 'dismissed' });

    act(() => {
      window.dispatchEvent(promptEvent);
    });

    expect(promptEvent.preventDefault).toHaveBeenCalledTimes(1);
    expect(result.current.canInstall).toBe(true);
  });

  it('invokes prompt() on promptInstall and resets canInstall when accepted', async () => {
    const { result } = renderHook(() => usePwaInstall());

    const promptEvent = new Event('beforeinstallprompt');
    promptEvent.preventDefault = vi.fn();
    promptEvent.prompt = vi.fn().mockResolvedValue(undefined);
    promptEvent.userChoice = Promise.resolve({ outcome: 'accepted' });

    act(() => {
      window.dispatchEvent(promptEvent);
    });

    expect(result.current.canInstall).toBe(true);

    let accepted;
    await act(async () => {
      accepted = await result.current.promptInstall();
    });

    expect(promptEvent.prompt).toHaveBeenCalledTimes(1);
    expect(accepted).toBe(true);
    expect(result.current.canInstall).toBe(false);
  });

  it('sets isInstalled=true and canInstall=false when appinstalled fires', () => {
    const { result } = renderHook(() => usePwaInstall());

    const promptEvent = new Event('beforeinstallprompt');
    promptEvent.preventDefault = vi.fn();
    promptEvent.prompt = vi.fn();
    promptEvent.userChoice = Promise.resolve({ outcome: 'dismissed' });

    act(() => {
      window.dispatchEvent(promptEvent);
    });
    expect(result.current.canInstall).toBe(true);

    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });

    expect(result.current.isInstalled).toBe(true);
    expect(result.current.canInstall).toBe(false);
  });
});
