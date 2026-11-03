# Operations runbooks

Use these guides to diagnose and recover local services. Provider-specific
production commands must be added after the hosting, database, and monitoring
providers are selected and verified.

| Service             | Guide                                        |
| ------------------- | -------------------------------------------- |
| API                 | [api.md](api.md)                             |
| Web UI              | [web.md](web.md)                             |
| BullMQ worker       | [worker.md](worker.md)                       |
| MongoDB             | [mongo.md](mongo.md)                         |
| PostgreSQL          | [postgres.md](postgres.md)                   |
| Redis               | [redis.md](redis.md)                         |
| Piston local runner | [piston.md](piston.md)                       |
| Disaster recovery   | [disaster-recovery.md](disaster-recovery.md) |

The [STRIDE threat model](../architecture/threat-model.md) records cross-service
risks and remaining production controls.
