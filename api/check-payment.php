<?php
/**
 * Paradise Pags PIX Integration - Check Payment Status
 * 
 * Este arquivo é executado periodicamente pelo polling de 10 segundos do modal.
 * Ele consulta o status da transação na API segura da Paradise Pags via cURL
 * e responde "PAID" se o pagamento for confirmado no banco.
 */

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET");
header("Content-Type: application/json");

// -------------------------------------------------------------
// CREDENCIAIS DA PARADISE PAGS (Mantidas em segurança no servidor)
// -------------------------------------------------------------
$apiKey = 'sk_442210ea27466a39a787b9cd791c0d93c3f374bfb9eea4443dd0656a319ddb23';
$baseUrl = 'https://multi.paradisepags.com/api/v1';

$transactionId = $_GET['id'] ?? '';

if (empty($transactionId)) {
    http_response_code(400);
    echo json_encode(["error" => "ID da transação não fornecido"]);
    exit;
}

// Requisição cURL de consulta
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
    echo json_encode(["error" => "Falha ao consultar transação no servidor remoto"]);
    exit;
}

$data = json_decode($response, true);
$status = 'PENDING';

// Status comuns da Paradise Pags para pagamento confirmado: 'PAID', 'APPROVED', 'PAGO'
$paymentStatus = isset($data['status']) ? strtoupper($data['status']) : '';

if (in_array($paymentStatus, ['PAID', 'APPROVED', 'PAGO'])) {
    $status = 'PAID';
    
    // ==========================================================================
    // RASTREAMENTO: Facebook Conversions API (CAPI) - Disparo Server-to-Server
    // ==========================================================================
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
                "amount" => isset($data['amount']) ? (float)$data['amount'] / 100 : 37.00,
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

            // Hashing SHA-256 exigido pelo Facebook para dados de privacidade (LGPD/GDPR)
            $hashEmail = hash("sha256", strtolower(trim($txData['email'])));
            
            // Trata o telefone para padrão internacional (DDI 55 + Celular)
            $cleanPhone = preg_replace('/\D/', '', $txData['phone']);
            if (strlen($cleanPhone) <= 11 && substr($cleanPhone, 0, 2) !== '55') {
                $cleanPhone = '55' . $cleanPhone;
            }
            $hashPhone = hash("sha256", $cleanPhone);
            
            // Trata primeiro e último nome
            $nameParts = explode(' ', trim($txData['name']));
            $hashFirstName = hash("sha256", strtolower($nameParts[0]));
            $hashLastName = isset($nameParts[1]) ? hash("sha256", strtolower($nameParts[1])) : '';

            $value = isset($txData['amount']) ? (float)$txData['amount'] : 99.00;
            
            $contentName = "Método Linguiça Lucrativa";
            if (isset($txData['products']) && is_array($txData['products'])) {
                $contentName = implode(' + ', $txData['products']);
            }

            // Monta o Payload do Facebook CAPI
            $fbPayload = [
                "data" => [
                    [
                        "event_name" => "Purchase",
                        "event_time" => time(),
                        "action_source" => "website",
                        "event_source_url" => "https://deskfunnel.site/metodo-linguica-lucrativa",
                        "event_id" => $transactionId, // Deduplicação precisa com o Pixel do navegador
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
            
            // Injeta parâmetros opcionais caso existam para maximizar a nota de correspondência
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

            // Dispara requisição cURL para a API do Facebook
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
            
            // Deleta o arquivo JSON local se existir para garantir disparo único
            if ($logFileExists && file_exists($logFile)) {
                unlink($logFile);
            }
        } catch (Exception $e) {
            // Garante que falhas de tracking não interrompam a experiência do usuário
        }
    }
}

// Retorna o status de forma simplificada e direta para o polling do frontend
echo json_encode([
    "status" => $status,
    "raw_status" => $paymentStatus // Retorna o status original do gateway para fins de debug
]);
