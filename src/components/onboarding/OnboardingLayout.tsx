import styles from './OnboardingLayout.module.css';

type OnboardingLayoutProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

export default function OnboardingLayout({ title, subtitle, children }: OnboardingLayoutProps) {
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <header className={styles.header}>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.subtitle}>{subtitle}</p>
        </header>
        {children}
      </section>
    </main>
  );
}
