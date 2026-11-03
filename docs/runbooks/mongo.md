# MongoDB runbook

## Scope

MongoDB stores user profiles/settings, topics/questions, and PDF source
metadata. Local Podman uses MongoDB 7 as a single-node `rs0` replica set with
data in the named `mongo_data` volume and replica-set key material in
`mongo_config`.

## Detect and assess

1. Check API `/readyz`; the `mongo` check must be `up`.
2. Inspect `podman ps` and `podman-compose logs --tail=200 mongo`.
3. Check the container health state and replica-set primary election:

   ```powershell
   podman inspect --format '{{.State.Health.Status}}' prepai-mongo
   podman exec prepai-mongo mongosh --quiet --username prepai --password prepai --authenticationDatabase admin --eval 'db.hello().isWritablePrimary'
   ```

4. Capture timestamps and sanitized Mongo logs. Do not share credentials or
   user documents.

## Mitigate

- Allow the replica-set health check to complete after first start. Prisma
  writes require a replica set; do not switch the application URI to a
  standalone connection as a workaround.
- If Mongo is unhealthy, inspect disk and container logs before restarting.
  Restart the service without removing its volumes:

  ```powershell
  podman-compose restart mongo
  ```

- Never run `podman-compose down -v`, remove `mongo_data`, or reinitialize the
  replica set as an outage workaround. These actions can destroy data.
- For Atlas production, use the provider's point-in-time restore procedure and
  restore to a separate cluster first. Atlas is documented as a target; backup
  configuration must be verified in the actual account.

## Recovery and verification

Wait for container health to become `healthy`, confirm `isWritablePrimary` is
true, and confirm API `/readyz` reports MongoDB `up`. Use a read-only profile
lookup or non-sensitive health check to verify application connectivity.

## Backup and escalation

The local compose volume is persistence, not a backup. No local backup schedule
is configured. Before production, enable and test provider snapshots/PITR,
record retention and access owners, and perform a restore drill into a separate
cluster. Escalate data corruption or failed elections before attempting any
repair command that changes replica-set metadata.
