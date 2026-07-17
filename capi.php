<?php
/**
 * Script PHP Proxy para envio seguro de eventos CAPI (Facebook Conversions API).
 * Este script roda no servidor (backend) ocultando o seu Token de Acesso do público.
 */

// Evitar erros de CORS se hospedado em outro domínio
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["error" => "Método não permitido"]);
    exit;
}

// Ler o JSON enviado no corpo da requisição
$inputData = json_decode(file_get_contents('php://input'), true);

$eventId = $inputData['event_id'] ?? null;
$eventName = $inputData['event_name'] ?? null;
$sourceUrl = $inputData['source_url'] ?? $_SERVER['HTTP_REFERER'] ?? '';

if (!$eventId || !$eventName) {
    http_response_code(400);
    echo json_encode(["error" => "Event ID e Event Name são obrigatórios"]);
    exit;
}

// Configurações do Facebook
$pixelId = '26069232519364368';
$accessToken = 'EAAQxZCA3GCbQBQzFX3Nr58EcYPgbAtwgA78i70PvAxZC2ZBnElH5DRZCGOsNkAxqMFncUgcGyE8KNLACO7NV7UwnZAK013eh1cRo4ynhlxyz4J0eZA9U1FFIpDbTejERomG3MKG1Eh2OHmTWBx1vrE56UylYfjn78A3ffXH2lr9ZBToZB3aEZCmBmyMqhA6qZBIPPqxAZDZD';

// Capturar dados do visitante
$clientIp = $_SERVER['REMOTE_ADDR'] ?? '';
// Caso esteja atrás de Cloudflare ou Proxy
if (isset($_SERVER['HTTP_CF_CONNECTING_IP'])) {
    $clientIp = $_SERVER['HTTP_CF_CONNECTING_IP'];
} elseif (isset($_SERVER['HTTP_X_FORWARDED_FOR'])) {
    $clientIp = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'])[0];
}
$userAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';

// Montar payload CAPI
$payload = [
    "data" => [
        [
            "event_name" => $eventName,
            "event_time" => time(),
            "event_id" => $eventId,
            "event_source_url" => $sourceUrl,
            "action_source" => "website",
            "user_data" => [
                "client_ip_address" => $clientIp,
                "client_user_agent" => $userAgent
            ]
        ]
    ]
];

// Enviar requisição Curl para o Facebook Graph API
$url = "https://graph.facebook.com/v19.0/{$pixelId}/events?access_token={$accessToken}";

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json'
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode !== 200) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "error" => "Falha ao enviar evento para o Facebook CAPI",
        "fb_response" => json_decode($response, true)
    ]);
} else {
    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Evento enviado com sucesso para a CAPI",
        "fb_response" => json_decode($response, true)
    ]);
}
