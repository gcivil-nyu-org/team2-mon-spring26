# MealSwipe — Frontend

React 18 + TypeScript + Vite SPA for the MealSwipe application.

## Stack

- **React 18** with TypeScript
- **Vite 8** (Rolldown-based) for bundling and dev server
- **Tailwind CSS v4** for styling
- **shadcn/ui** component library (Radix UI primitives)
- **React Router v7** for client-side routing
- **Sonner** for toast notifications
- **Vitest** + **React Testing Library** for unit/integration tests

## Quick start

```sh
cd frontend
npm install
npm run dev        # http://localhost:5173
```

API requests are proxied to the backend at `http://127.0.0.1:8000` via
`VITE_API_BASE_URL` (see `frontend/.env.development`). For a local override
create `frontend/.env.local` (gitignored) with:

```
VITE_API_BASE_URL=http://127.0.0.1:8000
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with HMR |
| `npm run build` | Production build to `dist/` |
| `npm run lint` | ESLint check |
| `npm run test` | Vitest in watch mode |
| `npm run test:run` | Single-run tests (CI) |
| `npm run preview` | Serve the production build locally |

## Project structure

```
src/
├── app/
│   ├── components/        # Shared UI components
│   │   └── ui/            # shadcn/ui primitives
│   ├── contexts/
│   │   ├── auth-context.tsx   # Auth state (login, logout, register…)
│   │   ├── app-context.tsx    # Domain state (groups, swipes, chat…)
│   │   ├── venue-context.tsx  # Venue manager session
│   │   └── admin-context.tsx  # Admin session
│   ├── lib/
│   │   └── api.ts         # Shared apiUrl() and getCsrf() helpers
│   ├── pages/             # Route-level page components
│   ├── layouts/           # Layout wrappers (root, auth, venue…)
│   └── data/              # Static JSON data (preference options)
└── test/                  # Vitest setup
```

## Testing

```sh
npm run test:run   # 6 files, 20 tests — all pass
npm run lint       # ESLint — clean
npm run build      # Vite build — succeeds (~758 kB bundle)
```

The chunk-size warning from `npm run build` is expected and is not an error.
