import type { AnalyticsEventPayload } from '@/types/weekly-drop';

function canUseBeacon(payload: AnalyticsEventPayload): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function' && !!payload;
}

export async function trackEvent(payload: AnalyticsEventPayload): Promise<void> {
  const body = JSON.stringify(payload);

  try {
    if (canUseBeacon(payload)) {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon('/api/analytics/events', blob);
      return;
    }

    await fetch('/api/analytics/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
      keepalive: true,
    });
  } catch {
    // Analytics should never break user flows.
  }
}
