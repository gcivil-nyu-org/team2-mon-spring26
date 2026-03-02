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
├── backend/                  # Django project
│   ├── manage.py
│   ├── requirements.txt
│   ├── app/
│   ├── tests/                # Backend tests (pytest/Django test runner)
│   └── ...
├── frontend/                 # React project
│   ├── package.json
│   ├── src/
│   ├── tests/                # Frontend tests (Jest + React Testing Library)
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

## 3. Formatting Configuration (Prettier + Black)

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

## 4. Branch Protection Policies

Apply these rules to both `main` and `develop` via **Settings → Branches → Branch Protection Rules** on GitHub.

| Policy                          | Reason                                            |
| ------------------------------- | ------------------------------------------------- |
| Require PR before merging       | No one pushes directly to `main` or `develop`     |
| Require at least 1 approval     | Ensures code is reviewed before integration       |
| Require status checks to pass   | CI tests must be green before merging             |
| Require branch to be up to date | Forces pulling latest changes, reducing conflicts |
| Disallow force pushes           | Protects commit history on long-running branches  |

---

## 5. Test Case Guidelines

Keep tests close to feature work and treat them as part of every PR.

### 5.1 Standards & Best Practices

#### Backend (`backend/tests/`)

- Use clear file naming: `test_<feature>.py`
- Prefer one behavior per test function and descriptive names, e.g. `test_login_rejects_invalid_password`
- Cover both success and failure cases (validation errors, permissions, and missing data)
- Mock external services (email, payment, third-party APIs) to keep tests deterministic
- Keep fixtures minimal and reusable

#### Frontend (`frontend/tests/`)

- Use file naming like `<Component>.test.js` or `<feature>.test.js`
- Test user-visible behavior (rendering, interactions, state changes), not implementation details
- Prefer queries users rely on (`getByRole`, `getByText`) over brittle selectors
- Cover loading, empty, error, and success UI states where applicable
- Keep tests isolated and avoid shared mutable state between test cases

#### Team Expectations

- Every feature/fix PR should include or update tests
- If a bug is fixed, add a test that fails before the fix and passes after
- Keep tests fast so they can run often during development

### 5.2 Feature Test Suites (Progress & Coverage)

#### 📦 Authentication & permissions tests

For the user‑auth work (login/logout, password reset, staff pages, etc.) we
use Django’s built‑in `TestCase`/`Client` to simulate user behaviour. The
following high‑level scenarios are already covered in `backend/tests/test_auth_integration.py`:

1. **login_success** – valid credentials redirect to the dashboard/profile
2. **login_invalid_credentials** – bad passwords show form errors and do not
   authenticate
3. **redirect_unauthenticated_user** – protected views automatically redirect
   anonymous users to the login page
4. **staff_only_view** – regular users receive a 403 or redirect when
   accessing staff‑only pages
5. **logout_behavior** – logging out clears the session and prevents back‑button
   access to secured data

Add additional cases here as the tutorial is expanded (password change,
reset tokens, permission checks, etc.). Coordinating with Karine on edge cases
helps ensure the demo is rock‑solid.

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

> **Note:** The `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS` values must be
> **lowercase** (browsers normalise the `Origin` header to lowercase).

### 7.3 Frontend deploy

The frontend is built **locally** and the pre-built `dist/` folder is shipped in the
EB bundle. The EB instance only installs `serve` (the sole production dependency)
and serves the static files.

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

# Build locally (uses .env.production or hardcoded API_BASE_URL)
npm install
npm run build

# Deploy (ships pre-built dist/ to EB — deploys in ~20 seconds)
eb deploy --timeout 5
```

> **Important:** You must run `npm run build` locally before every `eb deploy`.
> The EB instance does **not** build — it only serves the static files from `dist/`.

### 7.4 Updating the backend API URL

The backend URL is currently hardcoded in
`frontend/src/app/contexts/app-context.tsx` (`API_BASE_URL` constant).
To point to a different backend:

1. Update the `API_BASE_URL` value in `app-context.tsx`
2. Run `npm run build` in the `frontend/` directory
3. Run `eb deploy` from `frontend/`

### 7.5 Architecture notes

- **CORS** is handled by `django-cors-headers`. Allowed origins are set via the
  `CORS_ALLOWED_ORIGINS` env var on the backend EB environment.
- **CSRF** is disabled on the JSON API endpoints (`@csrf_exempt`) since they are
  protected by CORS. The Django template-based views still use CSRF.
- **SQLite** is stored at `/var/app/db/db.sqlite3` on the EB instance (a writable
  directory created during deploy). Data is **ephemeral** — it is lost when the
  instance is replaced. For persistent data, switch to RDS.
- **Instance type** is `t3.small` for the frontend (to avoid deploy timeouts).
  The backend uses the default instance type.
