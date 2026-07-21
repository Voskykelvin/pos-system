import { formatUsd } from './formatters';

export default function PlanPackaging({ plans }) {
  return (
    <section className="panel">
      <div className="panelHeader">
        <h2>Plan packaging</h2>
        <span>Current tiers</span>
      </div>
      <div className="planGrid">
        {plans.map((plan) => (
          <article className="planCard" key={plan.id}>
            <div className="planTopline">
              <span className={`planBadge ${plan.id}`}>{plan.name}</span>
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
