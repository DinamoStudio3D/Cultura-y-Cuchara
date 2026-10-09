/* Installation is an explicit footer action. Never show an automatic overlay. */
(() => {
    'use strict';
    const button = document.getElementById('installAppBtn');
    let pendingPrompt = null;
    let busy = false;
    const installed = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    const hide = () => { button?.classList.add('hidden'); if (button) button.disabled = false; };
    window.requestVisitaLojaInstall = async () => {
        if (!pendingPrompt || busy || installed()) return;
        const prompt = pendingPrompt;
        pendingPrompt = null;
        busy = true;
        if (button) button.disabled = true;
        try {
            await prompt.prompt();
            await prompt.userChoice;
        } catch (error) {
            console.warn('No se pudo abrir la instalación de Visita Loja:', error);
        } finally {
            busy = false;
            hide();
        }
    };
    window.addEventListener('beforeinstallprompt', event => {
        event.preventDefault();
        if (installed()) return;
        pendingPrompt = event;
        button?.classList.remove('hidden');
    });
    window.addEventListener('appinstalled', () => { pendingPrompt = null; hide(); });
    hide();
})();
