import { formatUsd } from './formatters';

export default function PlanPackaging({ plans }) {
  return (
    <section className="panel">
      <div className="panelHeader">
        <h2>Plan packaging</h2>
        <span>{plans.length} tiers</span>
      </div>
      <div className="planGrid">
        {plans.map((plan) => (
          <article className={`planCard planCardTone-${plan.id}`} key={plan.id}>
            <div className="planTopline">
              <span className={`planBadge ${plan.id}`}>{plan.name}</span>
              <strong>{formatUsd(plan.priceUsd)}<span className="planPeriod">/mo</span></strong>
            </div>
            <p className="planSummary">{plan.featureSummary}</p>
            <ul className="planFeatureList">
              {plan.features.slice(0, 4).map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
