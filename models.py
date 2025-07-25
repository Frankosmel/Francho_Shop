# models.py

from app import db
from flask_login import UserMixin

class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(40), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(100), nullable=False)
    saldo = db.Column(db.Float, default=0.0)
    role = db.Column(db.String(10), default='user')  # 'user' o 'admin'

    recargas = db.relationship('Recarga', backref='cliente', lazy=True)

class Recarga(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    juego = db.Column(db.String(80), nullable=False)
    oferta = db.Column(db.String(80), nullable=False)
    metodo_pago = db.Column(db.String(50), nullable=False)
    player_id = db.Column(db.String(100), nullable=False)
    whatsapp = db.Column(db.String(50), nullable=True)
    captura = db.Column(db.String(200), nullable=True)
    estado = db.Column(db.String(30), default='pendiente')  # pendiente, en proceso, completado

    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
