import styles from './ErrorBanner.module.css';

type ErrorBannerProps = {
  message: string;
};

export default function ErrorBanner({ message }: ErrorBannerProps) {
  return (
    <p className={styles.banner} role="alert">
      {message}
    </p>
  );
}
