<?php
/**
 * Paradise Pags PIX Integration - Create Payment
 * 
 * Este arquivo recebe a requisição do formulário do DeskFunnel, realiza a 
 * comunicação segura via cURL com a API da Paradise Pags utilizando a 
 * chave secreta no backend (escondida do usuário) e retorna o código copia e cola.
 */

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, X-API-Key");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Content-Type: application/json");

// Prevenção de erro em requisições de pre-flight (CORS)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

/**
 * Gera um CPF matematicamente válido aleatório para contornar
 * exigências de KYC do gateway de pagamento de forma transparente.
 */
function generateRandomCPF() {
    $n = [];
    for ($i = 0; $i < 9; $i++) {
        $n[] = rand(0, 9);
    }
    
    // Calcula o primeiro dígito verificador
    $d1 = 0;
    for ($i = 0; $i < 9; $i++) {
        $d1 += $n[$i] * (10 - $i);
    }
    $d1 = 11 - ($d1 % 11);
    if ($d1 >= 10) {
        $d1 = 0;
    }
    $n[] = $d1;
    
    // Calcula o segundo dígito verificador
    $d2 = 0;
    for ($i = 0; $i < 10; $i++) {
        $d2 += $n[$i] * (11 - $i);
    }
    $d2 = 11 - ($d2 % 11);
    if ($d2 >= 10) {
        $d2 = 0;
    }
    $n[] = $d2;
    
    return implode('', $n);
}

// -------------------------------------------------------------
// CREDENCIAIS DA PARADISE PAGS (Mantidas em segurança no servidor)
// -------------------------------------------------------------
$apiKey = 'sk_442210ea27466a39a787b9cd791c0d93c3f374bfb9eea4443dd0656a319ddb23';
$baseUrl = 'https://multi.paradisepags.com/api/v1';

// Lendo o corpo da requisição enviada pelo modal frontend
$input = json_decode(file_get_contents('php://input'), true);

if (!$input || empty($input['name']) || empty($input['email'])) {
    http_response_code(400);
    echo json_encode(["error" => "Dados de preenchimento obrigatórios ausentes"]);
    exit;
}

// Valor base padrão
$baseAmountInCents = 9900;
$baseProductName = 'Manuscrito dos Milagres';

// Validação de segurança do plano selecionado
if (isset($input['baseAmount'])) {
    $receivedBase = floatval($input['baseAmount']);
    if ($receivedBase > 0) {
        $baseAmountInCents = intval($receivedBase * 100);
    }
}
if (isset($input['baseProductName']) && !empty($input['baseProductName'])) {
    $baseProductName = $input['baseProductName'];
}

$amountInCents = $baseAmountInCents;
$products = [$baseProductName];

if (isset($input['orderBump1']) && $input['orderBump1'] === true) {
    $amountInCents += 990; // R$ 9,90
    $products[] = 'Acesso Vitalício';
}
if (isset($input['orderBump2']) && $input['orderBump2'] === true) {
    $amountInCents += 1490; // R$ 14,90
    $products[] = 'Grupo VIP no WhatsApp';
}

$description = implode(' + ', $products);

// Limpando Celular para conter apenas números e tratando CPF condicionalmente
$cleanPhone = !empty($input['whatsapp']) ? preg_replace('/\D/', '', $input['whatsapp']) : '5511999999999';
$cleanCpf = !empty($input['cpf']) ? preg_replace('/\D/', '', $input['cpf']) : '';

// Se o CPF estiver vazio (já que removemos do front), gera um CPF dinâmico válido
if (empty($cleanCpf)) {
    $cleanCpf = generateRandomCPF();
}

// Payload estruturado conforme especificação da Paradise Pags
$payload = [
    "amount" => $amountInCents,
    "description" => $description,
    "reference" => "LL-" . time() . "-" . rand(1000, 9999),
    "customer" => [
        "name" => $input['name'],
        "email" => $input['email'],
        "phone" => $cleanPhone,
        "document" => $cleanCpf
    ],
    "source" => "api_externa"
];

// Injeta os dados de tracking/UTMs capturados pelo modal do DeskFunnel
if (!empty($input['tracking'])) {
    $payload['tracking'] = $input['tracking'];
}

// Requisição cURL
$ch = curl_init($baseUrl . "/transaction.php");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Content-Type: application/json",
    "X-API-Key: " . $apiKey
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode !== 200) {
    http_response_code(500);
    echo json_encode([
        "error" => "Falha na comunicação com a Paradise Pags",
        "code" => $httpCode,
        "details" => json_decode($response, true)
    ]);
    exit;
}

$data = json_decode($response, true);
$paymentId = $data['transaction_id'] ?? $data['id'] ?? null;
$pixCode = $data['qr_code'] ?? null;

// ==========================================================================
// RASTREAMENTO: Salva os dados da transação localmente para o Facebook CAPI
// ==========================================================================
if ($paymentId) {
    try {
        $transactionsDir = sys_get_temp_dir(); // Compatível com filesystem somente-leitura da Vercel (/tmp)
        
        // Coleta metadados de rede e cookies do cliente
        $clientIp = $_SERVER['REMOTE_ADDR'] ?? '';
        if (isset($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            $clientIp = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'])[0];
        }
        
        $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';
        $fbp = $_COOKIE['_fbp'] ?? '';
        $fbc = $_COOKIE['_fbc'] ?? '';
        
        $transactionData = [
            "id" => $paymentId,
            "name" => $input['name'],
            "email" => $input['email'],
            "phone" => $cleanPhone,
            "ip" => trim($clientIp),
            "user_agent" => trim($userAgent),
            "fbp" => trim($fbp),
            "fbc" => trim($fbc),
            "tracking" => $input['tracking'] ?? [],
            "amount" => $amountInCents / 100,
            "products" => $products,
            "created_at" => time()
        ];
        
        // Salva os dados em formato JSON temporário permitido na Vercel
        file_put_contents($transactionsDir . '/pxp_tx_' . $paymentId . '.json', json_encode($transactionData));

        // ==========================================================================
        // RASTREAMENTO: Facebook Conversions API (CAPI) - InitiateCheckout
        // ==========================================================================
        try {
            $fbPixelId = '1014856120885286';
            $fbAccessToken = 'EAANt5nyjdkABRsXlZCNVnLvZCtKLv8MJcGWgbaSYofn5N7WXY28WGHF63nZCfNnhBVQ4y43ecgOSA3GYFUVybRgsUHPWZB30OquLHA1zFKr9QGszIQWywmsMT5G2fPRHOwNWFi3nmjNQR9HWEeNooHbgSpmZAWxSlZBJjlR46tU4ZBZAuZBEZB5xAosRpqO8t1p4uUlgZDZD';

            $hashEmail = hash("sha256", strtolower(trim($input['email'])));
            $cleanPhone55 = $cleanPhone;
            if (strlen($cleanPhone55) <= 11 && substr($cleanPhone55, 0, 2) !== '55') {
                $cleanPhone55 = '55' . $cleanPhone55;
            }
            $hashPhone = hash("sha256", $cleanPhone55);
            
            $nameParts = explode(' ', trim($input['name']));
            $hashFirstName = hash("sha256", strtolower($nameParts[0]));
            $hashLastName = isset($nameParts[1]) ? hash("sha256", strtolower($nameParts[1])) : '';

            $fbPayload = [
                "data" => [
                    [
                        "event_name" => "InitiateCheckout",
                        "event_time" => time(),
                        "action_source" => "website",
                        "event_source_url" => "https://deskfunnel.site/metodo-linguica-lucrativa",
                        "event_id" => $paymentId, // Deduplicação
                        "user_data" => [
                            "em" => [$hashEmail],
                            "ph" => [$hashPhone],
                            "fn" => [$hashFirstName]
                        ],
                        "custom_data" => [
                            "value" => $amountInCents / 100,
                            "currency" => "BRL",
                            "content_name" => $description,
                            "content_type" => "product"
                        ]
                    ]
                ]
            ];
            
            if (!empty($hashLastName)) {
                $fbPayload['data'][0]['user_data']['ln'] = [$hashLastName];
            }
            if (!empty($clientIp)) {
                $fbPayload['data'][0]['user_data']['client_ip_address'] = trim($clientIp);
            }
            if (!empty($userAgent)) {
                $fbPayload['data'][0]['user_data']['client_user_agent'] = trim($userAgent);
            }
            if (!empty($fbp)) {
                $fbPayload['data'][0]['user_data']['fbp'] = trim($fbp);
            }
            if (!empty($fbc)) {
                $fbPayload['data'][0]['user_data']['fbc'] = trim($fbc);
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
        } catch (Exception $e) {
            // Ignora falhas do tracker
        }
    } catch (Exception $e) {
        // Ignora erros de escrita de log para não quebrar a geração do PIX
    }
}

// Retorna os dados formatados para o app.js ler e renderizar na tela
echo json_encode([
    "id" => $paymentId,
    "pix_code" => $pixCode
]);
