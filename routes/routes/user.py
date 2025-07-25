# routes/user.py

import os
from flask import Blueprint, render_template, request, redirect, url_for, flash, current_app
from flask_login import login_required, current_user
from werkzeug.utils import secure_filename
from app import db
from models import Recarga

user_bp = Blueprint('user', __name__, url_prefix='/user')

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in current_app.config['ALLOWED_EXTENSIONS']

@user_bp.route('/dashboard')
@login_required
def dashboard():
    recargas = Recarga.query.filter_by(user_id=current_user.id).order_by(Recarga.id.desc()).all()
    return render_template('user/dashboard.html', recargas=recargas)

@user_bp.route('/pedido', methods=['POST'])
@login_required
def nuevo_pedido():
    juego = request.form['juego']
    oferta = request.form['oferta']
    metodo = request.form['metodo_pago']
    player_id = request.form['player_id']
    whatsapp = request.form['whatsapp']
    captura = None

    file = request.files.get('captura')
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        path = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
        file.save(path)
        captura = f'/static/uploads/{filename}'

    nuevo = Recarga(
        juego=juego,
        oferta=oferta,
        metodo_pago=metodo,
        player_id=player_id,
        whatsapp=whatsapp,
        captura=captura,
        user_id=current_user.id
    )
    db.session.add(nuevo)
    db.session.commit()

    flash('Tu pedido fue enviado correctamente ✅', 'success')
    return redirect(url_for('user.dashboard'))
