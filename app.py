# app.py

from flask import Flask
from flask_login import LoginManager
from config import Config
from models import db, User, Recarga

# Inicializar la app
app = Flask(__name__)
app.config.from_object(Config)

# Inicializar la base de datos
db.init_app(app)

# Configurar Flask-Login
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'auth.login'

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

# Crear tablas si no existen
with app.app_context():
    db.create_all()

# Ejecutar la app en todas las interfaces para ser accesible desde tu VPS
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
```0
