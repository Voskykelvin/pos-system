# Incident Response

This runbook covers application, database, payment, fiscal, and offline-sync incidents. Preserve financial evidence: never delete, rewrite, or silently reconcile orders, payments, refunds, stock ledgers, eTIMS records, or callback events during recovery.

## Severity and ownership

- **SEV-1:** checkout unavailable, suspected compromise, data loss, duplicate financial writes, or widespread payment corruption. Stop risky writes, notify the product owner immediately, and maintain an incident timeline.
- **SEV-2:** major workflow degraded, readiness failing, growing M-Pesa/eTIMS exception queues, or one store unable to trade. Assign an incident lead and update stakeholders at least hourly.
- **SEV-3:** isolated defect with a safe workaround and no financial-integrity risk. Track normally, but retain request IDs and affected record IDs.

## First response

1. Record start time, reporter, environment, release commit, affected tenants, and symptoms.
2. Capture evidence with `npm run ops:snapshot -- --base-url https://your-service.example`. Set `METRICS_TOKEN` in the operator shell for metrics. Do not commit generated snapshots.
3. Check `/api/live`, `/api/ready`, structured service logs, deployment events, database health, and the most recent migration.
4. Contain the problem. Disable the affected integration or scheduler where possible; do not broadly disable transactional guards.
5. For a bad release, roll back application code only after confirming that its database migrations are backward compatible. Restore a database only for proven data loss, never as a routine code rollback.

## Payment and fiscal handling

- M-Pesa amount mismatches, callback errors, and unmatched callbacks remain quarantined for manager review. Compare the Daraja transaction, payment, order, callback payload hash, and request ID before resolving.
- Do not mark a payment confirmed merely because the customer presents an SMS. Verify against the provider account.
- eTIMS failures remain in the durable queue. Do not invent CU invoice numbers or retransmit a transmitted invoice. Use a credit note for fiscal reversals.
- A store without configured fiscal identity should not generate an eTIMS queue; validate its tenant configuration before changing queue records.

## Backup and recovery

Create a custom-format PostgreSQL archive and checksum metadata:

```bash
DATABASE_URL=postgresql://... npm run db:backup -- --output backups/jijenge.dump
npm run db:verify-backup -- --file backups/jijenge.dump
```

Archive verification proves checksum and archive readability. A real restore drill requires a disposable, empty PostgreSQL database:

```bash
BACKUP_VERIFY_DATABASE_URL=postgresql://... npm run db:verify-backup -- --file backups/jijenge.dump
```

The drill restores the archive and verifies migration history plus critical order, payment, and inventory tables. Never point `BACKUP_VERIFY_DATABASE_URL` at production. Encrypt backups at rest, restrict access, and test retention/deletion against business and legal requirements.

## Recovery and closure

Verify checkout, stock, payments, refunds, reporting, queued fiscal work, and tenant isolation before declaring recovery. Record all manual corrections through existing audited workflows. Close with impact, root cause, timeline, evidence, corrective actions, owners, and deadlines; convert newly discovered invariants into automated tests.
