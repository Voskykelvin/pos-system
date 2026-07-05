import styles from '../SuperAdmin.module.css';
import { formatUsd } from './formatters';

export default function PlanPackaging({ plans }) {
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2>Plan packaging</h2>
        <span>Current tiers</span>
      </div>
      <div className={styles.planGrid}>
        {plans.map((plan) => (
          <article className={styles.planCard} key={plan.id}>
            <div className={styles.planTopline}>
              <span className={`${styles.planBadge} ${styles[plan.id]}`}>{plan.name}</span>
              <strong>{formatUsd(plan.priceUsd)} / mo</strong>
            </div>
            <p>{plan.featureSummary}</p>
            <ul>
              {plan.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
