# app.py

from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from config import Config

# Inicializar app y configuración
app = Flask(__name__)
app.config.from_object(Config)

# Base de datos
db = SQLAlchemy(app)

# Login Manager
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'auth.login'

# Importar modelos
from models import User

# Cargar usuario logueado
@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# Registrar blueprints
from routes.auth import auth_bp
from routes.user import user_bp
from routes.admin import admin_bp

app.register_blueprint(auth_bp)
app.register_blueprint(user_bp)
app.register_blueprint(admin_bp)

# Crear DB automáticamente si no existe
with app.app_context():
    db.create_all()

# Ejecutar app
if __name__ == '__main__':
    app.run(debug=True)
