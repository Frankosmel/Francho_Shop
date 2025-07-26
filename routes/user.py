# routes/user.py

import os
from flask import Blueprint, render_template, request, redirect, url_for, flash, current_app
from flask_login import login_required, current_user
from werkzeug.utils import secure_filename
from models import db, Recarga

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
    captura_path = None

    file = request.files.get('captura')
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        upload_folder = current_app.config['UPLOAD_FOLDER']
        os.makedirs(upload_folder, exist_ok=True)
        file.save(os.path.join(upload_folder, filename))
        captura_path = f'/static/uploads/{filename}'

    nueva = Recarga(
        juego=juego,
        oferta=oferta,
        metodo_pago=metodo,
        player_id=player_id,
        whatsapp=whatsapp,
        captura=captura_path,
        user_id=current_user.id
    )
    db.session.add(nueva)
    db.session.commit()

    flash('✅ Tu pedido ha sido enviado y está pendiente de aprobación.', 'success')
    return redirect(url_for('user.dashboard'))
