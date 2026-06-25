#!/bin/bash
# ═══════════════════════════════════════
#  GameStore Bot — Script de inicio
# ═══════════════════════════════════════
cd "$(dirname "${BASH_SOURCE[0]}")"

# Cargar variables de entorno
[ -f .env ] && { set -a; source .env; set +a; echo "✅ .env cargado"; }

# Verificar dependencias
python3 -c "import aiogram" 2>/dev/null || {
    echo "📦 Instalando dependencias..."
    pip3 install -r requirements.txt --break-system-packages
}

echo "🚀 Iniciando GameStore Bot..."
exec python3 bot.py
