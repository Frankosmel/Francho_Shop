from flask import Flask
from routes.auth import auth_bp
from routes.user import user_bp
from routes.admin import admin_bp

app = Flask(__name__)
app.secret_key = 'francho-secret-key'

# Registro de rutas
app.register_blueprint(auth_bp)
app.register_blueprint(user_bp)
app.register_blueprint(admin_bp)

if __name__ == '__main__':
    app.run(debug=True)
