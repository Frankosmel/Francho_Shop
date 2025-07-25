# routes/auth.py

from flask import Blueprint, render_template, request, redirect, url_for, flash
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import login_user, logout_user, login_required, current_user
from app import db
from models import User

auth_bp = Blueprint('auth', __name__, url_prefix='/auth')

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        usuario = request.form['username']
        clave = request.form['password']
        user = User.query.filter_by(username=usuario).first()

        if user and check_password_hash(user.password, clave):
            login_user(user)
            flash('Bienvenido, ' + user.username, 'success')
            if user.role == 'admin':
                return redirect(url_for('admin.panel'))
            return redirect(url_for('user.dashboard'))
        else:
            flash('Credenciales incorrectas ❌', 'danger')
    
    return render_template('auth/login.html')

@auth_bp.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        usuario = request.form['username']
        email = request.form['email']
        clave = request.form['password']

        if User.query.filter_by(username=usuario).first():
            flash('El usuario ya existe ⚠️', 'warning')
            return redirect(url_for('auth.register'))

        nuevo = User(
            username=usuario,
            email=email,
            password=generate_password_hash(clave)
        )
        db.session.add(nuevo)
        db.session.commit()
        flash('Cuenta creada con éxito ✅', 'success')
        return redirect(url_for('auth.login'))

    return render_template('auth/register.html')

@auth_bp.route('/logout')
@login_required
def logout():
    logout_user()
    flash('Sesión cerrada correctamente 👋', 'info')
    return redirect(url_for('auth.login'))
