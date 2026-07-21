<?php
/**
 * Paradise Pags Integration - Webhook de Pagamento
 * 
 * Este arquivo recebe a notificação da Paradise Pags via POST quando o PIX é pago.
 * Ele valida o pagamento consultando a API da Paradise Pags e dispara a
 * Facebook Conversions API (CAPI) de forma assíncrona, garantindo que mesmo
 * que o cliente feche o navegador, o pixel seja aquecido com o evento de compra.
 */

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Content-Type: application/json");

// Prevenção de erro em requisições de pre-flight (CORS)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Credenciais
$apiKey = 'sk_442210ea27466a39a787b9cd791c0d93c3f374bfb9eea4443dd0656a319ddb23';
$baseUrl = 'https://multi.paradisepags.com/api/v1';

// Lendo o input da Paradise Pags (suporta JSON raw ou POST tradicional form-urlencoded)
$inputJSON = json_decode(file_get_contents('php://input'), true);
$input = is_array($inputJSON) ? $inputJSON : $_POST;

// O ID da transação pode vir em campos diferentes dependendo da chamada. Prioriza o transaction_id (numérico)
$transactionId = $input['transaction_id'] ?? $input['id'] ?? $input['reference'] ?? null;

if (empty($transactionId)) {
    http_response_code(400);
    echo json_encode(["error" => "ID da transação não fornecido no webhook"]);
    exit;
}

// Consulta oficial na API da Paradise Pags para garantir segurança e dados atualizados
$url = $baseUrl . "/query.php?action=get_transaction&id=" . urlencode($transactionId);

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "X-API-Key: " . $apiKey
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode !== 200) {
    http_response_code(500);
    echo json_encode([
        "error" => "Falha ao consultar transação no gateway remoto",
        "code" => $httpCode,
        "url_consultada" => $url,
        "details" => json_decode($response, true) ?? $response
    ]);
    exit;
}

$data = json_decode($response, true);
$paymentStatus = isset($data['status']) ? strtoupper($data['status']) : '';

// Se o pagamento estiver confirmado ('PAID', 'APPROVED', 'PAGO')
if (in_array($paymentStatus, ['PAID', 'APPROVED',     // Facebook CAPI
    $logFile = sys_get_temp_dir() . '/pxp_tx_' . $transactionId . '.json';
    $txData = null;
    $logFileExists = false;
    
    if (file_exists($logFile)) {
        $logFileExists = true;
        $txData = json_decode(file_get_contents($logFile), true);
    }
    
    // Se o arquivo temporário não existir (reciclagem de serverless), faz fallback para a consulta do gateway
    if (!$txData || !is_array($txData)) {
        $customerObj = $data['customer_data']['customer'] ?? null;
        if ($customerObj) {
            $productsList = ['Manuscrito dos Milagres'];
            if (isset($data['customer_data']['description'])) {
                $productsList = explode(' + ', $data['customer_data']['description']);
            }
            
            $txData = [
                "id" => $transactionId,
                "name" => $customerObj['name'] ?? '',
                "email" => $customerObj['email'] ?? '',
                "phone" => $customerObj['phone'] ?? '',
                "amount" => isset($data['amount']) ? (float)$data['amount'] : 37.00,
                "products" => $productsList,
                "ip" => '',
                "user_agent" => '',
                "fbp" => '',
                "fbc" => ''
            ];
        }
    }

    if ($txData) {
        try {
            // Credenciais do Pixel do Facebook
            $fbPixelId = '26069232519364368';
            $fbAccessToken = 'EAAQxZCA3GCbQBQzFX3Nr58EcYPgbAtwgA78i70PvAxZC2ZBnElH5DRZCGOsNkAxqMFncUgcGyE8KNLACO7NV7UwnZAK013eh1cRo4ynhlxyz4J0eZA9U1FFIpDbTejERomG3MKG1Eh2OHmTWBx1vrE56UylYfjn78A3ffXH2lr9ZBToZB3aEZCmBmyMqhA6qZBIPPqxAZDZD';

            // Hashing SHA-256
            $hashEmail = hash("sha256", strtolower(trim($txData['email'])));
            
            $cleanPhone = preg_replace('/\D/', '', $txData['phone']);
            if (strlen($cleanPhone) <= 11 && substr($cleanPhone, 0, 2) !== '55') {
                $cleanPhone = '55' . $cleanPhone;
            }
            $hashPhone = hash("sha256", $cleanPhone);
            
            $nameParts = explode(' ', trim($txData['name']));
            $hashFirstName = hash("sha256", strtolower($nameParts[0]));
            $hashLastName = isset($nameParts[1]) ? hash("sha256", strtolower($nameParts[1])) : '';

            $value = isset($txData['amount']) ? (float)$txData['amount'] : 37.00;
            
            $contentName = "Manuscrito dos Milagres";
            if (isset($txData['products']) && is_array($txData['products'])) {
                $contentName = implode(' + ', $txData['products']);
            }

            $fbPayload = [
                "data" => [
                    [
                        "event_name" => "Purchase",
                        "event_time" => time(),
                        "action_source" => "website",
                        "event_source_url" => "https://" . ($_SERVER['HTTP_HOST'] ?? 'github.com') . ($_SERVER['REQUEST_URI'] ?? '/'),
                        "event_id" => $transactionId, // Deduplicação com o Pixel
                        "user_data" => [
                            "em" => [$hashEmail],
                            "ph" => [$hashPhone],
                            "fn" => [$hashFirstName]
                        ],
                        "custom_data" => [
                            "value" => $value,
                            "currency" => "BRL",
                            "content_name" => $contentName,
                            "content_type" => "product"
                        ]
                    ]
                ]
            ];
            
            if (!empty($hashLastName)) {
                $fbPayload['data'][0]['user_data']['ln'] = [$hashLastName];
            }
            if (!empty($txData['ip'])) {
                $fbPayload['data'][0]['user_data']['client_ip_address'] = $txData['ip'];
            }
            if (!empty($txData['user_agent'])) {
                $fbPayload['data'][0]['user_data']['client_user_agent'] = $txData['user_agent'];
            }
            if (!empty($txData['fbp'])) {
                $fbPayload['data'][0]['user_data']['fbp'] = $txData['fbp'];
            }
            if (!empty($txData['fbc'])) {
                $fbPayload['data'][0]['user_data']['fbc'] = $txData['fbc'];
            }

            $fbCh = curl_init("https://graph.facebook.com/v19.0/{$fbPixelId}/events");
            curl_setopt($fbCh, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($fbCh, CURLOPT_POST, true);
            curl_setopt($fbCh, CURLOPT_POSTFIELDS, json_encode($fbPayload));
            curl_setopt($fbCh, CURLOPT_HTTPHEADER, [
                "Content-Type: application/json",
                "Authorization: Bearer " . $fbAccessToken
            ]);
            
            curl_exec($fbCh);
            curl_close($fbCh);
            
            // Deleta o arquivo de log se existir para garantir disparo único
            if ($logFileExists && file_exists($logFile)) {
                unlink($logFile);
            }
        } catch (Exception $e) {
            // Ignora falhas para garantir resposta 200 ao gateway
        }
    }
}

// Responde status 200 de recebido ao gateway
echo json_encode(["status" => "success", "message" => "Webhook processado com sucesso"]);
