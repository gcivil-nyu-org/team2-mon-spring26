import { createBrowserRouter } from 'react-router';
import { RootLayout } from '@/app/layouts/root-layout';
import { LoginPage } from '@/app/pages/login-page';
import { RegisterPage } from '@/app/pages/register-page';
import { HomePage } from '@/app/pages/home-page';
import { CreateGroupPage } from '@/app/pages/create-group-page';
import { PreferencesPage } from '@/app/pages/preferences-page';
import { GroupDetailPage } from '@/app/pages/group-detail-page';
import { PlanEventPage } from '@/app/pages/plan-event-page';
import { SwipePage } from '@/app/pages/swipe-page';
import { MatchPage } from '@/app/pages/match-page';
import { VenueDashboardPage } from '@/app/pages/venue-dashboard-page';
import { ClaimVenuePage } from '@/app/pages/claim-venue-page';
import { VenueDiscountPage } from '@/app/pages/venue-discount-page';
import { VenueLoginPage } from '@/app/pages/venue-login-page';
import { VenueRegisterPage } from '@/app/pages/venue-register-page';
import { AdminLoginPage } from '@/app/pages/admin-login-page';
import { AdminRegisterPage } from '@/app/pages/admin-register-page';
import { AdminResetPasswordPage } from '@/app/pages/admin-reset-password-page';
import { AdminDashboardPage } from '@/app/pages/admin-dashboard-page';
import { AdminVenueVerificationPage } from '@/app/pages/admin-venue-verification-page';
import { AdminVenuesPage } from '@/app/pages/admin-venues-page';
import { AdminVenueEditPage } from '@/app/pages/admin-venue-edit-page';
import { ResetPasswordPage } from '@/app/pages/reset-password-page';
import { ProtectedRoute } from '@/app/components/protected-route';
import { VenueProtectedRoute } from '@/app/components/venue-protected-route';
import { AdminProtectedRoute } from '@/app/components/admin-protected-route';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: RootLayout,
    children: [
      {
        index: true,
        Component: LoginPage,
      },
      {
        path: 'register',
        Component: RegisterPage,
      },
      {
        path: 'reset-password/:uid/:token',
        Component: ResetPasswordPage,
      },
      // ── Admin public routes (not linked in student/venue UIs) ───────────────
      {
        path: 'admin/login',
        Component: AdminLoginPage,
      },
      {
        path: 'admin/register',
        Component: AdminRegisterPage,
      },
      {
        path: 'admin/reset-password/:uid/:token',
        Component: AdminResetPasswordPage,
      },
      // ── Admin protected routes ──────────────────────────────────────────────
      {
        Component: AdminProtectedRoute,
        children: [
          {
            path: 'admin/dashboard',
            Component: AdminDashboardPage,
          },
          {
            path: 'admin/venue-verification',
            Component: AdminVenueVerificationPage,
          },
          {
            path: 'admin/venues',
            Component: AdminVenuesPage,
          },
          {
            path: 'admin/venues/:venueId',
            Component: AdminVenueEditPage,
          },
        ],
      },
      // ── Venue public routes ──────────────────────────────────────────
      {
        path: 'venue/login',
        Component: VenueLoginPage,
      },
      {
        path: 'venue/register',
        Component: VenueRegisterPage,
      },
      // ── Venue protected routes ───────────────────────────────────────
      {
        Component: VenueProtectedRoute,
        children: [
          {
            path: 'venue/dashboard',
            Component: VenueDashboardPage,
          },
          {
            path: 'venue/claim',
            Component: ClaimVenuePage,
          },
          {
            path: 'venue/venue/:venueId/discounts',
            Component: VenueDiscountPage,
          },
        ],
      },
      // ── Student protected routes ─────────────────────────────────────
      {
        Component: ProtectedRoute,
        children: [
          {
            path: 'home',
            Component: HomePage,
          },
          {
            path: 'create-group',
            Component: CreateGroupPage,
          },
          {
            path: 'preferences',
            Component: PreferencesPage,
          },
          {
            path: 'group/:groupId',
            Component: GroupDetailPage,
          },
          {
            path: 'group/:groupId/plan',
            Component: PlanEventPage,
          },
          {
            path: 'swipe/:eventId',
            Component: SwipePage,
          },
          {
            path: 'match/:eventId',
            Component: MatchPage,
          },
        ],
      },
    ],
  },
]);
