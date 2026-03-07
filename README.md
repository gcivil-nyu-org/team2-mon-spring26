# Git & Repository Guidelines

## 1. Git Workflow Strategy

We follow a simplified **Gitflow** with `main` and `develop` as long-running branches.

### Branch Roles

| Branch    | Purpose                                                                         |
| --------- | ------------------------------------------------------------------------------- |
| `main`    | Production-ready code only. Updated via releases.                               |
| `develop` | Integration branch where all features come together. Day-to-day working branch. |

### The Rules

- Create feature branches off `develop`, e.g. `feature/swipe-ui` or `fix/auth-bug`
- When done, open a Pull Request (PR) into `develop`
- At least one teammate reviews and approves before merging
- When the team agrees a set of features is ready for release, `develop` is merged into `main` via a PR
- Delete feature branches after merging

### Reducing Merge Conflicts

- Pull from `develop` frequently into your working branch: `git pull origin develop`
- Keep feature branches short-lived — don't let them diverge for too long
- Agree on who owns which areas (e.g., one person on backend auth, another on frontend)
- Use `.editorconfig` and formatters to avoid style conflicts:
  - **React**: Prettier
  - **Django**: Black

---

## 2. Repo Directory Structure

```
repo-root/
├── backend/                  # Django project (uses config.settings)
│   ├── manage.py
│   ├── requirements.txt
│   ├── config/               # Settings, urls, wsgi
│   ├── accounts/            # Auth app (API views, models)
│   ├── tests/                # Backend tests (Django test runner)
│   └── ...
├── frontend/                 # React + Vite + TypeScript
│   ├── package.json
│   ├── src/
│   └── ...
├── .prettierrc               # Prettier rules for frontend/JS formatting
├── pyproject.toml            # Black rules for backend/Python formatting
├── .vscode/
│   ├── settings.json         # Workspace format-on-save defaults
│   └── extensions.json       # Recommended VS Code extensions for the team
├── .editorconfig
├── .gitignore
└── README.md
```

---

## 3. Environment Setup (Development vs Production)

Environment configuration is split so that **development** uses your local backend and **production** builds use the deployed API.

### Backend Setup

1. Copy the example env file:

   ```sh
   cp backend/.env.example backend/.env
   ```

2. Update the following values in `backend/.env` as needed:

   - `DEBUG` — e.g. `True` for local dev, `False` in production
   - `ALLOWED_HOSTS` — e.g. `localhost,127.0.0.1` for dev; your domain(s) for production
   - `SECRET_KEY` — **required for production**; keep it secret (see `backend/.env.example` for a generate command)

Note: `backend/.env` is in `.gitignore`. Create it locally; it will not be committed.

### Frontend Setup

No file copying is required.

- **`npm run dev`** → uses `frontend/.env.development`. With the default (empty `VITE_API_BASE_URL`), API requests go to the same origin and are proxied to the backend by Vite, so session cookies work for login and preferences.
- **`npm run build`** → uses `frontend/.env.production` (API: deployed backend URL)

### Optional: Local Override

To override the API base URL only on your machine, create:

```sh
frontend/.env.local
```

Example:

```
VITE_API_BASE_URL=http://127.0.0.1:8000
```

This file is in `.gitignore`; each developer creates their own if needed.

---

## 4. Formatting Configuration (Prettier + Black)

Use all three files together for consistent formatting across editors and CI.

- `.editorconfig`: editor-level defaults (indentation, line endings, final newline, whitespace)
- `.prettierrc`: formatting rules for JS/TS/React and other files handled by Prettier
- `pyproject.toml`: Black-specific Python formatting rules

### Key Notes

- Prettier reads `.editorconfig` unless values are explicitly overridden in `.prettierrc`
- Black does **not** read `.editorconfig`; it reads only `pyproject.toml`
- Line length is aligned to `88` in both `.prettierrc` and `pyproject.toml` to reduce style conflicts

### VS Code Team Setup

- `.vscode/settings.json` enables format-on-save and sets default formatters by language
- `.vscode/extensions.json` recommends Prettier and Python/Black extensions for consistent setup
- Team members should install workspace-recommended extensions when prompted by VS Code

---

## 5. Branch Protection Policies

Apply these rules to both `main` and `develop` via **Settings → Branches → Branch Protection Rules** on GitHub.

| Policy                          | Reason                                            |
| ------------------------------- | ------------------------------------------------- |
| Require PR before merging       | No one pushes directly to `main` or `develop`     |
| Require at least 1 approval     | Ensures code is reviewed before integration       |
| Require status checks to pass   | CI tests must be green before merging             |
| Require branch to be up to date | Forces pulling latest changes, reducing conflicts |
| Disallow force pushes           | Protects commit history on long-running branches  |

---

## 6. Run the Project Locally

Use two terminals: one for backend and one for frontend.

### Backend (Django)

```bash
cd backend
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 8000
```

Backend URL: `http://127.0.0.1:8000`

### Frontend (Vite + React)

```bash
cd frontend
npm install
npm run dev
```

Frontend URL: `http://localhost:5173`

---

## 7. Deploy to AWS Elastic Beanstalk

This repo deploys as two independent Elastic Beanstalk applications in **us-east-2**:

| Component | EB Application         | EB Environment             | Platform                              |
| --------- | ---------------------- | -------------------------- | ------------------------------------- |
| Backend   | `Mealswipe-backend`    | `Mealswipe-backend-env-1`  | Python 3.x on 64bit Amazon Linux 2023 |
| Frontend  | `Mealswipe-frontend-1` | `Mealswipe-frontend-1-env` | Node.js on 64bit Amazon Linux 2023    |

### 7.1 Prerequisites

- **AWS CLI** installed (`brew install awscli` on macOS)
- **EB CLI** installed (via pip in the backend venv: `pip install awsebcli`)
- AWS credentials configured: `aws configure --profile default` (set region to `us-east-2`)

### 7.2 Backend deploy

The backend runs Django + Gunicorn. Key deployment files:

- `backend/Procfile` — starts Gunicorn
- `backend/.ebextensions/01_migrate.config` — creates a writable DB directory, runs migrations, fixes permissions
- `backend/.ebignore` — excludes `.venv/`, `__pycache__/`, `db.sqlite3`, etc. from the upload bundle
- `backend/requirements.txt` — includes `django-cors-headers` for cross-origin API access

```bash
cd backend
source .venv/bin/activate

# First-time setup (already done — skip if .elasticbeanstalk/config.yml exists)
eb init Mealswipe-backend \
  --platform "Python 3.x running on 64bit Amazon Linux 2023" \
  --region us-east-2

# Create environment (first time only)
eb create Mealswipe-backend-env-1

# Set environment variables
eb setenv \
  SECRET_KEY=<your-secret-key> \
  DEBUG=False \
  ALLOWED_HOSTS=<backend-cname>,localhost,127.0.0.1 \
  DB_PATH=/var/app/db/db.sqlite3 \
  CORS_ALLOWED_ORIGINS=http://<frontend-cname> \
  CSRF_TRUSTED_ORIGINS=http://<frontend-cname>

# Deploy
eb deploy --timeout 5
```

> **Note:** The `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS` values must be **lowercase** (browsers normalise the `Origin` header to lowercase).

### 7.3 Frontend deploy

The frontend is built **locally** and the pre-built `dist/` folder is shipped in the EB bundle. The EB instance only installs `serve` (the sole production dependency) and serves the static files.

Key deployment files:

- `frontend/Procfile` — runs `npm run start` which calls `serve -s dist`
- `frontend/.ebignore` — excludes `node_modules/`, source files, and config from the upload; **includes** `dist/`
- `frontend/package.json` — only `serve` is in `dependencies`; all build tools are in `devDependencies`

```bash
cd frontend

# First-time setup (already done — skip if .elasticbeanstalk/config.yml exists)
eb init Mealswipe-frontend-1 \
  --platform "Node.js 24 running on 64bit Amazon Linux 2023" \
  --region us-east-2

# Create environment (first time only)
eb create Mealswipe-frontend-1-env

# Build locally (uses .env.production for VITE_API_BASE_URL)
npm install
npm run build

# Deploy (ships pre-built dist/ to EB — deploys in ~20 seconds)
eb deploy --timeout 5
```

> **Important:** You must run `npm run build` locally before every `eb deploy`. The EB instance does **not** build — it only serves the static files from `dist/`.

### 7.4 Updating the backend API URL

The backend URL is set via `VITE_API_BASE_URL` in `frontend/.env.production` (see **§3 Environment Setup**). To point the frontend at a different backend:

1. Update `VITE_API_BASE_URL` in `frontend/.env.production`
2. Run `npm run build` in the `frontend/` directory
3. Run `eb deploy` from `frontend/`

### 7.5 Architecture notes

- **CORS** is handled by `django-cors-headers`. Allowed origins are set via the `CORS_ALLOWED_ORIGINS` env var on the backend EB environment.
- **CSRF** protection must not be disabled for cookie-authenticated JSON API endpoints. Do not rely on CORS as a substitute for CSRF; either keep Django's CSRF protection enabled (remove any `@csrf_exempt` on cookie-based views) or use token/bearer authentication instead of cookies for those APIs. The Django template-based views also use CSRF.
- **SQLite** is stored at `/var/app/db/db.sqlite3` on the EB instance (a writable directory created during deploy). Data is **ephemeral** — it is lost when the instance is replaced. For persistent data, switch to RDS.
- **Instance type** is `t3.small` for the frontend (to avoid deploy timeouts). The backend uses the default instance type.

---

## 8. Test Case Guidelines

Keep tests close to feature work and treat them as part of every PR.

### 8.1 Standards & Best Practices

#### Backend (`backend/tests/`)

- Use clear file naming: `test_<feature>.py`
- Prefer one behavior per test function and descriptive names, e.g. `test_login_rejects_invalid_password`
- Cover both success and failure cases (validation errors, permissions, and missing data)
- Mock external services (email, payment, third-party APIs) to keep tests deterministic
- Keep fixtures minimal and reusable

#### Frontend (when adding tests)

- Use file naming like `<Component>.test.tsx` or `<feature>.test.tsx` (project is TypeScript).
- Test user-visible behavior (rendering, interactions, state changes), not implementation details.
- Prefer queries users rely on (`getByRole`, `getByText`) over brittle selectors.
- Cover loading, empty, error, and success UI states where applicable.
- Keep tests isolated and avoid shared mutable state between test cases.
- *Note:* Frontend test setup (Vitest + React Testing Library) is in place, but tests may not pass under Vite 8 beta without version/config alignment; see `docs/TEST_RESULTS.md` for current status and recommendations.

#### Team Expectations

- Every feature/fix PR should include or update tests
- If a bug is fixed, add a test that fails before the fix and passes after
- Keep tests fast so they can run often during development

### ✨ Running backend tests locally

From the `backend/` directory (with `config.settings`):

```sh
python manage.py test                              # run everything
python manage.py test tests.test_auth_integration -v 2   # auth suite only

# Run a single test method (use `tests.` as the module prefix, not `backend.tests.`):
python manage.py test tests.test_auth_integration.AuthIntegrationTests.test_login_success -v 2
```

Use the module path **`tests.test_auth_integration`** (not `backend.tests...`). Django treats the first segment as an app name; we have no app called `backend`, so `backend.tests.test_auth_integration` raises `ModuleNotFoundError`.


### 8.2 Feature Test Suites (Progress & Coverage)

#### 📦 Authentication (API) tests

Auth is tested against the **JSON API** under `/api/auth/` in `backend/tests/test_auth_integration.py`:

1. **Registration** – success (hashed password, auto-login), duplicate email, invalid email, method not allowed
2. **Login** – success (session + current user), invalid credentials → 401, method not allowed
3. **Logout** – POST clears session; unauthenticated current-user returns 401
4. **Current user** – authenticated returns profile (id, email, name); unauthenticated → 401
5. **Password reset request** – valid email → 200 + neutral message; invalid/missing email → 400
6. **Rate limiting** – 10+ failed logins → 429; successful login resets counter

See **`docs/TEST_RESULTS.md`** for a full test summary and how to run a single test.
