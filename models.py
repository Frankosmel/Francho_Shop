# models.py

from app import db
from flask_login import UserMixin

class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(30), unique=True, nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password = db.Column(db.String(100), nullable=False)
    role = db.Column(db.String(20), default='user')  # 'user' o 'admin'
    saldo = db.Column(db.Float, default=0.0)
    historial = db.relationship('Recarga', backref='cliente', lazy=True)

class Recarga(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    juego = db.Column(db.String(100), nullable=False)
    oferta = db.Column(db.String(100), nullable=False)
    metodo_pago = db.Column(db.String(50), nullable=False)
    estado = db.Column(db.String(20), default='pendiente')  # pendiente, en proceso, completado
    whatsapp = db.Column(db.String(20), nullable=False)
    player_id = db.Column(db.String(50), nullable=False)
    captura = db.Column(db.String(200), nullable=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
