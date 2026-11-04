# Rate-limit rejection alert design

Use the new bounded `http_rate_limit_exceeded_total` counter to alert on sustained rejected-request bursts. Add separate warning alerts for `auth` and `general` route classes, aggregating across API replicas. Start with 20 auth rejections or 100 general rejections in five minutes and require the condition to persist for two minutes. Document the thresholds as initial defaults to review against real traffic after deployment.

Approaches considered: no alert (counter needs manual review); one shared threshold (does not account for different limits); separate auth/general warning thresholds (selected, matches the limiter policy and remains low-cardinality). The alerts are starter rules and do not send notifications until Alertmanager delivery is configured.
