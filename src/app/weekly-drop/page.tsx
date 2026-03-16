'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import EmptyState from '@/components/EmptyState';
import ErrorNotice from '@/components/ErrorNotice';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import WeeklyDropList from '@/components/weekly-drop/WeeklyDropList';
import type { WeeklyDropSaveState } from '@/components/weekly-drop/WeeklyDropAlbumCard';
import { trackEvent } from '@/lib/analytics/client';
import { applyFeedbackPatchState } from '@/lib/weekly-drop/feedback-state';
import {
  fetchCurrentWeeklyDrop,
  patchWeeklyDropFeedback,
} from '@/lib/weekly-drop/client';
import type { WeeklyDrop, WeeklyDropFeedbackPatch, WeeklyDropItem } from '@/types/weekly-drop';
import styles from './page.module.css';

type LoadState = 'loading' | 'success' | 'empty' | 'error';

function mergePatch(
  current: WeeklyDropFeedbackPatch | undefined,
  incoming: WeeklyDropFeedbackPatch
): WeeklyDropFeedbackPatch {
  return { ...(current ?? {}), ...incoming };
}

export default function WeeklyDropPage() {
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [drop, setDrop] = useState<WeeklyDrop | null>(null);
  const [items, setItems] = useState<WeeklyDropItem[]>([]);
  const [itemSaveState, setItemSaveState] = useState<Record<string, WeeklyDropSaveState>>({});
  const [itemSaveError, setItemSaveError] = useState<Record<string, string | null>>({});

  const inFlightRef = useRef<Set<string>>(new Set());
  const queuedPatchRef = useRef<Map<string, WeeklyDropFeedbackPatch>>(new Map());
  const saveTimerRef = useRef<Map<string, number>>(new Map());

  const setSaveStateForItem = useCallback((itemId: string, state: WeeklyDropSaveState) => {
    setItemSaveState((prev) => ({ ...prev, [itemId]: state }));
  }, []);

  const clearSaveTimer = useCallback((itemId: string) => {
    const timer = saveTimerRef.current.get(itemId);
    if (timer) {
      window.clearTimeout(timer);
      saveTimerRef.current.delete(itemId);
    }
  }, []);

  const [hasFavoritesFromApi, setHasFavoritesFromApi] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const loadCurrentDrop = useCallback(async () => {
    setLoadState('loading');
    setErrorMessage(null);

    try {
      const { drop: currentDrop, hasFavorites } = await fetchCurrentWeeklyDrop();
      setHasFavoritesFromApi(hasFavorites);
      if (!currentDrop) {
        setDrop(null);
        setItems([]);
        setLoadState('empty');
        return;
      }

      setDrop(currentDrop);
      setItems(currentDrop.items);
      setLoadState('success');
      setGenerateError(null);
      void trackEvent({
        eventName: 'weekly_drop_page_view',
        weeklyDropId: currentDrop.id,
        metadata: { itemCount: currentDrop.items.length },
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to load weekly drop.'
      );
      setLoadState('error');
    }
  }, []);

  const [generateError, setGenerateError] = useState<string | null>(null);

  const generateDrop = useCallback(async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch('/api/recommendations/refresh', { method: 'POST', cache: 'no-store' });
      const data = (await res.json()) as { ok?: boolean; error?: string; message?: string };
      await loadCurrentDrop();
      if (!data.ok || data.error) {
        setGenerateError(data.message ?? data.error ?? 'Could not generate drop.');
      }
    } catch {
      setGenerateError('Request failed. Try again.');
      await loadCurrentDrop();
    } finally {
      setIsGenerating(false);
    }
  }, [isGenerating, loadCurrentDrop]);

  useEffect(() => {
    void loadCurrentDrop();
  }, [loadCurrentDrop]);

  useEffect(() => {
    const timerMap = saveTimerRef.current;
    return () => {
      timerMap.forEach((timer) => window.clearTimeout(timer));
      timerMap.clear();
    };
  }, []);

  const persistPatch = useCallback(
    async (itemId: string, patch: WeeklyDropFeedbackPatch) => {
      inFlightRef.current.add(itemId);
      clearSaveTimer(itemId);
      setSaveStateForItem(itemId, 'saving');
      setItemSaveError((prev) => ({ ...prev, [itemId]: null }));

      try {
        const feedback = await patchWeeklyDropFeedback(itemId, patch);
        setItems((prev) =>
          prev.map((item) => (item.id === itemId ? { ...item, feedback } : item))
        );
        setSaveStateForItem(itemId, 'saved');
        const timeoutId = window.setTimeout(() => {
          setSaveStateForItem(itemId, 'idle');
          saveTimerRef.current.delete(itemId);
        }, 1400);
        saveTimerRef.current.set(itemId, timeoutId);
      } catch (error) {
        setSaveStateForItem(itemId, 'error');
        setItemSaveError((prev) => ({
          ...prev,
          [itemId]: error instanceof Error ? error.message : 'Failed to save feedback.',
        }));
      } finally {
        inFlightRef.current.delete(itemId);
        const queued = queuedPatchRef.current.get(itemId);
        if (queued) {
          queuedPatchRef.current.delete(itemId);
          void persistPatch(itemId, queued);
        }
      }
    },
    [clearSaveTimer, setSaveStateForItem]
  );

  const queuePatch = useCallback(
    (itemId: string, patch: WeeklyDropFeedbackPatch) => {
      if (inFlightRef.current.has(itemId)) {
        queuedPatchRef.current.set(
          itemId,
          mergePatch(queuedPatchRef.current.get(itemId), patch)
        );
        return;
      }
      void persistPatch(itemId, patch);
    },
    [persistPatch]
  );

  const handlePatchFeedback = useCallback(
    (
      itemId: string,
      patch: WeeklyDropFeedbackPatch,
      meta?: { eventName?: string; metadata?: Record<string, unknown> }
    ) => {
      const currentItem = items.find((item) => item.id === itemId);
      if (!currentItem) return;
      const computed = applyFeedbackPatchState(currentItem.feedback, patch);
      if (!computed.changed) return;

      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? {
                ...item,
                feedback: {
                  ...computed.next,
                  updatedAt: item.feedback.updatedAt,
                },
              }
            : item
        )
      );

      if (meta?.eventName) {
        void trackEvent({
          eventName: meta.eventName,
          weeklyDropId: drop?.id ?? null,
          weeklyDropItemId: itemId,
          metadata: {
            ...(meta.metadata ?? {}),
            rank: currentItem.rank,
          },
        });
      }

      queuePatch(itemId, patch);
    },
    [drop?.id, items, queuePatch]
  );

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Weekly Drop</h1>
        <p className={styles.subtitle}>
          Five personalized album picks for this week. React quickly and we&apos;ll adapt future drops.
        </p>
        <Link className={styles.historyLink} href="/weekly-drop/history">
          View History
        </Link>
      </header>

      {loadState === 'loading' ? (
        <LoadingSkeleton count={5} />
      ) : loadState === 'error' ? (
        <ErrorNotice
          className={styles.errorWrap}
          message={errorMessage ?? 'Failed to load weekly drop.'}
          onRetry={loadCurrentDrop}
        />
      ) : loadState === 'empty' ? (
        <section className={styles.emptyWrap}>
          {generateError && (
            <p className={styles.generateError} role="alert">
              {generateError}
            </p>
          )}
          <EmptyState
            title="Next drop not ready yet"
            message={
              hasFavoritesFromApi
                ? "Generate your weekly hidden-gem picks from your favorite albums. If generation failed (e.g. no similar albums in catalog), add more favorites or try again."
                : "Weekly Drop is built from your favorite albums. Complete onboarding or add more favorites, then generate your first drop."
            }
          />
          {hasFavoritesFromApi && (
            <button
              type="button"
              className={styles.generateButton}
              onClick={generateDrop}
              disabled={isGenerating}
            >
              {isGenerating ? 'Generating…' : 'Generate my drop'}
            </button>
          )}
          <nav className={styles.emptyStateLinks} aria-label="Get started">
            {!hasFavoritesFromApi && (
              <Link href="/onboarding" className={styles.emptyStateLink}>
                Complete onboarding
              </Link>
            )}
            <Link href="/favorites/add" className={styles.emptyStateLink}>
              Add favorite albums
            </Link>
          </nav>
        </section>
      ) : (
        <WeeklyDropList
          items={items}
          itemSaveState={itemSaveState}
          itemSaveError={itemSaveError}
          onPatchFeedback={handlePatchFeedback}
          onCardInteract={(item) => {
            void trackEvent({
              eventName: 'weekly_drop_album_card_interact',
              weeklyDropId: drop?.id ?? null,
              weeklyDropItemId: item.id,
              metadata: { rank: item.rank, albumId: item.album.id },
            });
          }}
        />
      )}
    </main>
  );
}
