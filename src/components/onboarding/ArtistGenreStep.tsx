import { useState } from 'react';

import styles from './ArtistGenreStep.module.css';

type ArtistGenreStepProps = {
  artists: string[];
  genres: string[];
  onArtistsChange: (values: string[]) => void;
  onGenresChange: (values: string[]) => void;
};

function ChipList({
  values,
  onRemove,
}: {
  values: string[];
  onRemove: (value: string) => void;
}) {
  if (values.length === 0) return <p className={styles.helper}>No preferences added.</p>;

  return (
    <div className={styles.chips}>
      {values.map((value) => (
        <button
          key={value}
          type="button"
          className={styles.chip}
          onClick={() => onRemove(value)}
          aria-label={`Remove ${value}`}
        >
          {value} ×
        </button>
      ))}
    </div>
  );
}

export default function ArtistGenreStep({
  artists,
  genres,
  onArtistsChange,
  onGenresChange,
}: ArtistGenreStepProps) {
  const [artistInput, setArtistInput] = useState('');
  const [genreInput, setGenreInput] = useState('');

  function addArtist() {
    const value = artistInput.trim();
    if (!value || artists.includes(value)) return;
    onArtistsChange([...artists, value]);
    setArtistInput('');
  }

  function addGenre() {
    const value = genreInput.trim();
    if (!value || genres.includes(value)) return;
    onGenresChange([...genres, value]);
    setGenreInput('');
  }

  return (
    <section className={styles.wrap}>
      <div className={styles.block}>
        <h3 className={styles.title}>Favorite artists (optional)</h3>
        <div className={styles.inputRow}>
          <input
            className={styles.input}
            placeholder="Add artist"
            value={artistInput}
            onChange={(event) => setArtistInput(event.target.value)}
          />
          <button type="button" className={styles.addButton} onClick={addArtist}>
            Add
          </button>
        </div>
        <ChipList values={artists} onRemove={(value) => onArtistsChange(artists.filter((v) => v !== value))} />
      </div>

      <div className={styles.block}>
        <h3 className={styles.title}>Favorite genres (optional)</h3>
        <div className={styles.inputRow}>
          <input
            className={styles.input}
            placeholder="Add genre"
            value={genreInput}
            onChange={(event) => setGenreInput(event.target.value)}
          />
          <button type="button" className={styles.addButton} onClick={addGenre}>
            Add
          </button>
        </div>
        <ChipList values={genres} onRemove={(value) => onGenresChange(genres.filter((v) => v !== value))} />
      </div>
    </section>
  );
}
