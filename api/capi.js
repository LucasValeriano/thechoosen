/**
 * Função Serverless da Vercel para envio seguro de eventos CAPI (Facebook Conversions API).
 * Este script roda no servidor (backend) ocultando o seu Token de Acesso do público.
 */

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido' });
    }

    // Configurações do Facebook
    // Recomendável configurar no painel da Vercel como variáveis de ambiente:
    // FB_CAPI_TOKEN e FB_PIXEL_ID.
    const pixelId = process.env.FB_PIXEL_ID || '26069232519364368';
    const accessToken = process.env.FB_CAPI_TOKEN || 'EAAQxZCA3GCbQBQzFX3Nr58EcYPgbAtwgA78i70PvAxZC2ZBnElH5DRZCGOsNkAxqMFncUgcGyE8KNLACO7NV7UwnZAK013eh1cRo4ynhlxyz4J0eZA9U1FFIpDbTejERomG3MKG1Eh2OHmTWBx1vrE56UylYfjn78A3ffXH2lr9ZBToZB3aEZCmBmyMqhA6qZBIPPqxAZDZD';

    const { event_id, event_name, source_url } = req.body;

    if (!event_id || !event_name) {
        return res.status(400).json({ error: 'Event ID e Event Name são obrigatórios' });
    }

    // Capturar dados do visitante para enriquecer o match da CAPI
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';

    // Montar payload para a API de Conversões do Facebook
    const payload = {
        data: [
            {
                event_name: event_name,
                event_time: Math.floor(Date.now() / 1000),
                event_id: event_id,
                event_source_url: source_url || req.headers['referer'] || '',
                action_source: 'website',
                user_data: {
                    client_ip_address: clientIp,
                    client_user_agent: userAgent
                }
            }
        ]
    };

    try {
        const response = await fetch(`https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${accessToken}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (data.error) {
            console.error('Erro CAPI Facebook:', data.error);
            return res.status(500).json({ success: false, error: data.error.message });
        }

        return res.status(200).json({ success: true, data });
    } catch (error) {
        console.error('Erro na requisição CAPI:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}
