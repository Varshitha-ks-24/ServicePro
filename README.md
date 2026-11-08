# ServicePro

ServicePro is a field-service management workspace for bank branches and electrical maintenance operations. It uses the ServicePro brand asset in `frontend/public/servicepro-logo.jpeg` and the product tagline “Plan • Service • Track • Manage • Grow.”

## Implemented MVP

- Backend-configured sign-in with BCrypt password verification and a server-assigned role. The current bootstrap is single-user HTTP Basic for local MVP validation, not the specification's final OIDC/token and user-administration design; deploy behind TLS and replace it before production use.
- Role-filtered navigation and server-side authorization for service-management mutations.
- H2-persisted bank customers, branches, customer-owned assets, technicians, service requests, work orders, AMC contracts, monthly service cycles, postponement requests and audit events.
- Customer/branch/asset relationship validation, search and pagination for core lists.
- Request-to-work-order conversion, technician assignment, status progression, completion classification and manager-controlled postponement approval.
- AMC monthly cycle generation and completion checks tied to the contract term, asset, service month, completed work order and service report.
- Dashboard counts, recent work orders, technician roster and AMC schedule are sourced from saved database records. The database is not pre-seeded with fictional records.

## Run locally without Docker

Use Java 21+, Maven, Node.js and npm. Set administrator credentials in the shell or in an ignored local env file before starting the backend. Do not commit credentials.

```bash
cd backend
export APP_AUTH_USERNAME='admin@your-company.example'
export APP_AUTH_PASSWORD='use-a-unique-secret'
export APP_AUTH_ROLE='SUPER_ADMIN'
mvn spring-boot:run
```

The default `dev` profile uses the existing in-memory H2 database. The login page stays disabled until `APP_AUTH_USERNAME` and `APP_AUTH_PASSWORD` are configured. The current bootstrap supports one configured identity and role; user provisioning, persisted role management, refreshable access tokens, account recovery and production session controls are not implemented yet.

In another terminal:

```bash
cd frontend
npm ci
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` to `http://localhost:8080`; override `BACKEND_URL` in `frontend/.env` when the backend uses another local address. The API contract is versioned under `/api/v1`.

## Build and test

```bash
cd backend && mvn clean test
cd ../frontend && npm run build
```

## API overview

- `GET /api/v1/auth/status`, `POST /api/v1/auth/login`, `GET /api/v1/auth/me`
- `GET /api/v1/dashboard`
- `GET|POST /api/v1/customers`, `PUT /api/v1/customers/{id}`
- `GET|POST /api/v1/branches`, `PUT /api/v1/branches/{id}`
- `GET|POST /api/v1/assets`, `PUT /api/v1/assets/{id}`
- `GET|POST /api/v1/technicians`, `PUT /api/v1/technicians/{id}`
- `GET|POST /api/v1/service-requests`
- `POST /api/v1/service-requests/{id}/work-order`
- `GET /api/v1/work-orders`, `PUT /api/v1/work-orders/{id}/assignment`, `PUT /api/v1/work-orders/{id}/status`, `POST /api/v1/work-orders/{id}/completion-decision`
- `POST /api/v1/work-orders/{id}/postponement-requests`, `GET /api/v1/postponement-requests`, `POST /api/v1/postponement-requests/{id}/decision`
- `GET|POST /api/v1/amcs`, `GET|POST /api/v1/amcs/{id}/cycles`, `PUT /api/v1/amc-cycles/{id}/status`
- `GET /api/v1/audit-events`

List APIs accept `page`, `size` and `search`; request and work-order lists also accept `status`. Mutating endpoints require authentication and role checks.

## Not yet implemented

Appointment calendar and postponement decision UI, customer/branch/asset editing, persisted multi-user and permission administration, verified GPS-camera evidence, mobile/offline workflows, independent phone and vehicle GPS integrations, inventory and material custody, quotations, invoices, accounting ledger, GST, expense workflows, email/payment providers, exports and customer/vendor portals. These are deliberately not represented as working integrations or populated with mock data. Invoice generation is not available; the future rule is that only completed, approved and billable work may produce an invoice. Service expenses and office expenses remain separate planned categories.

## Health checks

- Backend API: http://localhost:8080/api/health
- Backend readiness: http://localhost:8080/actuator/health/readiness
- Frontend: http://localhost:5173
