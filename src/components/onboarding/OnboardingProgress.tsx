import styles from './OnboardingProgress.module.css';

type OnboardingProgressProps = {
  currentStep: number;
  totalSteps: number;
};

export default function OnboardingProgress({ currentStep, totalSteps }: OnboardingProgressProps) {
  const safeCurrent = Math.min(Math.max(currentStep, 1), totalSteps);

  return (
    <section className={styles.wrap} aria-label="Onboarding progress">
      <p className={styles.label}>
        Step {safeCurrent} of {totalSteps}
      </p>
      <div className={styles.track}>
        <div
          className={styles.fill}
          style={{ width: `${(safeCurrent / totalSteps) * 100}%` }}
        />
      </div>
    </section>
  );
}
