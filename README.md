# One OS

One OS is Qamar Technology's core AI operating system project. It is currently implemented as a modular business operating system with a React frontend shell, vertical workspaces, and a Hono-based backend API. The long-term direction is to evolve this foundation into a modular platform for AI agents, MCP servers, workflows, and enterprise applications.

Company: Qamar Technology  
Corporate domain: qamartech.io  
Project name: One OS

## Current Capabilities

- Public web surface for landing, pricing, docs, support, and AI pages.
- Authentication flow using email login and JWT-backed sessions.
- Protected application area with onboarding and role-aware routing.
- Modular vertical workspaces for restaurant, pharmacy, retail, supermarket, school, logistics, marketplace, merchants, settings, and admin surfaces.
- Manifest-driven vertical registry for workspace metadata and navigation.
- Supermarket/commerce backend integration for inventory, products, POS orders, suppliers, and procurement.
- Admin API and UI for users, businesses, audit logs, settings, and dashboard health.
- SQLite persistence through Drizzle ORM and `better-sqlite3`.
- Basic audit logging, rate limiting, CORS configuration, and backup scripts.
- PWA manifest in `public/manifest.json`.

## Technology Stack

Frontend:
- React 19
- TypeScript 5.9
- Vite 7
- React Router 7
- Zustand 5
- Axios
- Lucide React
- Vanilla CSS with CSS variables

Backend:
- Node.js with TypeScript
- Hono
- `@hono/node-server`
- Hono JWT utilities
- Drizzle ORM
- SQLite via `better-sqlite3`
- `dotenv`
- `tsx`

Tooling:
- npm
- ESLint
- Vite build chunking
- Drizzle Kit configuration

## Installation

Install frontend dependencies from the repository root:

```bash
npm install
```

Install backend dependencies:

```bash
cd backend
npm install
```

Create local environment files from `.env.example`. The backend requires `JWT_SECRET` before it will start.

## Development Commands

Frontend, from the repository root:

```bash
npm run dev
npm run build
npm run lint
npm run preview
```

Backend, from `backend/`:

```bash
npm run dev
npm run start
npm run db:seed
npm run db:backup
npm run db:backup:list
```

Typical local development uses:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`
- API base URL: `http://localhost:3001/api`

## Repository Structure

```text
.
|-- backend/                  Backend API, database schema, scripts, local data
|   |-- src/
|   |   |-- db/               Drizzle schema, SQLite client, seed and migration scripts
|   |   |-- middleware/       JWT auth, RBAC, rate limiting
|   |   |-- routes/           Auth, inventory, orders, suppliers, admin routes
|   |   |-- scripts/          Backup and verification scripts
|   |   `-- utils/            Audit logging helpers
|   |-- data/                 Local SQLite database files
|   `-- backups/              Local database backups
|-- public/                   Static assets and PWA manifest
|-- scripts/                  Frontend/e2e verification scripts
|-- src/
|   |-- api/                  Axios HTTP client and API wrappers
|   |-- components/           Shared UI components and error boundary
|   |-- core/                 Frontend services and mock data
|   |-- layouts/              Main, admin, vertical, and sidebar layouts
|   |-- modules/              Public pages, onboarding, admin, vertical workspaces
|   |-- store/                Zustand global stores
|   |-- styles/               Theme CSS
|   |-- types/                Shared frontend TypeScript types
|   |-- verticals/            Vertical manifest registry
|   `-- views/                Route definitions and admin page wrappers
|-- dist/                     Vite build output
|-- package.json              Frontend package metadata and scripts
|-- vite.config.ts            Vite configuration
`-- tsconfig*.json            TypeScript configuration
```

## Documentation Set

- `ARCHITECTURE.md` explains the current technical architecture and integration strategy.
- `SETUP.md` explains local setup, environment variables, and build/run commands.
- `ROADMAP.md` lists current state, risks, and development milestones.
- `PRODUCT_VISION.md` captures the strategic direction for One OS.
- `HANDOVER.md` is the executive and technical handover for future developers and AI assistants.
- `DEPLOYMENT.md` contains an existing production deployment guide that should be reviewed before launch.

## Important Assumptions

- One OS is the official internal project name and must remain unchanged.
- Shajara is a separate flagship application and is not part of this repository.
- MCP and AI agent orchestration are strategic platform goals, but no production MCP server or agent runtime is currently implemented in this repository.
- SQLite is suitable for the current prototype/local deployment phase, but a production multi-tenant SaaS rollout will likely require a managed relational database and stronger tenancy controls.
