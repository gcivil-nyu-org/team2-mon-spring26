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

## 6. Test Case Guidelines

Keep tests close to feature work and treat them as part of every PR.

### 6.1 Standards & Best Practices

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
- *Note:* Frontend test setup (e.g. Vitest + React Testing Library) is not in place yet; see `docs/TEST_RESULTS.md` for recommendations.

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


### 6.2 Feature Test Suites (Progress & Coverage)

#### 📦 Authentication (API) tests

Auth is tested against the **JSON API** under `/api/auth/` in `backend/tests/test_auth_integration.py`:

1. **Registration** – success (hashed password, auto-login), duplicate email, invalid email, method not allowed
2. **Login** – success (session + current user), invalid credentials → 401, method not allowed
3. **Logout** – POST clears session; unauthenticated current-user returns 401
4. **Current user** – authenticated returns profile (id, email, name); unauthenticated → 401
5. **Password reset request** – valid email → 200 + neutral message; invalid/missing email → 400
6. **Rate limiting** – 10+ failed logins → 429; successful login resets counter

See **`docs/TEST_RESULTS.md`** for a full test summary and how to run a single test.
