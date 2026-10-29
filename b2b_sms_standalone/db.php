<?php
/**
 * Conexión y Gestión de Base de Datos SQLite Autónoma
 * Francho Shop B2B Standalone Script
 */

if (!defined('SMS_SYSTEM')) {
    define('SMS_SYSTEM', true);
}

require_once __DIR__ . '/config.php';

function get_db_connection() {
    static $pdo = null;
    if ($pdo === null) {
        $dbPath = __DIR__ . '/data.db';
        $needsInit = !file_exists($dbPath);
        
        try {
            $pdo = new PDO('sqlite:' . $dbPath);
            $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
            $pdo->exec('PRAGMA journal_mode = WAL;');
            
            if ($needsInit) {
                init_database($pdo);
            }
        } catch (PDOException $e) {
            die("Error de conexión con SQLite: " . htmlspecialchars($e->getMessage()));
        }
    }
    return $pdo;
}

function init_database($pdo) {
    // Tabla de configuraciones dinámicas
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
    ");

    // Tabla de pedidos de números virtuales
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id TEXT UNIQUE,
            client_ip TEXT,
            phone TEXT NOT NULL,
            country TEXT NOT NULL,
            service TEXT NOT NULL,
            operator TEXT DEFAULT 'any',
            cost_price REAL NOT NULL,
            sell_price REAL NOT NULL,
            profit REAL NOT NULL,
            status TEXT DEFAULT 'pending',
            sms_code TEXT DEFAULT '',
            full_sms TEXT DEFAULT '',
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            can_cancel_at INTEGER NOT NULL,
            expires_at INTEGER NOT NULL
        );
    ");

    // Índices para búsquedas rápidas
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(phone);");

    // Configuración inicial por defecto
    set_setting('api_key', DEFAULT_API_KEY, $pdo);
    set_setting('admin_password_hash', password_hash(DEFAULT_ADMIN_PASSWORD, PASSWORD_DEFAULT), $pdo);
    set_setting('markup_percent', (string)DEFAULT_MARKUP_PERCENT, $pdo);
    set_setting('store_name', DEFAULT_STORE_NAME, $pdo);
    set_setting('primary_color', DEFAULT_PRIMARY_COLOR, $pdo);
}

function get_setting($key, $default = '') {
    $pdo = get_db_connection();
    $stmt = $pdo->prepare("SELECT value FROM settings WHERE key = ?");
    $stmt->execute([$key]);
    $row = $stmt->fetch();
    return $row ? $row['value'] : $default;
}

function set_setting($key, $value, $pdo = null) {
    if (!$pdo) {
        $pdo = get_db_connection();
    }
    $stmt = $pdo->prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
    return $stmt->execute([$key, $value]);
}

// Inicializar de inmediato al incluir
get_db_connection();
