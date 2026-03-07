'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import EmptyState from '@/components/EmptyState';
import ErrorNotice from '@/components/ErrorNotice';
import WeeklyDropHistoryDetail from '@/components/weekly-drop/WeeklyDropHistoryDetail';
import WeeklyDropHistoryList from '@/components/weekly-drop/WeeklyDropHistoryList';
import { trackEvent } from '@/lib/analytics/client';
import {
  fetchWeeklyDropHistory,
  fetchWeeklyDropHistoryDetail,
} from '@/lib/weekly-drop/client';
import type { WeeklyDrop, WeeklyDropHistoryEntry } from '@/types/weekly-drop';
import styles from './page.module.css';

type LoadState = 'loading' | 'success' | 'empty' | 'error';

export default function WeeklyDropHistoryPage() {
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [entries, setEntries] = useState<WeeklyDropHistoryEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const [selectedDropId, setSelectedDropId] = useState<string | null>(null);
  const [detail, setDetail] = useState<WeeklyDrop | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setLoadState('loading');
    setErrorMessage(null);

    try {
      const result = await fetchWeeklyDropHistory({ limit: 10 });
      setEntries(result.entries);
      setNextCursor(result.nextCursor);

      if (result.entries.length === 0) {
        setSelectedDropId(null);
        setDetail(null);
        setLoadState('empty');
        return;
      }

      const firstId = result.entries[0].id;
      setSelectedDropId(firstId);
      setLoadState('success');
      void trackEvent({
        eventName: 'weekly_drop_history_view',
        metadata: { itemCount: result.entries.length },
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to load history.'
      );
      setLoadState('error');
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const loadDetail = useCallback(async (dropId: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const payload = await fetchWeeklyDropHistoryDetail(dropId);
      setDetail(payload);
    } catch (error) {
      setDetail(null);
      setDetailError(error instanceof Error ? error.message : 'Failed to load history detail.');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedDropId) return;
    void loadDetail(selectedDropId);
  }, [loadDetail, selectedDropId]);

  async function handleLoadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await fetchWeeklyDropHistory({ cursor: nextCursor, limit: 10 });
      setEntries((prev) => [...prev, ...result.entries]);
      setNextCursor(result.nextCursor);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load more history.');
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Weekly Drop History</h1>
        <p className={styles.subtitle}>
          Review your past weekly drops and the feedback you saved for each album.
        </p>
        <Link className={styles.backLink} href="/weekly-drop">
          Back to Current Drop
        </Link>
      </header>

      {loadState === 'loading' ? (
        <section className={styles.stateBox} aria-busy="true">
          Loading history...
        </section>
      ) : loadState === 'error' ? (
        <ErrorNotice
          className={styles.errorWrap}
          message={errorMessage ?? 'Failed to load history.'}
          onRetry={loadHistory}
        />
      ) : loadState === 'empty' ? (
        <section className={styles.emptyWrap}>
          <EmptyState
            title="No history available"
            message="Your past weekly drops will appear here once at least one week has passed."
          />
        </section>
      ) : (
        <section className={styles.layout}>
          <WeeklyDropHistoryList
            entries={entries}
            selectedDropId={selectedDropId}
            hasMore={Boolean(nextCursor)}
            isLoadingMore={loadingMore}
            onSelectDrop={setSelectedDropId}
            onLoadMore={handleLoadMore}
          />

          <div className={styles.detailWrap}>
            {detailLoading ? (
              <section className={styles.stateBox} aria-busy="true">
                Loading selected drop...
              </section>
            ) : detailError ? (
              <ErrorNotice
                className={styles.errorWrap}
                message={detailError}
                onRetry={() => (selectedDropId ? loadDetail(selectedDropId) : Promise.resolve())}
              />
            ) : detail ? (
              <WeeklyDropHistoryDetail drop={detail} />
            ) : (
              <section className={styles.stateBox}>Select a drop to view details.</section>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
