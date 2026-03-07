import styles from './RecommendationReason.module.css';

type RecommendationReasonProps = {
  reason: string;
};

export default function RecommendationReason({ reason }: RecommendationReasonProps) {
  return (
    <p className={styles.reason}>
      <span className={styles.label}>Why recommended:</span> {reason}
    </p>
  );
}
