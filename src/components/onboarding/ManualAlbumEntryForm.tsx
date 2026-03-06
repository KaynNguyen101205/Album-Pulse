import { useState } from 'react';

import type { OnboardingAlbum } from './types';
import styles from './ManualAlbumEntryForm.module.css';

type ManualAlbumEntryFormProps = {
  onAdd: (album: Pick<OnboardingAlbum, 'title' | 'artistName' | 'releaseYear' | 'coverUrl'>) => void;
};

export default function ManualAlbumEntryForm({ onAdd }: ManualAlbumEntryFormProps) {
  const [title, setTitle] = useState('');
  const [artistName, setArtistName] = useState('');
  const [releaseYear, setReleaseYear] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleAdd() {
    const trimmedTitle = title.trim();
    const trimmedArtist = artistName.trim();
    if (!trimmedTitle || !trimmedArtist) {
      setError('Title and artist are required.');
      return;
    }

    const parsedYear = Number.parseInt(releaseYear.trim(), 10);
    const normalizedYear =
      Number.isFinite(parsedYear) && parsedYear >= 1000 && parsedYear <= 9999 ? parsedYear : null;

    onAdd({
      title: trimmedTitle,
      artistName: trimmedArtist,
      releaseYear: normalizedYear,
      coverUrl: coverUrl.trim() || null,
    });

    setTitle('');
    setArtistName('');
    setReleaseYear('');
    setCoverUrl('');
    setError(null);
  }

  return (
    <section className={styles.wrap}>
      <p className={styles.label}>Add album manually</p>
      <div className={styles.grid}>
        <input
          className={styles.input}
          placeholder="Album title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <input
          className={styles.input}
          placeholder="Artist name"
          value={artistName}
          onChange={(event) => setArtistName(event.target.value)}
        />
        <input
          className={styles.input}
          placeholder="Release year (optional)"
          value={releaseYear}
          onChange={(event) => setReleaseYear(event.target.value)}
        />
        <input
          className={styles.input}
          placeholder="Cover URL (optional)"
          value={coverUrl}
          onChange={(event) => setCoverUrl(event.target.value)}
        />
      </div>
      {error ? <p className={styles.error}>{error}</p> : null}
      <button type="button" className={styles.addButton} onClick={handleAdd}>
        Add manual album
      </button>
    </section>
  );
}
