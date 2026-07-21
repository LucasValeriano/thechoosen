/**
 * Modal PIX Paradise Pags - JS Autônomo e Integrável
 * 
 * Este script injeta dinamicamente o modal de checkout PIX e seus estilos
 * correspondentes em qualquer página da web, servindo como um checkout 
 * transparente de alta conversão para o DeskFunnel.
 */

(function () {
    // Configurações Globais
    const CONFIG = {
        // Altere a URL abaixo para o endereço real onde hospedará a pasta "api/"
        apiCreatePix: 'api/create-pix.php',
        apiCheckPayment: 'api/check-payment.php',
        pollingInterval: 10000, // 10 segundos
        demoMode: false,        // DESATIVADO: Agora só aprova se o pagamento for real no banco
        expirationMinutes: 10  // Expiração ajustada para 10 minutos
    };

    // Estado da Aplicação
    let appState = {
        currentStep: 1,
        transactionId: null,
        pixCode: '',
        pollingIntervalId: null,
        timerIntervalId: null,
        timerSecondsRemaining: CONFIG.expirationMinutes * 60,
        orderBump1: false,
        orderBump2: false,
        baseAmount: 37.00, // Dinâmico (R$ 37,00)
        baseProductName: 'Manuscrito dos Milagres', // Dinâmico
        formData: {
            nome: '',
            email: '',
            cpf: '',
            whatsapp: ''
        }
    };

    // ==========================================================================
    // ESTILOS CSS INJETADOS DINAMICAMENTE (Encapsulados com prefixo .pxp-)
    // ==========================================================================
    const modalStyles = `
        /* Fontes e Variáveis locais do Modal */
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');

        :root {
            --pxp-gradient-start: #2A0800;
            --pxp-gradient-end: #8B2000;
            --pxp-btn-color: #D35400;
            --pxp-btn-hover: #E67E22;
            --pxp-bg-modal: #FDFAF8;
            --pxp-text-main: #1A0A00;
            --pxp-text-muted: #6B5B52;
            --pxp-success: #10B981;
            --pxp-success-bg: #E6F4EA;
            --pxp-error: #EF4444;
            --pxp-error-bg: #FCE8E6;
            --pxp-radius-lg: 24px;
            --pxp-radius-md: 16px;
            --pxp-radius-sm: 8px;
            --pxp-transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        /* Overlay do Backdrop */
        .pxp-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(26, 10, 0, 0.6);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            z-index: 999999;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.4s ease, visibility 0.4s ease;
            font-family: 'Outfit', sans-serif;
        }

        .pxp-overlay.pxp-active {
            opacity: 1;
            visibility: visible;
        }

        /* Wrapper do Modal */
        .pxp-modal {
            background-color: var(--pxp-bg-modal);
            width: 100%;
            max-width: 460px;
            border-radius: var(--pxp-radius-lg);
            box-shadow: 0 25px 50px -12px rgba(26, 10, 0, 0.3);
            position: relative;
            overflow: hidden;
            transform: scale(0.9) translateY(20px);
            opacity: 0;
            transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease;
            display: flex;
            flex-direction: column;
            max-height: 90vh;
        }

        .pxp-overlay.pxp-active .pxp-modal {
            transform: scale(1) translateY(0);
            opacity: 1;
        }

        /* Botão Fechar */
        .pxp-close-btn {
            position: absolute;
            top: 20px;
            right: 20px;
            background: rgba(26, 10, 0, 0.05);
            border: none;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--pxp-text-main);
            font-size: 18px;
            font-weight: 600;
            transition: var(--pxp-transition);
            z-index: 10;
        }

        .pxp-close-btn:hover {
            background: rgba(26, 10, 0, 0.1);
            transform: rotate(90deg);
        }

        /* Topo do Modal (Identidade Visual) */
        .pxp-header {
            background: linear-gradient(135deg, var(--pxp-gradient-start) 0%, var(--pxp-gradient-end) 100%);
            padding: 32px 24px 24px 24px;
            text-align: center;
            color: #FDFAF8;
            position: relative;
        }

        .pxp-brand-logo-img {
            max-height: 90px;
            display: block;
            margin: 0 auto 12px auto;
            filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.2));
            animation: pxpLogoEntrance 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        
        @keyframes pxpLogoEntrance {
            from { opacity: 0; transform: scale(0.8) translateY(-10px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
        }

        .pxp-brand-logo {
            font-size: 1.5rem;
            font-weight: 800;
            letter-spacing: -0.5px;
            margin-bottom: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }

        .pxp-header p {
            font-size: 0.85rem;
            color: rgba(253, 250, 248, 0.85);
            text-transform: uppercase;
            letter-spacing: 1.5px;
            font-weight: 500;
        }

        /* Corpo do Modal com Scroll Interno */
        .pxp-body {
            padding: 24px;
            overflow-y: auto;
            flex-grow: 1;
            scroll-behavior: smooth;
        }

        /* Ocultação de Etapas */
        .pxp-step {
            display: none;
            animation: pxpFadeIn 0.4s ease;
        }

        .pxp-step.pxp-active-step {
            display: block;
        }

        @keyframes pxpFadeIn {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
        }

        /* ETAPA 1 - Formulário */
        .pxp-title-step {
            font-size: 1.2rem;
            font-weight: 700;
            color: var(--pxp-text-main);
            margin-bottom: 6px;
            text-align: center;
        }

        .pxp-desc-step {
            font-size: 0.88rem;
            color: var(--pxp-text-muted);
            text-align: center;
            margin-bottom: 24px;
        }

        .pxp-form-group {
            margin-bottom: 16px;
            position: relative;
        }

        .pxp-form-group label {
            display: block;
            font-size: 0.85rem;
            font-weight: 600;
            color: var(--pxp-text-main);
            margin-bottom: 6px;
        }

        .pxp-input-wrapper {
            position: relative;
            display: flex;
            align-items: center;
        }

        .pxp-input-icon {
            position: absolute;
            left: 14px;
            font-size: 1rem;
            color: var(--pxp-text-muted);
            pointer-events: none;
        }

        .pxp-input {
            width: 100%;
            background-color: #FFF;
            border: 1.5px solid rgba(26, 10, 0, 0.1);
            border-radius: var(--pxp-radius-sm);
            padding: 12px 12px 12px 40px;
            font-family: 'Outfit', sans-serif;
            font-size: 0.95rem;
            color: var(--pxp-text-main);
            outline: none;
            transition: var(--pxp-transition);
        }

        .pxp-input:focus {
            border-color: var(--pxp-btn-color);
            box-shadow: 0 0 0 3px rgba(211, 84, 0, 0.15);
        }

        .pxp-input.pxp-input-error {
            border-color: var(--pxp-error);
            background-color: #FFF5F5;
        }

        .pxp-error-text {
            color: var(--pxp-error);
            font-size: 0.75rem;
            margin-top: 4px;
            display: none;
            font-weight: 500;
        }

        .pxp-input.pxp-input-error + .pxp-error-text {
            display: block;
        }

        /* Botão Primário */
        .pxp-btn {
            width: 100%;
            background-color: var(--pxp-btn-color);
            color: #FDFAF8;
            border: none;
            padding: 14px 20px;
            border-radius: var(--pxp-radius-md);
            font-family: 'Outfit', sans-serif;
            font-size: 1.05rem;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 8px 20px rgba(211, 84, 0, 0.25);
            transition: var(--pxp-transition);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            margin-top: 24px;
        }

        .pxp-btn:hover {
            background-color: var(--pxp-btn-hover);
            transform: translateY(-1.5px);
            box-shadow: 0 10px 24px rgba(211, 84, 0, 0.35);
        }

        .pxp-btn:active {
            transform: translateY(0);
        }

        .pxp-btn-pulse {
            animation: pxpBtnPulse 2.5s infinite ease-in-out;
        }

        @keyframes pxpBtnPulse {
            0% { box-shadow: 0 8px 20px rgba(211, 84, 0, 0.25); }
            50% { box-shadow: 0 8px 26px rgba(211, 84, 0, 0.55); }
            100% { box-shadow: 0 8px 20px rgba(211, 84, 0, 0.25); }
        }

        .pxp-btn-secondary {
            background-color: rgba(26, 10, 0, 0.05);
            color: var(--pxp-text-main);
            box-shadow: none;
            margin-top: 12px;
        }

        .pxp-btn-secondary:hover {
            background-color: rgba(26, 10, 0, 0.1);
            box-shadow: none;
            transform: none;
        }

        /* ETAPA 2 - Loading */
        .pxp-loading-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 40px 0;
            text-align: center;
        }

        .pxp-spinner {
            width: 56px;
            height: 56px;
            border: 4px solid rgba(211, 84, 0, 0.1);
            border-top: 4px solid var(--pxp-btn-color);
            border-radius: 50%;
            animation: pxpSpin 1s cubic-bezier(0.55, 0.055, 0.675, 0.19) infinite;
            margin-bottom: 24px;
        }

        @keyframes pxpSpin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .pxp-loading-text {
            font-size: 1.1rem;
            font-weight: 700;
            color: var(--pxp-text-main);
            margin-bottom: 8px;
        }

        .pxp-loading-sub {
            font-size: 0.88rem;
            color: var(--pxp-text-muted);
        }

        /* ETAPA 3 - Exibição PIX */
        .pxp-qr-wrapper {
            background-color: #FFF;
            border: 1.5px solid rgba(26, 10, 0, 0.05);
            border-radius: var(--pxp-radius-md);
            padding: 16px;
            width: 200px;
            height: 200px;
            margin: 0 auto 20px auto;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: var(--shadow-soft);
        }

        .pxp-qr-code {
            max-width: 100%;
            max-height: 100%;
            display: block;
        }

        /* Timer de Expiração */
        .pxp-timer-container {
            background-color: rgba(211, 84, 0, 0.08);
            border-radius: 50px;
            padding: 8px 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            width: fit-content;
            margin: 0 auto 20px auto;
            font-size: 0.9rem;
            font-weight: 600;
            color: var(--pxp-btn-color);
        }

        .pxp-timer-icon {
            font-size: 1rem;
            animation: pxpRotateTimer 4s infinite linear;
        }

        @keyframes pxpRotateTimer {
            0% { transform: rotate(0deg); }
            10% { transform: rotate(45deg); }
            50% { transform: rotate(180deg); }
            100% { transform: rotate(360deg); }
        }

        /* Código PIX Copia e Cola */
        .pxp-copia-cola-box {
            background-color: #FFF;
            border: 1.5px dashed rgba(26, 10, 0, 0.15);
            border-radius: var(--pxp-radius-sm);
            padding: 12px;
            margin-bottom: 20px;
            position: relative;
        }

        .pxp-copia-cola-label {
            font-size: 0.75rem;
            font-weight: 700;
            color: var(--pxp-text-muted);
            text-transform: uppercase;
            margin-bottom: 6px;
            display: block;
        }

        .pxp-copia-cola-text {
            font-family: monospace;
            font-size: 0.8rem;
            color: var(--pxp-text-main);
            word-break: break-all;
            white-space: normal;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            padding-right: 10px;
        }

        /* Status Waiting */
        .pxp-status-waiting {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            font-size: 0.85rem;
            font-weight: 600;
            color: var(--pxp-text-muted);
            margin-top: 16px;
            text-align: center;
        }

        .pxp-status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background-color: var(--pxp-btn-color);
            animation: pxpPulseDot 1.5s infinite ease-in-out;
        }

        @keyframes pxpPulseDot {
            0% { transform: scale(0.8); opacity: 0.5; }
            50% { transform: scale(1.2); opacity: 1; }
            100% { transform: scale(0.8); opacity: 0.5; }
        }

        /* ETAPA 4 - Pagamento Aprovado */
        .pxp-success-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 30px 10px;
            text-align: center;
        }

        .pxp-success-icon-circle {
            width: 80px;
            height: 80px;
            background-color: var(--pxp-success-bg);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--pxp-success);
            font-size: 40px;
            margin-bottom: 24px;
            box-shadow: 0 10px 20px rgba(16, 185, 129, 0.15);
            animation: pxpPopSuccess 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        @keyframes pxpPopSuccess {
            0% { transform: scale(0.5); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
        }

        .pxp-success-icon-circle svg {
            width: 44px;
            height: 44px;
            stroke-dasharray: 100;
            stroke-dashoffset: 100;
            animation: pxpDrawCheck 0.8s 0.2s cubic-bezier(0.19, 1, 0.22, 1) forwards;
        }

        @keyframes pxpDrawCheck {
            to { stroke-dashoffset: 0; }
        }

        .pxp-success-title {
            font-size: 1.4rem;
            font-weight: 800;
            color: var(--pxp-text-main);
            margin-bottom: 10px;
        }

        .pxp-success-desc {
            font-size: 0.95rem;
            color: var(--pxp-text-muted);
            margin-bottom: 30px;
            max-width: 280px;
        }

        /* Avisos Gerais / Notificações de Erro */
        .pxp-alert-error {
            background-color: var(--pxp-error-bg);
            border-left: 4px solid var(--pxp-error);
            color: #8C1D18;
            padding: 12px;
            border-radius: 4px;
            font-size: 0.85rem;
            font-weight: 500;
            margin-bottom: 16px;
            display: none;
            animation: pxpFadeIn 0.3s ease;
        }

        /* TOAST FLOATING DE CÓPIA */
        .pxp-toast {
            position: fixed;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%) translateY(100px);
            background-color: var(--pxp-text-main);
            color: #FDFAF8;
            padding: 12px 24px;
            border-radius: 50px;
            font-size: 0.9rem;
            font-weight: 600;
            box-shadow: 0 10px 25px rgba(26, 10, 0, 0.4);
            z-index: 1000000;
            opacity: 0;
            pointer-events: none;
            transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .pxp-toast.pxp-toast-show {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
        }

        .pxp-toast-icon {
            color: var(--pxp-btn-color);
            font-weight: bold;
        }

        /* ==========================================================================
           ESTILOS DO ORDER BUMP (ACESSO VITALÍCIO)
           ========================================================================== */
        .pxp-orderbump-container {
            background-color: rgba(211, 84, 0, 0.04);
            border: 1.5px dashed var(--pxp-btn-color);
            border-radius: var(--pxp-radius-sm);
            padding: 12px;
            margin-top: 12px;
            margin-bottom: 4px;
            transition: var(--pxp-transition);
        }

        .pxp-orderbump-container:hover {
            background-color: rgba(211, 84, 0, 0.08);
        }

        .pxp-orderbump-label {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            cursor: pointer;
            width: 100%;
            user-select: none;
        }

        .pxp-orderbump-checkbox {
            position: absolute;
            opacity: 0;
            cursor: pointer;
            height: 0;
            width: 0;
        }

        .pxp-orderbump-checkbox-custom {
            min-width: 20px;
            min-height: 20px;
            border: 2px solid rgba(26, 10, 0, 0.2);
            border-radius: 4px;
            background-color: #FFF;
            display: inline-block;
            position: relative;
            margin-top: 2px;
            transition: var(--pxp-transition);
        }

        .pxp-orderbump-checkbox:checked + .pxp-orderbump-checkbox-custom {
            background-color: var(--pxp-btn-color);
            border-color: var(--pxp-btn-color);
        }

        .pxp-orderbump-checkbox:checked + .pxp-orderbump-checkbox-custom::after {
            content: "";
            position: absolute;
            left: 6px;
            top: 2px;
            width: 5px;
            height: 10px;
            border: solid #FDFAF8;
            border-width: 0 2.5px 2.5px 0;
            transform: rotate(45deg);
        }

        .pxp-orderbump-content {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            text-align: left;
        }

        .pxp-orderbump-badge {
            background-color: var(--pxp-btn-color);
            color: #FDFAF8;
            font-size: 0.65rem;
            font-weight: 700;
            padding: 2px 6px;
            border-radius: 4px;
            margin-bottom: 4px;
            letter-spacing: 0.5px;
            animation: pxpBadgePulse 2s infinite ease-in-out;
        }
        
        @keyframes pxpBadgePulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
        }

        .pxp-orderbump-title {
            font-size: 0.92rem;
            font-weight: 700;
            color: var(--pxp-text-main);
        }

        .pxp-orderbump-text {
            font-size: 0.82rem;
            color: var(--pxp-text-muted);
            margin-top: 2px;
            line-height: 1.3;
        }

        .pxp-orderbump-image {
            width: 44px;
            height: 44px;
            border-radius: 8px;
            object-fit: cover;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
            align-self: center;
            flex-shrink: 0;
        }

        /* ==========================================================================
           ESTILOS DA LISTA DE DOWNLOADS (ETAPA DE SUCESSO)
           ========================================================================== */
        .pxp-download-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
            max-height: 220px;
            overflow-y: auto;
            width: 100%;
            padding-right: 4px;
            margin-top: 8px;
        }

        /* Custom Scrollbar para a lista de downloads */
        .pxp-download-list::-webkit-scrollbar {
            width: 5px;
        }
        .pxp-download-list::-webkit-scrollbar-track {
            background: rgba(0, 0, 0, 0.05);
            border-radius: 10px;
        }
        .pxp-download-list::-webkit-scrollbar-thumb {
            background: rgba(211, 84, 0, 0.3);
            border-radius: 10px;
        }
        .pxp-download-list::-webkit-scrollbar-thumb:hover {
            background: var(--pxp-btn-color);
        }

        .pxp-download-item {
            display: flex;
            align-items: center;
            background-color: #FFF;
            border: 1px solid rgba(26, 10, 0, 0.08);
            border-radius: 8px;
            padding: 8px 12px;
            text-decoration: none;
            color: inherit;
            transition: var(--pxp-transition);
            gap: 12px;
        }

        .pxp-download-item:hover {
            border-color: var(--pxp-btn-color);
            background-color: rgba(211, 84, 0, 0.02);
            transform: translateY(-1px);
            box-shadow: 0 4px 10px rgba(0,0,0,0.03);
        }

        .pxp-download-icon {
            font-size: 1.4rem;
            flex-shrink: 0;
        }

        .pxp-download-info {
            display: flex;
            flex-direction: column;
            flex: 1;
            text-align: left;
        }

        .pxp-download-name {
            font-size: 0.85rem;
            font-weight: 700;
            color: var(--pxp-text-main);
            line-height: 1.2;
        }

        .pxp-download-size {
            font-size: 0.72rem;
            color: var(--pxp-text-muted);
            margin-top: 1px;
        }

        .pxp-download-btn {
            font-size: 0.75rem;
            font-weight: 700;
            color: var(--pxp-btn-color);
            background-color: rgba(211, 84, 0, 0.08);
            padding: 4px 10px;
            border-radius: 6px;
            transition: var(--pxp-transition);
            flex-shrink: 0;
        }

        .pxp-download-item:hover .pxp-download-btn {
            background-color: var(--pxp-btn-color);
            color: #FDFAF8;
        }

        /* ==========================================================================
           RESPONSIVIDADE E BOTTOM-SHEET MOBILE
           ========================================================================== */
        @media (max-width: 768px) {
            .pxp-overlay {
                align-items: flex-end; /* Posiciona no rodapé no mobile */
            }

            .pxp-modal {
                max-width: 100%;
                border-radius: var(--pxp-radius-lg) var(--pxp-radius-lg) 0 0;
                transform: translateY(100%); /* Desliza de baixo para fora */
                max-height: 88vh;
                box-shadow: 0 -10px 30px rgba(26, 10, 0, 0.15);
            }

            .pxp-overlay.pxp-active .pxp-modal {
                transform: translateY(0);
            }

            .pxp-close-btn {
                top: 12px;
                right: 12px;
                width: 28px;
                height: 28px;
                font-size: 16px;
            }

            .pxp-header {
                padding: 18px 16px 10px 16px !important;
            }

            .pxp-brand-logo-img {
                max-height: 48px !important;
                margin: 0 auto 6px auto !important;
            }

            .pxp-brand-logo {
                font-size: 1.15rem !important;
                margin-bottom: 2px !important;
            }

            .pxp-header p {
                font-size: 0.72rem !important;
                letter-spacing: 1px !important;
            }

            .pxp-body {
                padding: 14px 16px !important;
            }

            /* Compactação de Etapa e Form */
            .pxp-title-step {
                font-size: 1rem !important;
                margin-bottom: 2px !important;
            }

            .pxp-desc-step {
                font-size: 0.78rem !important;
                margin-bottom: 10px !important;
            }

            .pxp-form-group {
                margin-bottom: 8px !important;
            }

            .pxp-form-group label {
                font-size: 0.76rem !important;
                margin-bottom: 2px !important;
            }

            .pxp-input {
                padding: 8px 10px 8px 34px !important;
                font-size: 0.88rem !important;
            }

            .pxp-input-icon {
                left: 12px !important;
                font-size: 0.9rem !important;
            }

            .pxp-btn {
                margin-top: 10px !important;
                padding: 10px 16px !important;
                font-size: 0.95rem !important;
            }

            .pxp-secure-footer {
                margin-top: 8px !important;
                padding-top: 8px !important;
                gap: 4px !important;
                font-size: 0.68rem !important;
            }

            .pxp-secure-logo {
                max-height: 16px !important;
            }

            .pxp-orderbump-container {
                padding: 6px 8px !important;
                margin-top: 6px !important;
                margin-bottom: 1px !important;
            }

            .pxp-orderbump-badge {
                font-size: 0.58rem !important;
                padding: 1px 4px !important;
                margin-bottom: 1px !important;
            }

            .pxp-orderbump-title {
                font-size: 0.82rem !important;
            }

            .pxp-orderbump-text {
                font-size: 0.72rem !important;
                line-height: 1.2 !important;
                margin-top: 1px !important;
            }

            .pxp-orderbump-image {
                width: 36px !important;
                height: 36px !important;
                border-radius: 6px !important;
            }

            /* Barra de puxar no topo do bottom-sheet */
            .pxp-modal::before {
                content: '';
                display: block;
                width: 36px;
                height: 4px;
                background-color: rgba(253, 250, 248, 0.3);
                border-radius: 10px;
                position: absolute;
                top: 6px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 11;
            }
        }

        /* Rodapé de Segurança do PIX */
        .pxp-secure-footer {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 6px;
            margin-top: 24px;
            padding-top: 16px;
            border-top: 1px solid rgba(26, 10, 0, 0.08);
            font-size: 0.72rem;
            color: var(--pxp-text-muted);
            text-align: center;
        }

        .pxp-secure-logo {
            max-height: 22px;
            opacity: 0.85;
            display: block;
            margin: 0 auto;
        }
    `;

    // ==========================================================================
    // ESTRUTURA HTML DO MODAL
    // ==========================================================================
    const modalHTML = `
        <div class="pxp-overlay" id="pxpOverlay">
            <div class="pxp-modal">
                <button type="button" class="pxp-close-btn" id="pxpCloseBtn">&times;</button>
                
                <!-- Cabeçalho -->
                 <div class="pxp-header">
                     <div class="pxp-brand-logo" style="font-size: 20px; font-weight: 800; color: #8B2000; font-family: 'Outfit', sans-serif;">
                         📖 Manuscrito dos Milagres
                     </div>
                     <p>Checkout Seguro PIX</p>
                 </div>
                
                <!-- Corpo -->
                <div class="pxp-body">
                    <div class="pxp-alert-error" id="pxpAlertError">Ocorreu um erro. Tente novamente.</div>
                    
                    <!-- ETAPA 1: Formulário -->
                    <div class="pxp-step pxp-active-step" id="pxpStep1">
                        <h4 class="pxp-title-step">Dados do Comprador</h4>
                        <p class="pxp-desc-step">Preencha seus dados para gerar o código PIX para pagamento.</p>
                        
                        <form id="pxpForm" novalidate>
                            <div class="pxp-form-group">
                                <label for="pxpNome">Nome Completo</label>
                                <div class="pxp-input-wrapper">
                                    <span class="pxp-input-icon">👤</span>
                                    <input type="text" id="pxpNome" class="pxp-input" placeholder="Seu nome completo" required>
                                </div>
                                <span class="pxp-error-text" id="pxpNomeError">Por favor, insira seu nome completo</span>
                            </div>

                            <div class="pxp-form-group">
                                <label for="pxpCpf">CPF</label>
                                <div class="pxp-input-wrapper">
                                    <span class="pxp-input-icon">🆔</span>
                                    <input type="text" id="pxpCpf" class="pxp-input" placeholder="000.000.000-00" maxlength="14" required>
                                </div>
                                <span class="pxp-error-text" id="pxpCpfError">Por favor, insira um CPF válido</span>
                            </div>
                            
                            <div class="pxp-form-group">
                                <label for="pxpEmail">E-mail</label>
                                <div class="pxp-input-wrapper">
                                    <span class="pxp-input-icon">✉️</span>
                                    <input type="email" id="pxpEmail" class="pxp-input" placeholder="exemplo@email.com" required>
                                </div>
                                <span class="pxp-error-text" id="pxpEmailError">Por favor, insira um e-mail válido</span>
                            </div>
                            
                            <button type="submit" class="pxp-btn pxp-btn-pulse" id="pxpSubmitBtn">
                                <span>Gerar PIX - R$ 37,00</span>
                                <span>⚡</span>
                            </button>
                        </form>
                        
                        <div class="pxp-secure-footer">
                            <img src="pix-logo.png" alt="PIX Banco Central" class="pxp-secure-logo">
                            <span>Pagamento processado com segurança via Banco Central do Brasil</span>
                        </div>
                    </div>
                    
                    <!-- ETAPA 2: Loading -->
                    <div class="pxp-step" id="pxpStep2">
                        <div class="pxp-loading-container">
                            <div class="pxp-spinner"></div>
                            <h4 class="pxp-loading-text">Gerando seu PIX...</h4>
                            <p class="pxp-loading-sub">Aguarde enquanto preparamos seu QR Code seguro de pagamento.</p>
                        </div>
                    </div>
                    
                    <!-- ETAPA 3: Exibição do QR Code e Código -->
                    <div class="pxp-step" id="pxpStep3">
                        <h4 class="pxp-title-step">Escaneie o QR Code</h4>
                        <p class="pxp-desc-step">Pague através do aplicativo do seu banco usando o QR Code abaixo.</p>
                        
                        <!-- QR Code Wrapper -->
                        <div class="pxp-qr-wrapper">
                            <img src="" alt="QR Code PIX" class="pxp-qr-code" id="pxpQrCodeImg">
                        </div>
                        
                        <!-- Temporizador -->
                        <div class="pxp-timer-container">
                            <span class="pxp-timer-icon">⏳</span>
                            <span>Expira em: <strong id="pxpTimer">15:00</strong></span>
                        </div>
                        
                        <!-- Caixa Copia e Cola -->
                        <div class="pxp-copia-cola-box">
                            <span class="pxp-copia-cola-label">PIX Copia e Cola</span>
                            <div class="pxp-copia-cola-text" id="pxpCopiaColaText"></div>
                        </div>
                        
                        <!-- Botão Copiar -->
                        <button type="button" class="pxp-btn pxp-btn-pulse" id="pxpCopyBtn">
                            <span>Copiar Código PIX</span>
                            <span>📋</span>
                        </button>
                        
                        <!-- Status Polling -->
                        <div class="pxp-status-waiting">
                            <div class="pxp-status-dot"></div>
                            <span>Aguardando pagamento...</span>
                        </div>
                        
                        <div class="pxp-secure-footer">
                            <img src="pix-logo.png" alt="PIX Banco Central" class="pxp-secure-logo">
                        </div>
                    </div>
                    
                    <!-- ETAPA 4: Pagamento Confirmado -->
                    <div class="pxp-step" id="pxpStep4">
                        <div class="pxp-success-container">
                            <div class="pxp-success-icon-circle">
                                <svg viewBox="0 0 52 52" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round">
                                    <path d="M14 27l8 8 16-16"></path>
                                </svg>
                            </div>
                            <h3 class="pxp-success-title">Pagamento confirmado!</h3>
                            <p class="pxp-success-desc" style="margin-bottom: 12px;">Sua compra foi processada com sucesso. Faça o download dos seus materiais abaixo:</p>
                            
                            <!-- LISTA DE DOWNLOADS DOS PDFS -->
                            <div class="pxp-download-list">
                                <a href="manuscrito-secreto-do-vaticano.pdf" download target="_blank" class="pxp-download-item">
                                    <span class="pxp-download-icon">📕</span>
                                    <div class="pxp-download-info">
                                        <span class="pxp-download-name">O Manuscrito Secreto dos Milagres</span>
                                        <span class="pxp-download-size">PDF • Livro Digital Completo</span>
                                    </div>
                                    <span class="pxp-download-btn">Baixar</span>
                                </a>
                            </div>
                            
                            <button type="button" class="pxp-btn" id="pxpSuccessCloseBtn" style="margin-top: 14px;">
                                <span>Concluir e Fechar</span>
                            </button>
                        </div>
                    </div>
                    
                </div>
            </div>
        </div>
        
        <!-- Toast de Feedback -->
        <div class="pxp-toast" id="pxpToast">
            <span class="pxp-toast-icon">✓</span>
            <span>Código PIX copiado com sucesso!</span>
        </div>
    `;

    // ==========================================================================
    // INICIALIZAÇÃO E INJEÇÃO NO DOM
    // ==========================================================================
    function init() {
        // Evita injeções duplicadas
        if (document.getElementById('pxpOverlay')) return;

        // ==========================================================================
        // RASTREAMENTO: Inicialização Automática do Facebook Pixel
        // ==========================================================================
        if (typeof fbq === 'undefined') {
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '1014856120885286');
            console.log('Pixel do Facebook: Inicializado dinamicamente pelo Modal.');
        } else {
            fbq('init', '1014856120885286');
            console.log('Pixel do Facebook: ID de Pixel vinculado.');
        }
        fbq('track', 'PageView');

        // ==========================================================================
        // RASTREAMENTO: Carregamento Automático do Script da Utmify
        // ==========================================================================
        const utmifyScriptId = 'utmify-script-injection';
        if (!document.getElementById(utmifyScriptId) && !window.utmify) {
            const script = document.createElement('script');
            script.id = utmifyScriptId;
            script.src = 'https://cdn.utmify.com.br/scripts/utms/latest.js';
            script.setAttribute('data-utmify-prevent-xcod-sck', '');
            script.setAttribute('data-utmify-prevent-subids', '');
            script.async = true;
            script.defer = true;
            document.head.appendChild(script);
            console.log('Utmify Script: Carregado dinamicamente pelo Modal.');
        }

        // Injeta os Estilos CSS
        const styleSheet = document.createElement('style');
        styleSheet.type = 'text/css';
        styleSheet.innerText = modalStyles;
        document.head.appendChild(styleSheet);

        // Injeta a estrutura HTML do modal no final do body
        const containerDiv = document.createElement('div');
        containerDiv.innerHTML = modalHTML.trim();
        document.body.appendChild(containerDiv.firstChild);
        document.body.appendChild(containerDiv.lastChild); // Adiciona o Toast

        // Registra os Event Listeners principais
        setupEventListeners();
    }

    // ==========================================================================
    // CONFIGURAÇÃO DOS COMPORTAMENTOS (EVENT LISTENERS)
    // ==========================================================================
    function setupEventListeners() {
        const overlay = document.getElementById('pxpOverlay');
        const closeBtn = document.getElementById('pxpCloseBtn');
        const successCloseBtn = document.getElementById('pxpSuccessCloseBtn');
        const form = document.getElementById('pxpForm');
        const copyBtn = document.getElementById('pxpCopyBtn');

        // Gatilho global para abrir o modal de forma delegada
        document.addEventListener('click', function (e) {
            const trigger = e.target.closest('[data-pix-trigger]') || e.target.closest('.open-pix-modal');
            if (trigger) {
                e.preventDefault();
                
                let basePrice = 37.00; // Padrão
                let planName = 'Método Linguiça Lucrativa (Premium)'; // Padrão
                
                // 1. Detecta via texto interno do botão (super útil no DeskFunnel)
                const buttonText = trigger.innerText ? trigger.innerText.toLowerCase() : '';
                
                // 2. Detecta via classes
                const buttonClasses = trigger.className ? trigger.className.toLowerCase() : '';
                
                // 3. Detecta via href (se for link)
                const buttonHref = trigger.getAttribute('href') ? trigger.getAttribute('href').toLowerCase() : '';
                
                // 4. Detecta via atributos de dados
                const triggerVal = trigger.getAttribute('data-pix-value') || trigger.getAttribute('data-pix-trigger') || trigger.getAttribute('data-pix-price');
                const triggerPlan = trigger.getAttribute('data-pix-plan');
                
                // Flags de detecção
                let detectedBasico = false;
                let detectedPremium = false;
                
                if (triggerPlan) {
                    const cleanPlan = triggerPlan.toLowerCase().trim();
                    if (cleanPlan.includes('basico') || cleanPlan.includes('básico')) detectedBasico = true;
                    if (cleanPlan.includes('premium')) detectedPremium = true;
                }
                
                if (triggerVal) {
                    if (triggerVal === '19' || triggerVal === '19.00') detectedBasico = true;
                    if (triggerVal === '37' || triggerVal === '37.00') detectedPremium = true;
                }
                
                // Pelo texto do botão (ex: "Plano Básico" ou contendo o valor "19")
                if (!detectedBasico && !detectedPremium) {
                    if (buttonText.includes('basico') || buttonText.includes('básico') || buttonText.includes('19')) {
                        detectedBasico = true;
                    } else if (buttonText.includes('premium') || buttonText.includes('37')) {
                        detectedPremium = true;
                    }
                }
                
                // Pelo href do link (ex: href="#basico" ou href="#19")
                if (!detectedBasico && !detectedPremium) {
                    if (buttonHref.includes('basico') || buttonHref.includes('básico') || buttonHref.includes('19')) {
                        detectedBasico = true;
                    } else if (buttonHref.includes('premium') || buttonHref.includes('37')) {
                        detectedPremium = true;
                    }
                }
                
                // Pelas classes do botão
                if (!detectedBasico && !detectedPremium) {
                    if (buttonClasses.includes('basico') || buttonClasses.includes('básico')) {
                        detectedBasico = true;
                    } else if (buttonClasses.includes('premium')) {
                        detectedPremium = true;
                    }
                }
                
                // Aplica o plano detectado ou padrão de 99
                if (detectedBasico) {
                    basePrice = 19.00;
                    planName = 'Método Linguiça Lucrativa (Básico)';
                } else if (detectedPremium) {
                    basePrice = 37.00;
                    planName = 'Método Linguiça Lucrativa (Premium)';
                } else {
                    basePrice = 99.00;
                    planName = 'Método Linguiça Lucrativa';
                }
                
                openModal(basePrice, planName);
            }
        });

        // Fechar Modal no Botão de Fechar
        closeBtn.addEventListener('click', closeModal);
        successCloseBtn.addEventListener('click', closeModal);

        // Fechar Modal ao clicar fora do Modal (no overlay desfocado)
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) {
                closeModal();
            }
        });

        // Validação e envio do Formulário
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            if (validateForm()) {
                generatePix();
            }
        });

        // Máscaras de digitação em tempo real (CPF)
        const cpfInput = document.getElementById('pxpCpf');
        cpfInput.addEventListener('input', function (e) {
            let value = e.target.value.replace(/\D/g, "");
            if (value.length > 11) value = value.slice(0, 11);
            if (value.length > 9) {
                value = value.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
            } else if (value.length > 6) {
                value = value.replace(/^(\d{3})(\d{3})(\d{0,3})$/, "$1.$2.$3");
            } else if (value.length > 3) {
                value = value.replace(/^(\d{3})(\d{0,3})$/, "$1.$2");
            }
            e.target.value = value;
            clearInputError(cpfInput, 'pxpCpfError');
        });

        // Ouvintes de limpeza simples de erros nos inputs
        const nomeInput = document.getElementById('pxpNome');
        nomeInput.addEventListener('input', () => clearInputError(nomeInput, 'pxpNomeError'));

        const emailInput = document.getElementById('pxpEmail');
        emailInput.addEventListener('input', () => clearInputError(emailInput, 'pxpEmailError'));

        // Botão de Copiar Código PIX
        copyBtn.addEventListener('click', copyPixCode);
    }

    // ==========================================================================
    // FUNÇÕES DE ABERTURA E FECHAMENTO DO MODAL
    // ==========================================================================
    function openModal(basePrice, planName) {
        const overlay = document.getElementById('pxpOverlay');
        overlay.classList.add('pxp-active');
        document.body.style.overflow = 'hidden'; // Impede o scroll de fundo
        
        // Define preço base e nome do produto no estado
        if (typeof basePrice === 'number' && !isNaN(basePrice)) {
            appState.baseAmount = basePrice;
        } else {
            appState.baseAmount = 37.00;
        }
        
        if (planName) {
            appState.baseProductName = planName;
        } else {
            appState.baseProductName = 'Manuscrito dos Milagres';
        }
        
        // ==========================================================================
        // RASTREAMENTO: Facebook Pixel - Início de Checkout
        // ==========================================================================
        if (typeof fbq === 'function') {
            fbq('track', 'InitiateCheckout', {
                value: appState.baseAmount,
                currency: 'BRL',
                content_name: appState.baseProductName,
                content_type: 'product'
            });
            console.log('Pixel do Facebook: Checkout Iniciado (InitiateCheckout) trackeado para ' + appState.baseProductName + ' de R$ ' + appState.baseAmount);
        }

        // Reinicia para a etapa 1 ao abrir
        switchStep(1);
        resetState();
    }

    // Expõe a função globalmente para integração simples no DeskFunnel
    window.openPixModal = openModal;

    function closeModal() {
        const overlay = document.getElementById('pxpOverlay');
        overlay.classList.remove('pxp-active');
        document.body.style.overflow = ''; // Restaura scroll de fundo

        // Cancela timers e pollings ativos
        stopPolling();
        stopTimer();
    }

    function switchStep(stepNumber) {
        appState.currentStep = stepNumber;
        document.querySelectorAll('.pxp-step').forEach(step => {
            step.classList.remove('pxp-active-step');
        });
        document.getElementById(`pxpStep${stepNumber}`).classList.add('pxp-active-step');
        
        // Garante que o scroll do corpo do modal volte para o topo ao trocar de tela
        const bodyElement = document.querySelector('.pxp-body');
        if (bodyElement) bodyElement.scrollTop = 0;
    }

    function resetState() {
        // Reseta dados e inputs
        document.getElementById('pxpForm').reset();
        document.getElementById('pxpAlertError').style.display = 'none';
        
        const inputs = ['pxpNome', 'pxpEmail', 'pxpCpf'];
        inputs.forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.classList.remove('pxp-input-error');
                const err = document.getElementById(id + 'Error');
                if (err) err.style.display = 'none';
            }
        });

        appState.orderBump1 = false;
        appState.orderBump2 = false;
        const submitBtn = document.getElementById('pxpSubmitBtn');
        if (submitBtn) {
            const spanText = submitBtn.querySelector('span');
            if (spanText) {
                const formattedBase = appState.baseAmount.toFixed(2).replace('.', ',');
                spanText.innerText = 'Gerar PIX - R$ ' + formattedBase;
            }
        }

        appState.transactionId = null;
        appState.timerSecondsRemaining = CONFIG.expirationMinutes * 60;
    }

    // ==========================================================================
    // MÁSCARAS E VALIDAÇÃO DE ENTRADA DO FORMULÁRIO
    // ==========================================================================
    function validateForm() {
        let isValid = true;

        const nome = document.getElementById('pxpNome');
        const email = document.getElementById('pxpEmail');
        const cpf = document.getElementById('pxpCpf');

        // Valida Nome (Mínimo duas palavras)
        const nameVal = nome.value.trim();
        if (nameVal.length < 5 || !nameVal.includes(' ')) {
            showInputError(nome, 'pxpNomeError');
            isValid = false;
        } else {
            appState.formData.nome = nameVal;
        }

        // Valida CPF (11 dígitos)
        const cpfVal = cpf.value.replace(/\D/g, "");
        if (cpfVal.length !== 11) {
            showInputError(cpf, 'pxpCpfError');
            isValid = false;
        } else {
            appState.formData.cpf = cpfVal;
        }

        // Valida E-mail
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.value.trim())) {
            showInputError(email, 'pxpEmailError');
            isValid = false;
        } else {
            appState.formData.email = email.value.trim();
        }

        appState.formData.whatsapp = "";

        return isValid;
    }

    function showInputError(inputEl, errorId) {
        inputEl.classList.add('pxp-input-error');
        const errorEl = document.getElementById(errorId);
        if (errorEl) errorEl.style.display = 'block';
        
        // Tremor opcional para feedback tátil (microinterações)
        inputEl.style.animation = 'none';
        setTimeout(() => {
            inputEl.style.animation = 'pxpShake 0.35s ease';
        }, 10);
        
        // Injeta animação de tremor temporária se não existir
        if (!document.getElementById('pxpShakeStyle')) {
            const style = document.createElement('style');
            style.id = 'pxpShakeStyle';
            style.innerHTML = `
                @keyframes pxpShake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-4px); }
                    75% { transform: translateX(4px); }
                }
            `;
            document.head.appendChild(style);
        }
    }

    function clearInputError(inputEl, errorId) {
        inputEl.classList.remove('pxp-input-error');
        const errorEl = document.getElementById(errorId);
        if (errorEl) errorEl.style.display = 'none';
    }

    // ==========================================================================
    // RASTREAMENTO: Utilitário para capturar UTMs e parâmetros de tráfego
    // ==========================================================================
    function getUtms() {
        const utms = {};
        
        // Chaves padrão de tráfego que queremos mapear
        const targetKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'src', 'fbclid', 'gclid'];

        // Helper para decodificar JSON e injetar nas utms
        function parseAndInjectJson(jsonStr) {
            try {
                if (jsonStr && (jsonStr.startsWith('{') || jsonStr.startsWith('['))) {
                    const obj = JSON.parse(jsonStr);
                    Object.keys(obj).forEach(k => {
                        const lowerKey = k.toLowerCase();
                        if (targetKeys.includes(lowerKey) || lowerKey.startsWith('utm_')) {
                            utms[lowerKey] = obj[k];
                        }
                    });
                    return true;
                }
            } catch(e) {}
            return false;
        }

        // 1. LER DA URL DA PÁGINA (Caso esteja preservado)
        const search = window.location.search.substring(1);
        if (search) {
            search.split('&').forEach(pair => {
                const parts = pair.split('=');
                if (parts.length === 2) {
                    const key = parts[0].toLowerCase();
                    if (targetKeys.includes(key) || key.startsWith('utm_')) {
                        utms[key] = decodeURIComponent(parts[1]);
                    }
                }
            });
        }
        
        // 2. LER DE TODOS OS COOKIES (Busca exaustiva de Cookies normais e da Utmify)
        try {
            const cookies = document.cookie.split('; ');
            cookies.forEach(cookie => {
                const parts = cookie.split('=');
                if (parts.length >= 2) {
                    const key = parts[0].trim();
                    const value = decodeURIComponent(parts.slice(1).join('=')).trim();
                    const lowerKey = key.toLowerCase();
                    
                    // Se for chave direta de UTM ou tráfego
                    if (targetKeys.includes(lowerKey) || lowerKey.startsWith('utm_')) {
                        if (!utms[lowerKey] && value) utms[lowerKey] = value;
                    }
                    
                    // Se for cookie específico estruturado da Utmify (JSON)
                    if (lowerKey.includes('utmify') || lowerKey === '_utmify_utm' || lowerKey === 'utmify_utm') {
                        parseAndInjectJson(value);
                    }
                }
            });
        } catch(e) {}

        // 3. LER DO LOCALSTORAGE (Busca exaustiva em chaves da Utmify)
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                const lowerKey = key.toLowerCase();
                const value = localStorage.getItem(key);
                
                if (value) {
                    // Se for chave direta
                    if (targetKeys.includes(lowerKey) || lowerKey.startsWith('utm_')) {
                        if (!utms[lowerKey]) utms[lowerKey] = value;
                    }
                    
                    // Se for dados estruturados da Utmify
                    if (lowerKey.includes('utmify') || lowerKey === '_utmify_utm' || lowerKey === 'utmify_utm') {
                        parseAndInjectJson(value);
                    }
                }
            }
        } catch(e) {}

        // 4. LER DO SESSIONSTORAGE (Prevenção extra)
        try {
            for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);
                const lowerKey = key.toLowerCase();
                const value = sessionStorage.getItem(key);
                
                if (value) {
                    if (targetKeys.includes(lowerKey) || lowerKey.startsWith('utm_')) {
                        if (!utms[lowerKey]) utms[lowerKey] = value;
                    }
                    if (lowerKey.includes('utmify') || lowerKey === '_utmify_utm' || lowerKey === 'utmify_utm') {
                        parseAndInjectJson(value);
                    }
                }
            }
        } catch(e) {}

        // Garante que chaves ausentes sejam limpas ou inicializadas como string vazia
        targetKeys.forEach(key => {
            if (!utms[key]) utms[key] = '';
        });

        console.log('Rastreamento de Tráfego Capturado para a Paradise:', utms);
        return utms;
    }

    // ==========================================================================
    // REQUISIÇÕES DE API / FLUXO DE PAGAMENTO
    // ==========================================================================
    function generatePix() {
        switchStep(2); // Transiciona para Etapa 2 (Loading)

        // Limpa erros anteriores
        document.getElementById('pxpAlertError').style.display = 'none';

        appState.orderBump1 = false;
        appState.orderBump2 = false;

        let totalAmount = appState.baseAmount;

        // Prepara dados de envio incluindo UTMs para tracking de backend
        const payload = {
            name: appState.formData.nome,
            email: appState.formData.email,
            cpf: appState.formData.cpf,
            whatsapp: '',
            amount: totalAmount,
            baseAmount: appState.baseAmount,
            baseProductName: appState.baseProductName,
            orderBump1: false,
            orderBump2: false,
            tracking: getUtms()
        };

        // Requisição para criar a transação PIX
        fetch(CONFIG.apiCreatePix, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })
        .then(response => {
            if (!response.ok) throw new Error('Falha no servidor');
            return response.json();
        })
        .then(data => {
            // Sucesso do Servidor Real
            appState.transactionId = data.id || 'TX_' + Date.now();
            appState.pixCode = data.pix_code || appState.pixCode;
            renderPixScreen();
        })
        .catch(err => {
            console.warn("API de Criação indisponível. Ativando simulador integrado (Modo Demo).", err);
            
            if (CONFIG.demoMode) {
                // Simulação inteligente de carregamento (1.5 segundos)
                setTimeout(() => {
                    appState.transactionId = 'TX_DEMO_' + Math.floor(Math.random() * 1000000);
                    renderPixScreen();
                }, 1500);
            } else {
                // Exibe erro caso o modo demo esteja inativo
                switchStep(1);
                const alertError = document.getElementById('pxpAlertError');
                alertError.innerText = "Erro ao conectar com o servidor de pagamento. Tente novamente mais tarde.";
                alertError.style.display = 'block';
            }
        });
    }

    function renderPixScreen() {
        switchStep(3); // Transiciona para a Etapa 3 (QR Code)

        // Configura QR Code utilizando uma API de alta estabilidade e sem CORS
        const qrCodeImg = document.getElementById('pxpQrCodeImg');
        const encodedPix = encodeURIComponent(appState.pixCode);
        qrCodeImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=0&data=${encodedPix}`;

        // Configura Código Copia e Cola na interface
        const codeBox = document.getElementById('pxpCopiaColaText');
        codeBox.innerText = appState.pixCode;

        // Inicia cronômetro regressivo
        startTimer();

        // Inicia Polling de verificação de pagamento
        startPolling();
    }

    // ==========================================================================
    // CRONÔMETRO DE EXPIRAÇÃO
    // ==========================================================================
    function startTimer() {
        stopTimer();
        appState.timerSecondsRemaining = CONFIG.expirationMinutes * 60;
        const timerText = document.getElementById('pxpTimer');

        appState.timerIntervalId = setInterval(function () {
            appState.timerSecondsRemaining--;

            if (appState.timerSecondsRemaining <= 0) {
                stopTimer();
                stopPolling();
                closeModal();
                alert("O código PIX expirou! Por favor, gere um novo código de pagamento.");
                return;
            }

            const minutes = Math.floor(appState.timerSecondsRemaining / 60);
            const seconds = appState.timerSecondsRemaining % 60;
            const paddedMinutes = String(minutes).padStart(2, '0');
            const paddedSeconds = String(seconds).padStart(2, '0');
            
            timerText.innerText = `${paddedMinutes}:${paddedSeconds}`;
        }, 1000);
    }

    function stopTimer() {
        if (appState.timerIntervalId) {
            clearInterval(appState.timerIntervalId);
            appState.timerIntervalId = null;
        }
    }

    // ==========================================================================
    // POLLING (VERIFICAÇÃO PERIÓDICA DO PAGAMENTO)
    // ==========================================================================
    let pollCount = 0; // Utilizado para o simulador
    
    function startPolling() {
        stopPolling();
        pollCount = 0;

        appState.pollingIntervalId = setInterval(function () {
            pollCount++;
            
            // Requisição real
            fetch(`${CONFIG.apiCheckPayment}?id=${appState.transactionId}`)
            .then(response => {
                if (!response.ok) throw new Error('Erro na conexão');
                return response.json();
            })
            .then(data => {
                if (data.status === 'PAID' || data.approved === true) {
                    approvePayment();
                }
            })
            .catch(err => {
                // Fallback do Polling no Modo Demo:
                // Aprova o pagamento automaticamente após 2 consultas de polling (~20 segundos)
                if (CONFIG.demoMode && pollCount >= 2) {
                    approvePayment();
                }
            });
        }, CONFIG.pollingInterval);
    }

    function stopPolling() {
        if (appState.pollingIntervalId) {
            clearInterval(appState.pollingIntervalId);
            appState.pollingIntervalId = null;
        }
    }

    function approvePayment() {
        stopPolling();
        stopTimer();
        switchStep(4); // Transiciona para Etapa 4 (Sucesso)

        let finalAmount = appState.baseAmount;
        let products = [appState.baseProductName];

        if (appState.orderBump1) {
            finalAmount += 9.90;
            products.push('Acesso Vitalício');
        }
        if (appState.orderBump2) {
            finalAmount += 14.90;
            products.push('Grupo VIP no WhatsApp');
        }

        const finalContentName = products.join(' + ');

        // ==========================================================================
        // RASTREAMENTO: Facebook Pixel (Aprovação no Navegador)
        // ==========================================================================
        if (typeof fbq === 'function') {
            fbq('track', 'Purchase', {
                value: finalAmount,
                currency: 'BRL',
                content_name: finalContentName,
                content_type: 'product'
            }, {
                eventID: appState.transactionId // Deduplicação precisa no Facebook CAPI
            });
            console.log('Pixel do Facebook: Compra trackeada com sucesso via navegador com valor R$ ' + finalAmount + ' | ID: ' + appState.transactionId);
        }

        // ==========================================================================
        // RASTREAMENTO: Custom Event para integrações adicionais (Utmify/GTM)
        // ==========================================================================
        try {
            const event = new CustomEvent('pix_purchase_approved', {
                detail: {
                    transactionId: appState.transactionId,
                    amount: finalAmount,
                    email: appState.formData.email,
                    phone: appState.formData.whatsapp,
                    name: appState.formData.nome
                }
            });
            document.dispatchEvent(event);
            console.log('DOM Event "pix_purchase_approved" disparado com sucesso com valor R$ ' + finalAmount);
        } catch (e) {
            console.error('Erro ao disparar evento de rastreamento customizado:', e);
        }
    }

    // ==========================================================================
    // AÇÕES DO USUÁRIO & INTERAÇÕES (COPIAR CÓDIGO)
    // ==========================================================================
    function copyPixCode() {
        const textToCopy = appState.pixCode;
        
        // Método moderno usando Clipboard API
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(textToCopy)
                .then(showCopyToast)
                .catch(fallbackCopy);
        } else {
            fallbackCopy();
        }
    }

    // Método clássico de cópia (para compatibilidade legada ou HTTP)
    function fallbackCopy() {
        const textArea = document.createElement("textarea");
        textArea.value = appState.pixCode;
        textArea.style.position = "fixed";  // Evita scroll da tela
        textArea.style.left = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            document.execCommand('copy');
            showCopyToast();
        } catch (err) {
            console.error('Incapaz de copiar código PIX', err);
        }
        
        document.body.removeChild(textArea);
    }

    function showCopyToast() {
        const toast = document.getElementById('pxpToast');
        toast.classList.add('pxp-toast-show');
        
        setTimeout(function () {
            toast.classList.remove('pxp-toast-show');
        }, 3000);
    }

    // Inicializa o modal assim que o DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
