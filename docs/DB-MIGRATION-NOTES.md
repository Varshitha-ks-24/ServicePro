# ServicePro database migration patch

This patch adds Flyway and an initial MySQL 8 schema migration for the JPA entities in
`backend/src/main/java/com/servicepro/api/FsmEntities.java`.

## Behavior
- Development profile keeps Hibernate `ddl-auto: update` and disables Flyway.
- Production profile enables Flyway and keeps Hibernate `ddl-auto: validate`.
- New empty production databases run `V1__initial_schema.sql`.
- Non-empty databases are baselined at version 0 so Flyway does not attempt to recreate
  tables that may already exist from the earlier MVP. Hibernate validation still checks
  the existing schema at startup.

## Important before production
1. Back up any existing MySQL database.
2. Confirm the existing schema matches the entity model before deploying this patch.
3. Test against a disposable empty MySQL 8 database first.
4. Do not set `ddl-auto` to `update` in production.
5. This migration was prepared from source inspection; it has not yet been executed against
   a live MySQL server in this environment.

## Files changed
- `backend/pom.xml`
- `backend/src/main/resources/application-dev.yml`
- `backend/src/main/resources/application-prod.yml`
- `backend/src/main/resources/db/migration/V1__initial_schema.sql`
