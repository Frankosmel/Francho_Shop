# app.py

from flask import Flask
from flask_login import LoginManager
from config import Config

# Importamos db pendiente de inicializar
from models import db, User, Recarga

# Inicializamos la app
app = Flask(__name__)
app.config.from_object(Config)

# Inicializamos la base de datos con la app
db.init_app(app)

# Login manager
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'auth.login'

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# Registrar Blueprints
from routes.auth import auth_bp
from routes.user import user_bp
from routes.admin import admin_bp

app.register_blueprint(auth_bp)
app.register_blueprint(user_bp)
app.register_blueprint(admin_bp)

# Crear tablas si no existen
with app.app_context():
    db.create_all()

if __name__ == '__main__':
    app.run(debug=True)
