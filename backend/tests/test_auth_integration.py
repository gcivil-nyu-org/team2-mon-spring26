from django.contrib.auth import get_user_model
from django.urls import reverse
from django.test import TestCase

User = get_user_model()


class AuthIntegrationTests(TestCase):
    def setUp(self):
        # create a normal user and a staff user
        self.user = User.objects.create_user(
            username="regular", password="pass123", email="reg@example.com"
        )
        self.staff = User.objects.create_user(
            username="staffuser", password="pass123", email="staff@example.com"
        )
        self.staff.is_staff = True
        self.staff.save()

        # URLs used in the tutorial; adjust names if your urls differ
        self.login_url = reverse('login')  # usually provided by auth
        self.logout_url = reverse('logout')
        self.dashboard_url = reverse('dashboard')  # or whatever landing page
        self.protected_url = reverse('my-borrowed')
        self.staff_url = reverse('staff-page')

    def test_login_success(self):
        """Valid credentials should log in and redirect to dashboard/profile."""
        response = self.client.post(
            self.login_url, {'username': 'regular', 'password': 'pass123'}
        )
        self.assertEqual(response.status_code, 302)
        self.assertRedirects(response, self.dashboard_url)
        # user should be authenticated
        self.assertTrue('_auth_user_id' in self.client.session)

    def test_login_invalid_credentials(self):
        """Incorrect password should not log in and return form errors."""
        response = self.client.post(
            self.login_url, {'username': 'regular', 'password': 'wrong'}
        )
        # login page redisplayed
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Please enter a correct username and password")
        self.assertFalse('_auth_user_id' in self.client.session)

    def test_redirect_unauthenticated_user(self):
        """Anonymous users should be redirected to login when accessing protected views."""
        response = self.client.get(self.protected_url)
        self.assertEqual(response.status_code, 302)
        self.assertIn(self.login_url, response['Location'])

    def test_staff_only_view(self):
        """Regular users cannot access staff-specific pages (403 or redirect)."""
        # log in as regular user
        self.client.login(username='regular', password='pass123')
        response = self.client.get(self.staff_url)
        self.assertIn(response.status_code, (302, 403))

    def test_logout_behavior(self):
        """Logging out should clear the session and block access to protected data."""
        # login and access protected page
        self.client.login(username='regular', password='pass123')
        resp = self.client.get(self.protected_url)
        self.assertEqual(resp.status_code, 200)

        # logout
        resp = self.client.get(self.logout_url, follow=True)
        self.assertFalse('_auth_user_id' in self.client.session)

        # accessing protected resource should redirect again
        resp = self.client.get(self.protected_url)
        self.assertEqual(resp.status_code, 302)
        self.assertIn(self.login_url, resp['Location'])
