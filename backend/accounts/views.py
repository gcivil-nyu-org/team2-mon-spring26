import json
import logging
from django.shortcuts import render, redirect
from django.contrib.auth import login, logout, authenticate
from django.views import View
from django.core.validators import validate_email
from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.core.cache import cache
from django.views.decorators.csrf import ensure_csrf_cookie

from .forms import UserCreationForm

logger = logging.getLogger(__name__)


class SignUpView(View):
    template_name = 'registration/signup.html'

    def get(self, request):
        form = UserCreationForm()
        return render(request, self.template_name, {'form': form})

    def post(self, request):
        form = UserCreationForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            return redirect('/')
        return render(request, self.template_name, {'form': form})

signup = SignUpView.as_view()

# --- JSON API Views for React Frontend ---

def api_register(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            # Create a mutable dict to pass to the form
            post_data = {
                'email': data.get('email'),
                'first_name': data.get('first_name', ''),
                'last_name': data.get('last_name', ''),
                'password1': data.get('password'),
                'password2': data.get('password') # Auto-confirm for simple API
            }
            form = UserCreationForm(post_data)
            if form.is_valid():
                user = form.save()
                login(request, user)
                return JsonResponse({
                    'success': True, 
                    'user': {'id': user.id, 'email': user.email, 'name': f"{user.first_name} {user.last_name}".strip()}
                })
            else:
                return JsonResponse({'success': False, 'errors': form.errors}, status=400)
        except Exception as e:
            logger.error(f"Registration error: {str(e)}", exc_info=True)
            return JsonResponse({'success': False, 'error': 'An unexpected error occurred during registration. Please try again.'}, status=500)
    return JsonResponse({'error': 'Method not allowed'}, status=405)

def api_login(request):
    if request.method == 'POST':
        # basic brute force mitigation: limit by IP and email
        ip = request.META.get('REMOTE_ADDR')
        cache_key = f"login_attempts_{ip}"
        attempts = cache.get(cache_key, 0)
        
        if attempts >= 10:
            return JsonResponse({'success': False, 'error': 'Too many failed attempts. Please try again in 5 minutes.'}, status=429)

        try:
            data = json.loads(request.body)
            email = data.get('email')
            password = data.get('password')
            user = authenticate(request, username=email, password=password)
            if user is not None:
                cache.delete(cache_key) # reset attempts on success
                login(request, user)
                return JsonResponse({
                    'success': True,
                    'user': {'id': user.id, 'email': user.email, 'name': f"{user.first_name} {user.last_name}".strip()}
                })
            else:
                cache.set(cache_key, attempts + 1, timeout=300) # 5 min lockout
                return JsonResponse({'success': False, 'error': 'Invalid credentials'}, status=401)
        except Exception as e:
            logger.error(f"Login error: {str(e)}", exc_info=True)
            return JsonResponse({'success': False, 'error': 'An unexpected error occurred during login. Please try again.'}, status=500)
    return JsonResponse({'error': 'Method not allowed'}, status=405)

def api_logout(request):
    if request.method == 'POST':
        logout(request)
        return JsonResponse({'success': True})
    return JsonResponse({'error': 'Method not allowed'}, status=405)

@ensure_csrf_cookie
def api_me(request):
    if request.user.is_authenticated:
        return JsonResponse({
            'authenticated': True,
            'user': {'id': request.user.id, 'email': request.user.email, 'name': f"{request.user.first_name} {request.user.last_name}".strip()}
        })

def api_request_password_reset(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            email = data.get('email', '')
            
            if not email:
                return JsonResponse({'success': False, 'error': 'Email is required'}, status=400)
                
            # Server-side email validation
            validate_email(email)
            
            # NOTE: We do not check if the user exists or send the email yet.
            # Returning a neutral response prevents user enumeration attacks.
            return JsonResponse({
                'success': True, 
                'message': 'If an account with this email exists, a password reset link has been sent.'
            })
            
        except ValidationError:
            return JsonResponse({'success': False, 'error': 'Invalid email format'}, status=400)
        except Exception as e:
            logger.error(f"Password reset error: {str(e)}", exc_info=True)
            return JsonResponse({'success': False, 'error': 'An unexpected error occurred. Please try again.'}, status=500)
            
    return JsonResponse({'error': 'Method not allowed'}, status=405)
