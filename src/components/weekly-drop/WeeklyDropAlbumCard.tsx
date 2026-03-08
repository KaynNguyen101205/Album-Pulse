'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';

import type { WeeklyDropFeedbackPatch, WeeklyDropItem } from '@/types/weekly-drop';
import AlreadyListenedToggle from './AlreadyListenedToggle';
import ErrorBanner from './ErrorBanner';
import FeedbackActions from './FeedbackActions';
import NotInterestedInput from './NotInterestedInput';
import RatingInput from './RatingInput';
import RecommendationReason from './RecommendationReason';
import ReviewInput from './ReviewInput';
import styles from './WeeklyDropAlbumCard.module.css';

export type WeeklyDropSaveState = 'idle' | 'saving' | 'saved' | 'error';

type WeeklyDropAlbumCardProps = {
  item: WeeklyDropItem;
  saveState?: WeeklyDropSaveState;
  saveError?: string | null;
  onPatchFeedback: (
    itemId: string,
    patch: WeeklyDropFeedbackPatch,
    meta?: { eventName?: string; metadata?: Record<string, unknown> }
  ) => void;
  onCardInteract?: (item: WeeklyDropItem) => void;
};

function normalizeInput(value: string): string | null {
  const normalized = value.trim();
  return normalized ? normalized : null;
}

export default function WeeklyDropAlbumCard({
  item,
  saveState = 'idle',
  saveError = null,
  onPatchFeedback,
  onCardInteract,
}: WeeklyDropAlbumCardProps) {
  const [reviewDraft, setReviewDraft] = useState(item.feedback.reviewText ?? '');
  const [notesDraft, setNotesDraft] = useState(item.feedback.listenedNotes ?? '');
  const [notInterestedOtherDraft, setNotInterestedOtherDraft] = useState(
    item.feedback.notInterestedOtherText ?? ''
  );

  useEffect(() => {
    setReviewDraft(item.feedback.reviewText ?? '');
  }, [item.id, item.feedback.reviewText]);

  useEffect(() => {
    setNotesDraft(item.feedback.listenedNotes ?? '');
  }, [item.id, item.feedback.listenedNotes]);

  useEffect(() => {
    setNotInterestedOtherDraft(item.feedback.notInterestedOtherText ?? '');
  }, [item.id, item.feedback.notInterestedOtherText]);

  useEffect(() => {
    const serverValue = normalizeInput(item.feedback.reviewText ?? '');
    const localValue = normalizeInput(reviewDraft);
    if (serverValue === localValue) return;

    const timeoutId = window.setTimeout(() => {
      onPatchFeedback(
        item.id,
        { reviewText: localValue },
        {
          eventName: 'weekly_drop_review_submit',
          metadata: { rank: item.rank },
        }
      );
    }, 700);

    return () => window.clearTimeout(timeoutId);
  }, [reviewDraft, item.id, item.feedback.reviewText, item.rank, onPatchFeedback]);

  useEffect(() => {
    if (item.feedback.alreadyListened !== true) return;
    const serverValue = normalizeInput(item.feedback.listenedNotes ?? '');
    const localValue = normalizeInput(notesDraft);
    if (serverValue === localValue) return;

    const timeoutId = window.setTimeout(() => {
      onPatchFeedback(item.id, { listenedNotes: localValue }, { metadata: { rank: item.rank } });
    }, 700);

    return () => window.clearTimeout(timeoutId);
  }, [notesDraft, item.feedback.alreadyListened, item.feedback.listenedNotes, item.id, item.rank, onPatchFeedback]);

  useEffect(() => {
    if (item.feedback.notInterestedReason !== 'OTHER') return;
    const serverValue = normalizeInput(item.feedback.notInterestedOtherText ?? '');
    const localValue = normalizeInput(notInterestedOtherDraft);
    if (serverValue === localValue) return;

    const timeoutId = window.setTimeout(() => {
      onPatchFeedback(
        item.id,
        {
          notInterestedReason: 'OTHER',
          notInterestedOtherText: localValue,
        },
        {
          eventName: 'weekly_drop_not_interested_submit',
          metadata: { rank: item.rank, reason: 'OTHER', trigger: 'debounce' },
        }
      );
    }, 700);

    return () => window.clearTimeout(timeoutId);
  }, [
    item.feedback.notInterestedReason,
    item.feedback.notInterestedOtherText,
    item.id,
    item.rank,
    notInterestedOtherDraft,
    onPatchFeedback,
  ]);

  const activeTags = useMemo(
    () => item.album.tags.filter((tag) => typeof tag === 'string' && tag.trim() !== ''),
    [item.album.tags]
  );

  function handleReviewBlur() {
    const localValue = normalizeInput(reviewDraft);
    const serverValue = normalizeInput(item.feedback.reviewText ?? '');
    if (localValue === serverValue) return;
    onPatchFeedback(
      item.id,
      { reviewText: localValue },
      { eventName: 'weekly_drop_review_submit', metadata: { rank: item.rank, trigger: 'blur' } }
    );
  }

  function handleNotesBlur() {
    const localValue = normalizeInput(notesDraft);
    const serverValue = normalizeInput(item.feedback.listenedNotes ?? '');
    if (localValue === serverValue) return;
    onPatchFeedback(item.id, { listenedNotes: localValue }, { metadata: { rank: item.rank, trigger: 'blur' } });
  }

  function handleNotInterestedOtherBlur() {
    if (item.feedback.notInterestedReason !== 'OTHER') return;
    const localValue = normalizeInput(notInterestedOtherDraft);
    const serverValue = normalizeInput(item.feedback.notInterestedOtherText ?? '');
    if (localValue === serverValue) return;
    onPatchFeedback(
      item.id,
      {
        notInterestedReason: 'OTHER',
        notInterestedOtherText: localValue,
      },
      {
        eventName: 'weekly_drop_not_interested_submit',
        metadata: { rank: item.rank, reason: 'OTHER', trigger: 'blur' },
      }
    );
  }

  return (
    <article
      className={styles.card}
      onClick={() => onCardInteract?.(item)}
      data-saving-state={saveState}
    >
      <div className={styles.coverWrap}>
        {item.album.coverUrl ? (
          <Image
            className={styles.cover}
            src={item.album.coverUrl}
            alt={`${item.album.title} cover`}
            width={256}
            height={256}
            unoptimized
          />
        ) : (
          <div className={styles.coverFallback}>No Cover</div>
        )}
        <span className={styles.rank}>#{item.rank}</span>
      </div>

      <div className={styles.body}>
        <h2 className={styles.title}>{item.album.title}</h2>
        <p className={styles.artist}>{item.album.artistName}</p>

        <div className={styles.meta}>
          <span>{item.album.releaseYear ?? 'Unknown year'}</span>
          {activeTags.length > 0 ? <span>• {activeTags.join(' • ')}</span> : null}
        </div>

        <RecommendationReason reason={item.whyRecommended} />

        <FeedbackActions
          liked={item.feedback.liked === true}
          disliked={item.feedback.disliked === true}
          saved={item.feedback.saved === true}
          skipped={item.feedback.skipped === true}
          disabled={saveState === 'saving'}
          onLike={() =>
            onPatchFeedback(
              item.id,
              { liked: item.feedback.liked === true ? null : true },
              { eventName: 'weekly_drop_like_dislike', metadata: { action: 'like', rank: item.rank } }
            )
          }
          onDislike={() =>
            onPatchFeedback(
              item.id,
              { disliked: item.feedback.disliked === true ? null : true },
              { eventName: 'weekly_drop_like_dislike', metadata: { action: 'dislike', rank: item.rank } }
            )
          }
          onSave={() =>
            onPatchFeedback(
              item.id,
              { saved: item.feedback.saved === true ? false : true },
              { eventName: 'weekly_drop_save_action', metadata: { rank: item.rank } }
            )
          }
          onSkip={() =>
            onPatchFeedback(
              item.id,
              { skipped: item.feedback.skipped === true ? null : true },
              { eventName: 'weekly_drop_skip_action', metadata: { rank: item.rank } }
            )
          }
        />

        <RatingInput
          value={item.feedback.rating}
          disabled={saveState === 'saving'}
          onChange={(value) =>
            onPatchFeedback(
              item.id,
              { rating: value },
              { eventName: 'weekly_drop_rating_submit', metadata: { rating: value, rank: item.rank } }
            )
          }
          onClear={() => onPatchFeedback(item.id, { rating: null }, { metadata: { rank: item.rank } })}
        />

        <ReviewInput
          value={reviewDraft}
          disabled={saveState === 'saving'}
          onChange={setReviewDraft}
          onBlur={handleReviewBlur}
        />

        <AlreadyListenedToggle
          checked={item.feedback.alreadyListened === true}
          notes={notesDraft}
          disabled={saveState === 'saving'}
          onToggle={(checked) => {
            onPatchFeedback(item.id, { alreadyListened: checked, listenedNotes: checked ? normalizeInput(notesDraft) : null });
          }}
          onNotesChange={setNotesDraft}
          onNotesBlur={handleNotesBlur}
        />

        <NotInterestedInput
          itemId={item.id}
          reason={item.feedback.notInterestedReason}
          otherText={notInterestedOtherDraft}
          disabled={saveState === 'saving'}
          onReasonChange={(reason) => {
            if (reason !== 'OTHER') {
              setNotInterestedOtherDraft('');
            }
            onPatchFeedback(
              item.id,
              {
                notInterestedReason: reason,
                notInterestedOtherText:
                  reason === 'OTHER' ? normalizeInput(notInterestedOtherDraft) : null,
              },
              {
                eventName: 'weekly_drop_not_interested_submit',
                metadata: { rank: item.rank, reason: reason ?? 'NONE', trigger: 'select' },
              }
            );
          }}
          onOtherTextChange={setNotInterestedOtherDraft}
          onOtherTextBlur={handleNotInterestedOtherBlur}
        />

        <p className={styles.saveStatus}>
          {saveState === 'saving'
            ? 'Saving...'
            : saveState === 'saved'
              ? 'Saved'
              : saveState === 'error'
                ? 'Failed to save'
                : '\u00a0'}
        </p>

        {saveError ? <ErrorBanner message={saveError} /> : null}
      </div>
    </article>
  );
}
