import styles from './FinishOnboardingButton.module.css';

type FinishOnboardingButtonProps = {
  disabled: boolean;
  isSubmitting?: boolean;
  onClick: () => void;
};

export default function FinishOnboardingButton({
  disabled,
  isSubmitting = false,
  onClick,
}: FinishOnboardingButtonProps) {
  return (
    <button
      type="button"
      className={styles.button}
      onClick={onClick}
      disabled={disabled || isSubmitting}
    >
      {isSubmitting ? 'Finishing...' : 'Finish onboarding'}
    </button>
  );
}
