# routes/admin.py

from flask import Blueprint, render_template, request, redirect, url_for, flash
from flask_login import login_required, current_user
from models import db, Recarga, User

admin_bp = Blueprint('admin', __name__, url_prefix='/admin')

def es_admin():
    return current_user.is_authenticated and current_user.role == 'admin'

@admin_bp.route('/panel')
@login_required
def panel():
    if not es_admin():
        flash('Acceso restringido 🚫', 'danger')
        return redirect(url_for('user.dashboard'))
    recargas = Recarga.query.order_by(Recarga.id.desc()).all()
    usuarios = User.query.all()
    return render_template('admin/panel.html', recargas=recargas, usuarios=usuarios)

@admin_bp.route('/cambiar_estado/<int:id>', methods=['POST'])
@login_required
def cambiar_estado(id):
    if not es_admin():
        flash('Sin permiso para cambiar estado', 'danger')
        return redirect(url_for('user.dashboard'))
    estado = request.form.get('estado')
    recarga = Recarga.query.get(id)
    if recarga:
        recarga.estado = estado
        db.session.commit()
        flash('Estado actualizado correctamente ✅', 'success')
    return redirect(url_for('admin.panel'))

@admin_bp.route('/editar_saldo/<int:user_id>', methods=['POST'])
@login_required
def editar_saldo(user_id):
    if not es_admin():
        flash('Sin permiso para editar saldo', 'danger')
        return redirect(url_for('user.dashboard'))
    saldo = request.form.get('saldo')
    user = User.query.get(user_id)
    if user:
        try:
            user.saldo = float(saldo)
            db.session.commit()
            flash('Saldo actualizado ✅', 'success')
        except ValueError:
            flash('El saldo debe ser un número', 'danger')
    return redirect(url_for('admin.panel'))
