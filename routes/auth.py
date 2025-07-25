# routes/auth.py

from flask import Blueprint, render_template, request, redirect

auth_bp = Blueprint('auth', __name__, url_prefix='/auth')

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        return redirect('/user/dashboard')
    return render_template('auth/login.html')

@auth_bp.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        return redirect('/auth/login')
    return render_template('auth/register.html')
