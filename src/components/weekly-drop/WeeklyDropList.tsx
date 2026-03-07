import type { WeeklyDropFeedbackPatch, WeeklyDropItem } from '@/types/weekly-drop';
import WeeklyDropAlbumCard, {
  type WeeklyDropSaveState,
} from './WeeklyDropAlbumCard';
import styles from './WeeklyDropList.module.css';

type WeeklyDropListProps = {
  items: WeeklyDropItem[];
  itemSaveState: Record<string, WeeklyDropSaveState>;
  itemSaveError: Record<string, string | null>;
  onPatchFeedback: (
    itemId: string,
    patch: WeeklyDropFeedbackPatch,
    meta?: { eventName?: string; metadata?: Record<string, unknown> }
  ) => void;
  onCardInteract: (item: WeeklyDropItem) => void;
};

export default function WeeklyDropList({
  items,
  itemSaveState,
  itemSaveError,
  onPatchFeedback,
  onCardInteract,
}: WeeklyDropListProps) {
  return (
    <section className={styles.grid} aria-live="polite">
      {items.map((item) => (
        <WeeklyDropAlbumCard
          key={item.id}
          item={item}
          saveState={itemSaveState[item.id] ?? 'idle'}
          saveError={itemSaveError[item.id] ?? null}
          onPatchFeedback={onPatchFeedback}
          onCardInteract={onCardInteract}
        />
      ))}
    </section>
  );
}
