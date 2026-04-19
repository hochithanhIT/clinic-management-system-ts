# Clinic Management System

Full-stack clinic management platform built with a Vue 3 + Vite frontend and a Node.js + Express backend backed by PostgreSQL and Prisma.

## Repository Layout

- Frontend SPA: `clinic-management`
- Backend API: `clinic-server`

## Prerequisites

- Node.js 20.19 or 22.12 (aligns with `engines` field)
- npm 10+
- PostgreSQL 14 or newer (local or remote instance)

## Backend Setup (`clinic-server`)

1. Change into the backend directory:
  ```sh
  cd clinic-server
  ```
2. Install dependencies:
  ```sh
  npm install
  ```
3. Create a `.env` file (do not commit it) with the following variables. Adjust values to match your environment.
  ```dotenv
  APP_HOST=localhost
  APP_PORT=3000
  DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public
  AUTH_SECRET=change_me_access_secret
  AUTH_REFRESH_SECRET=change_me_refresh_secret
  DEFAULT_PASSWORD=StrongDefault123!
  # Optional overrides
  # ADMIN_USERNAME=admin
  # ADMIN_PASSWORD=StrongAdmin123!
  # ADMIN_ROLE_NAME=Admin
  # ADMIN_DISPLAY_NAME=System Administrator
  ```
  - `DATABASE_URL` must point at a PostgreSQL database the app can migrate.
  - If `ADMIN_PASSWORD` is omitted the bootstrapper falls back to `DEFAULT_PASSWORD` when creating the first admin account.
4. Apply database migrations and generate Prisma Client:
  ```sh
  npx prisma migrate deploy
  ```
  Run `npx prisma db seed` if you need the reference data from `prisma/seed.ts`.
5. Start the API (watches for changes in development):
  ```sh
  npm run dev
  ```
  The server listens on `APP_PORT` (defaults to 3000) and exposes REST endpoints under `/api`.

### Production Build

```sh
npm run build
npm start
```

## Frontend Setup (`clinic-management`)

1. Change into the frontend directory:
  ```sh
  cd clinic-management
  ```
2. Install dependencies:
  ```sh
  npm install
  ```
3. Configure environment variables by creating `.env` (or `.env.local`) as needed:
  ```dotenv
  VITE_API_BASE_URL=http://localhost:3000/api
  VITE_EXAM_SERVICE_CODE=CK-KB-001
  ```
  Ensure the API base URL matches the backend origin and includes the `/api` prefix.
4. Start the Vite development server:
  ```sh
  npm run dev
  ```
  The UI runs on http://localhost:5173 by default.

### Additional Scripts

- Type checking: `npm run type-check`
- Linting: `npm run lint`
- Production build preview: `npm run preview`

## Running the Stack Locally

1. Start PostgreSQL and confirm the credentials used in `DATABASE_URL` are valid.
2. In one terminal, run the backend dev server (`clinic-server` → `npm run dev`).
3. In another terminal, run the frontend dev server (`clinic-management` → `npm run dev`).
4. Sign in with the bootstrap admin account (username `ADMIN_USERNAME`, password `ADMIN_PASSWORD` or `DEFAULT_PASSWORD`).

## Troubleshooting

- **Cannot connect to database**: verify `DATABASE_URL`, network access, and that migrations ran successfully.
- **401 errors in the frontend**: confirm cookies are enabled and API/Frontend origins match the CORS whitelist defined in `src/app.ts`.
- **Admin account missing**: set `DEFAULT_PASSWORD` (or `ADMIN_PASSWORD`) before starting the backend; restart after updating the `.env` file.

## Recommended Tooling

- VS Code with the official Vue extension for template IntelliSense
- Vue DevTools browser extension for debugging components
