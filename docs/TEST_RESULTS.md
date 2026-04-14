# Test Results

## Frontend toolchain status

All three frontend commands pass:

```sh
cd frontend
npm run lint      # ESLint — clean
npm run test:run  # Vitest — 6 files, 20 tests, all pass
npm run build     # Vite build — succeeds (~765 kB bundle, gzip ~224 kB)
```

The chunk size warning from `npm run build` is expected for this bundle size. It is a warning, not an error, and does not block the build.

---

## Backend: Authentication integration tests

**Suite:** `backend/tests/test_auth_integration.py`
**Run from:** `backend/` directory
**Command:** `python manage.py test tests.test_auth_integration -v 2`

### Summary

| Area                   | Tests | Status        |
|------------------------|-------|---------------|
| Registration           | 4     | ✅ Pass        |
| Login                  | 3     | ✅ Pass        |
| Logout                 | 2     | ✅ Pass        |
| Current user / me      | 2     | ✅ Pass        |
| Password reset request | 4     | ✅ Pass        |
| Login rate limiting    | 2     | ✅ Pass        |
| **Total**              | **17**| **✅ All pass**|

### Coverage by feature

- **Registration:** success (hash password, auto-login), duplicate email, invalid email, GET → 405.
- **Login:** success (session + current user), invalid credentials → 401, GET → 405.
- **Logout:** POST clears session and current user returns 401; GET → 405.
- **Current user:** authenticated returns profile (id, email, name); unauthenticated → 401.
- **Password reset request:** valid email → 200 + neutral message; invalid/missing email → 400; GET → 405.
- **Rate limiting:** 10+ failed logins → 429; successful login resets counter.

### Running a single test

Use the full test path (Django expects the first segment to be an app name; we use `tests`):

```sh
cd backend
python manage.py test tests.test_auth_integration.AuthIntegrationTests.test_login_success -v 2
```

---

## Frontend tests

**Setup:** Vitest + React Testing Library + jsdom (see `frontend/package.json` scripts `test`, `test:run`).

**Run from:** `frontend/` directory
**Commands:**
```sh
cd frontend
npm run test        # watch mode
npm run test:run    # single run
```

### Test files

| File | Tests | Status |
|------|-------|--------|
| `src/test/smoke.test.ts` | 1 | ✅ Pass |
| `src/app/pages/login-page.test.tsx` | 5 | ✅ Pass |
| `src/app/pages/register-page.test.tsx` | 6 | ✅ Pass |
| `src/app/pages/__tests__/group-detail-page.test.tsx` | 1 | ✅ Pass |
| `src/app/pages/__tests__/swipe-page.test.tsx` | 2 | ✅ Pass |
| `src/app/components/__tests__/restaurant-card.test.tsx` | 4 | ✅ Pass |
| **Total** | **20** | **✅ All pass** |

---

## User story vs test coverage

Below is how each user story maps to backend and frontend tests. **✅** = covered; **⚠️** = partial or not yet implemented; **—** = not applicable.

### User registration (email + password)

| User story | Backend test | Frontend test |
|------------|--------------|---------------|
| Registration UI (email, password, confirm password) | — | ✅ `RegisterPage`: account step fields (name, email, password, confirm) |
| Validate: email format | ✅ `test_registration_invalid_email` | ✅ invalid email validation |
| Validate: password strength rules | ✅ Django validators | ✅ password length ≥ 8, passwords match |
| Backend endpoint to create account | ✅ `test_registration_success` | — |
| Hash password before storing | ✅ `test_registration_success` (`check_password`) | — |
| Prevent duplicate accounts | ✅ `test_registration_duplicate_email` | ✅ API error display |
| Auto-login after register | ✅ `test_registration_success` (session `_auth_user_id`) | — (navigate to home in app) |

### Login and logout

| User story | Backend test | Frontend test |
|------------|--------------|---------------|
| Login UI and API call | ✅ `test_login_success` | ✅ form render, submit (mocked API) |
| Secure session | ✅ session after login | — |
| Logout clears session | ✅ `test_logout_behavior` | — |
| Rate limiting | ✅ `LoginRateLimitTests` (429 after 10 failures) | — |
| Proper error handling | ✅ `test_login_invalid_credentials` (401) | ✅ invalid credentials message |

### Login status (current user)

| User story | Backend test | Frontend test |
|------------|--------------|---------------|
| "Get current user" endpoint | ✅ authenticated + unauthenticated cases | — |
| On app load, fetch current user | — | Covered indirectly via login flow |
| Handle expired session | ✅ unauthenticated → 401 | ⚠️ App redirects on 401; not directly tested |

### Password reset request (email form)

| User story | Backend test | Frontend test |
|------------|--------------|---------------|
| Email validation | ✅ invalid/missing email → 400 | ✅ forgot-password dialog validation |
| Neutral success message | ✅ message contains "account" | ✅ "Check your email" after submit |

### Password reset confirm (set new password via token)

| User story | Backend test | Frontend test |
|------------|--------------|---------------|
| Token validation endpoint | ✅ valid/invalid token → 200/400 | — |
| Reset confirm endpoint | ✅ valid token + password → 200 | — |
| Weak password rejected | ✅ → 400 | — |
| Rate limit reset requests | ⚠️ Not implemented | — |
