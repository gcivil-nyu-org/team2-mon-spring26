from django.shortcuts import render, redirect
from django.contrib.auth import login
from django.views import View

from .forms import UserCreationForm


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
