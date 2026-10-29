<?php
/**
 * Conector Backend y Puente API Seguro
 * Francho Shop B2B Standalone Script
 */

define('SMS_SYSTEM', true);
require_once __DIR__ . '/db.php';

session_start();
header('Content-Type: application/json; charset=utf-8');

// Helper de respuesta JSON
function json_resp($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

// Función para llamar a la API de Francho Shop con cURL
function call_francho_api($endpoint, $method = 'GET', $postData = null) {
    $apiKey = trim(get_setting('api_key', DEFAULT_API_KEY));
    if (empty($apiKey) || $apiKey === 'PEGA_TU_API_KEY_AQUI') {
        return [
            'ok' => false,
            'error' => 'API Key de Francho Shop no configurada. Ingrese a admin.php para configurarla.',
            'status_code' => 401
        ];
    }

    $url = rtrim(FRANCHO_API_BASE_URL, '/') . '/' . ltrim($endpoint, '/');
    $ch = curl_init();

    $headers = [
        'Authorization: Bearer ' . $apiKey,
        'Accept: application/json',
        'User-Agent: FranchoShop-B2B-SMS-Client/2.0'
    ];

    if ($method === 'POST') {
        curl_setopt($ch, CURLOPT_POST, true);
        if ($postData !== null) {
            $jsonPayload = json_encode($postData);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $jsonPayload);
            $headers[] = 'Content-Type: application/json';
        }
    }

    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);

    $raw = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr = curl_error($ch);
    curl_close($ch);

    if ($raw === false) {
        return [
            'ok' => false,
            'error' => 'Error de conexión cURL: ' . $curlErr,
            'status_code' => 500
        ];
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        return [
            'ok' => false,
            'error' => 'Respuesta no válida del servidor central (' . $httpCode . ')',
            'raw' => $raw,
            'status_code' => $httpCode
        ];
    }

    $decoded['http_status'] = $httpCode;
    return $decoded;
}

$action = $_GET['action'] ?? $_POST['action'] ?? '';

// ══════════════════════════════════════════════════════════════════
//  ACCIONES PÚBLICAS (CLIENTE FINAL)
// ══════════════════════════════════════════════════════════════════

// 1. Obtener lista de países
if ($action === 'countries') {
    $res = call_francho_api('sms/countries');
    if (!$res || empty($res['ok'])) {
        json_resp(['ok' => false, 'error' => $res['error'] ?? 'No se pudo obtener lista de países'], 500);
    }
    json_resp([
        'ok' => true,
        'items' => $res['items'] ?? [],
        'count' => count($res['items'] ?? [])
    ]);
}

// 2. Obtener lista de servicios de un país con margen de ganancia aplicado
if ($action === 'services') {
    $country = strtolower(trim($_GET['country'] ?? ''));
    if (empty($country)) {
        json_resp(['ok' => false, 'error' => 'Parámetro country es requerido'], 400);
    }

    $res = call_francho_api('sms/services?country=' . urlencode($country));
    if (!$res || empty($res['ok'])) {
        json_resp(['ok' => false, 'error' => $res['error'] ?? 'Error consultando servicios'], 500);
    }

    $markupPercent = (float)get_setting('markup_percent', DEFAULT_MARKUP_PERCENT);
    $multiplier = 1 + ($markupPercent / 100.0);

    $items = [];
    foreach (($res['items'] ?? []) as $item) {
        $cost = (float)($item['price'] ?? 0);
        $sellPrice = round($cost * $multiplier, 2);
        
        $item['cost_price'] = $cost;
        $item['price'] = number_format($sellPrice, 2, '.', '');
        
        if (isset($item['price_max'])) {
            $costMax = (float)$item['price_max'];
            $sellPriceMax = round($costMax * $multiplier, 2);
            $item['price_max'] = number_format($sellPriceMax, 2, '.', '');
        }

        $items[] = $item;
    }

    json_resp([
        'ok' => true,
        'country' => $country,
        'currency' => CURRENCY_NAME,
        'markup_percent' => $markupPercent,
        'items' => $items,
        'count' => count($items)
    ]);
}

// 3. Obtener operadores móviles para un servicio y país
if ($action === 'operators') {
    $country = strtolower(trim($_GET['country'] ?? ''));
    $service = strtolower(trim($_GET['service'] ?? ''));
    if (empty($country) || empty($service)) {
        json_resp(['ok' => false, 'error' => 'country y service son requeridos'], 400);
    }

    $res = call_francho_api("sms/operators?country=" . urlencode($country) . "&service=" . urlencode($service));
    if (!$res || empty($res['ok'])) {
        json_resp(['ok' => false, 'error' => $res['error'] ?? 'Error consultando operadores'], 500);
    }

    $markupPercent = (float)get_setting('markup_percent', DEFAULT_MARKUP_PERCENT);
    $multiplier = 1 + ($markupPercent / 100.0);

    $items = [];
    foreach (($res['items'] ?? []) as $op) {
        $cost = (float)($op['price'] ?? 0);
        $sellPrice = round($cost * $multiplier, 2);
        $op['cost_price'] = $cost;
        $op['price'] = number_format($sellPrice, 2, '.', '');
        $items[] = $op;
    }

    json_resp([
        'ok' => true,
        'country' => $country,
        'service' => $service,
        'currency' => CURRENCY_NAME,
        'items' => $items,
        'count' => count($items)
    ]);
}

// 4. Comprar un número virtual
if ($action === 'buy') {
    $rawInput = file_get_contents('php://input');
    $body = json_decode($rawInput, true) ?: $_POST;

    $country = strtolower(trim($body['country'] ?? ''));
    $service = strtolower(trim($body['service'] ?? ''));
    $operator = strtolower(trim($body['operator'] ?? 'any'));

    if (empty($country) || empty($service)) {
        json_resp(['ok' => false, 'error' => 'País y servicio son obligatorios'], 400);
    }

    $payload = [
        'country' => $country,
        'service' => $service,
        'operator' => $operator
    ];

    $res = call_francho_api('sms/orders', 'POST', $payload);
    if (!$res || empty($res['ok'])) {
        $msg = $res['error'] ?? 'No se pudo comprar el número virtual. Verifica tu saldo o disponibilidad.';
        json_resp(['ok' => false, 'error' => $msg], 400);
    }

    // Calcular ganancia y precio minorista
    $costPrice = (float)($res['price'] ?? 0);
    $markupPercent = (float)get_setting('markup_percent', DEFAULT_MARKUP_PERCENT);
    $sellPrice = round($costPrice * (1 + ($markupPercent / 100.0)), 2);
    $profit = round($sellPrice - $costPrice, 2);

    $now = time();
    $canCancelAt = $now + 120; // 2 minutos
    $expiresAt = $now + 1200; // 20 minutos

    $pdo = get_db_connection();
    $stmt = $pdo->prepare("
        INSERT INTO orders (
            order_id, client_ip, phone, country, service, operator,
            cost_price, sell_price, profit, status,
            created_at, updated_at, can_cancel_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)
    ");

    $clientIp = $_SERVER['REMOTE_ADDR'] ?? '';
    $stmt->execute([
        $res['order_id'],
        $clientIp,
        $res['phone'],
        $country,
        $service,
        $res['operator'] ?? $operator,
        $costPrice,
        $sellPrice,
        $profit,
        $now,
        $now,
        $canCancelAt,
        $expiresAt
    ]);

    // Guardar ID en sesión para persistencia en frontend
    if (!isset($_SESSION['active_sms_orders'])) {
        $_SESSION['active_sms_orders'] = [];
    }
    $_SESSION['active_sms_orders'][] = $res['order_id'];

    json_resp([
        'ok' => true,
        'order_id' => $res['order_id'],
        'phone' => $res['phone'],
        'country' => $country,
        'service' => $service,
        'operator' => $res['operator'] ?? $operator,
        'price' => number_format($sellPrice, 2, '.', ''),
        'currency' => CURRENCY_NAME,
        'status' => 'pending',
        'can_cancel_after_seconds' => 120,
        'expires_in_seconds' => 1200,
        'created_at' => $now
    ]);
}

// 5. Consultar estado del pedido / Verificar llegada del SMS
if ($action === 'check') {
    $orderId = trim($_GET['order_id'] ?? '');
    if (empty($orderId)) {
        json_resp(['ok' => false, 'error' => 'order_id es requerido'], 400);
    }

    $pdo = get_db_connection();
    $stmt = $pdo->prepare("SELECT * FROM orders WHERE order_id = ?");
    $stmt->execute([$orderId]);
    $localOrder = $stmt->fetch();

    if (!$localOrder) {
        json_resp(['ok' => false, 'error' => 'Orden local no encontrada'], 404);
    }

    // Si ya está completada o cancelada localmente, devolver estado
    if (in_array($localOrder['status'], ['completed', 'cancelled', 'expired']) && !empty($localOrder['sms_code'])) {
        json_resp([
            'ok' => true,
            'order_id' => $localOrder['order_id'],
            'phone' => $localOrder['phone'],
            'status' => $localOrder['status'],
            'sms_code' => $localOrder['sms_code'],
            'full_sms' => $localOrder['full_sms'],
            'created_at' => (int)$localOrder['created_at'],
            'can_cancel_at' => (int)$localOrder['can_cancel_at'],
            'expires_at' => (int)$localOrder['expires_at']
        ]);
    }

    // Consultar a la API central de Francho Shop
    $res = call_francho_api("sms/orders/" . urlencode($orderId));
    if (!$res || empty($res['ok'])) {
        json_resp(['ok' => false, 'error' => $res['error'] ?? 'Error al verificar orden'], 500);
    }

    $status = $res['status'] ?? $localOrder['status'];
    $smsCode = $res['sms_code'] ?? $res['code'] ?? '';
    $fullSms = $res['full_sms'] ?? $res['text'] ?? '';

    if (!empty($smsCode) && $status !== 'completed') {
        $status = 'completed';
    }

    // Actualizar base de datos local
    $now = time();
    $upStmt = $pdo->prepare("
        UPDATE orders 
        SET status = ?, sms_code = ?, full_sms = ?, updated_at = ?
        WHERE order_id = ?
    ");
    $upStmt->execute([$status, $smsCode, $fullSms, $now, $orderId]);

    json_resp([
        'ok' => true,
        'order_id' => $orderId,
        'phone' => $localOrder['phone'],
        'status' => $status,
        'sms_code' => $smsCode,
        'full_sms' => $fullSms,
        'created_at' => (int)$localOrder['created_at'],
        'can_cancel_at' => (int)$localOrder['can_cancel_at'],
        'expires_at' => (int)$localOrder['expires_at']
    ]);
}

// 6. Cancelar pedido y recuperar saldo
if ($action === 'cancel') {
    $rawInput = file_get_contents('php://input');
    $body = json_decode($rawInput, true) ?: $_POST;
    $orderId = trim($body['order_id'] ?? '');

    if (empty($orderId)) {
        json_resp(['ok' => false, 'error' => 'order_id requerido'], 400);
    }

    $pdo = get_db_connection();
    $stmt = $pdo->prepare("SELECT * FROM orders WHERE order_id = ?");
    $stmt->execute([$orderId]);
    $localOrder = $stmt->fetch();

    if (!$localOrder) {
        json_resp(['ok' => false, 'error' => 'Orden no encontrada'], 404);
    }

    // Cancelar en Francho Shop API
    $res = call_francho_api("sms/orders/" . urlencode($orderId) . "/cancel", "POST");
    if (!$res || empty($res['ok'])) {
        json_resp(['ok' => false, 'error' => $res['error'] ?? 'No se pudo cancelar el número'], 400);
    }

    $now = time();
    $upStmt = $pdo->prepare("UPDATE orders SET status = 'cancelled', updated_at = ? WHERE order_id = ?");
    $upStmt->execute([$now, $orderId]);

    json_resp([
        'ok' => true,
        'order_id' => $orderId,
        'status' => 'cancelled',
        'message' => 'Número cancelado con éxito. El saldo fue reembolsado a tu cuenta.'
    ]);
}

// 7. Mis órdenes activas (Para no perder el número al recargar la página)
if ($action === 'my_orders') {
    $recentTime = time() - 1200; // Últimos 20 minutos
    $clientIp = $_SERVER['REMOTE_ADDR'] ?? '';
    
    $pdo = get_db_connection();
    $sessionOrders = $_SESSION['active_sms_orders'] ?? [];

    $sql = "SELECT * FROM orders WHERE created_at >= ? AND (client_ip = ? ";
    $params = [$recentTime, $clientIp];

    if (!empty($sessionOrders)) {
        $placeholders = implode(',', array_fill(0, count($sessionOrders), '?'));
        $sql .= " OR order_id IN ($placeholders)";
        $params = array_merge($params, $sessionOrders);
    }
    $sql .= ") ORDER BY id DESC LIMIT 5";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $orders = $stmt->fetchAll();

    json_resp([
        'ok' => true,
        'orders' => $orders
    ]);
}

// ══════════════════════════════════════════════════════════════════
//  ACCIONES DEL PANEL DE ADMINISTRACIÓN (PROTEGIDAS)
// ══════════════════════════════════════════════════════════════════

function check_admin_auth() {
    if (empty($_SESSION['sms_admin_logged'])) {
        json_resp(['ok' => false, 'error' => 'No autorizado. Inicie sesión en admin.php'], 401);
    }
}

// Consultar saldo mayorista en Francho Shop
if ($action === 'admin_balance') {
    check_admin_auth();
    $res = call_francho_api('account');
    if (!$res || empty($res['balance'])) {
        json_resp(['ok' => false, 'error' => $res['error'] ?? 'No se pudo consultar el saldo']);
    }
    json_resp([
        'ok' => true,
        'balance' => $res['balance'],
        'currency' => $res['currency'] ?? 'USDT',
        'account_id' => $res['account_id'] ?? ''
    ]);
}

// Guardar configuración desde el panel admin
if ($action === 'admin_save_settings') {
    check_admin_auth();
    $rawInput = file_get_contents('php://input');
    $body = json_decode($rawInput, true) ?: $_POST;

    if (isset($body['markup_percent'])) {
        $markup = max(0.0, min(200.0, (float)$body['markup_percent']));
        set_setting('markup_percent', (string)$markup);
    }
    if (isset($body['store_name']) && !empty(trim($body['store_name']))) {
        set_setting('store_name', trim($body['store_name']));
    }
    if (isset($body['api_key']) && !empty(trim($body['api_key']))) {
        set_setting('api_key', trim($body['api_key']));
    }
    if (isset($body['primary_color']) && !empty(trim($body['primary_color']))) {
        set_setting('primary_color', trim($body['primary_color']));
    }
    if (isset($body['new_password']) && strlen(trim($body['new_password'])) >= 6) {
        set_setting('admin_password_hash', password_hash(trim($body['new_password']), PASSWORD_DEFAULT));
    }

    json_resp(['ok' => true, 'message' => 'Configuración guardada exitosamente']);
}

// Listar pedidos para la tabla del admin
if ($action === 'admin_orders') {
    check_admin_auth();
    $pdo = get_db_connection();
    
    $limit = 50;
    $stmt = $pdo->prepare("SELECT * FROM orders ORDER BY id DESC LIMIT ?");
    $stmt->execute([$limit]);
    $orders = $stmt->fetchAll();

    // Estadísticas generales
    $stats = $pdo->query("
        SELECT 
            COUNT(*) as total_orders,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_orders,
            SUM(CASE WHEN status = 'completed' THEN profit ELSE 0 END) as total_profit,
            SUM(CASE WHEN status = 'completed' THEN sell_price ELSE 0 END) as total_revenue
        FROM orders
    ")->fetch();

    json_resp([
        'ok' => true,
        'orders' => $orders,
        'stats' => [
            'total_orders' => (int)($stats['total_orders'] ?? 0),
            'completed_orders' => (int)($stats['completed_orders'] ?? 0),
            'total_profit' => number_format((float)($stats['total_profit'] ?? 0), 2, '.', ''),
            'total_revenue' => number_format((float)($stats['total_revenue'] ?? 0), 2, '.', '')
        ]
    ]);
}

// Exportar reporte de pedidos a CSV para Excel
if ($action === 'admin_export_csv') {
    check_admin_auth();
    $pdo = get_db_connection();
    $stmt = $pdo->query("SELECT * FROM orders ORDER BY id DESC");
    $orders = $stmt->fetchAll();

    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename=reporte_numeros_virtuales_' . date('Y-m-d') . '.csv');

    $output = fopen('php://output', 'w');
    // BOM para que Excel abra UTF-8 con tildes y símbolos correctamente
    fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF));

    fputcsv($output, [
        'ID',
        'Order ID Francho',
        'Fecha',
        'País',
        'Servicio / App',
        'Operador',
        'Teléfono',
        'Costo Mayorista (USDT)',
        'Precio Venta (USDT)',
        'Ganancia Neta (USDT)',
        'Código SMS Recibido',
        'Estado'
    ]);

    foreach ($orders as $o) {
        fputcsv($output, [
            $o['id'],
            $o['order_id'],
            date('Y-m-d H:i:s', $o['created_at']),
            strtoupper($o['country']),
            ucwords($o['service']),
            $o['operator'],
            $o['phone'],
            number_format($o['cost_price'], 2),
            number_format($o['sell_price'], 2),
            number_format($o['profit'], 2),
            $o['sms_code'],
            $o['status']
        ]);
    }

    fclose($output);
    exit;
}

json_resp(['ok' => false, 'error' => 'Acción no válida'], 400);
