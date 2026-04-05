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
import { AddRestaurantPage } from '@/app/pages/add-restaurant-page';
import { EditRestaurantPage } from '@/app/pages/edit-restaurant-page';
import { VenueLoginPage } from '@/app/pages/venue-login-page';
import { VenueRegisterPage } from '@/app/pages/venue-register-page';
import { ResetPasswordPage } from '@/app/pages/reset-password-page';
import { ProtectedRoute } from '@/app/components/protected-route';

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
      {
        path: 'venue/login',
        Component: VenueLoginPage,
      },
      {
        path: 'venue/register',
        Component: VenueRegisterPage,
      },
      {
        path: 'venue/dashboard',
        Component: VenueDashboardPage,
      },
      {
        path: 'venue/add-restaurant',
        Component: AddRestaurantPage,
      },
      {
        path: 'venue/edit-restaurant/:restaurantId',
        Component: EditRestaurantPage,
      },
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