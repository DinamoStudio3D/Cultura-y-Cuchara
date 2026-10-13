/* Pair administrator-selected solid colors with a measured foreground. */
(() => {
    'use strict';
    function luminance(hex) {
        const value = /^#[\da-f]{6}$/i.test(String(hex)) ? hex.slice(1) : '142b43';
        const channels = [0, 2, 4].map(index => parseInt(value.slice(index, index + 2), 16) / 255)
            .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
        return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    }
    function ink(background) {
        const light = luminance(background);
        return (light + 0.05) / 0.05 >= 1.05 / (light + 0.05) ? '#000000' : '#ffffff';
    }
    function surfaceStyle(background) {
        const foreground = ink(background);
        return `--vl-text:${foreground};--vl-muted:${foreground};--vl-accent:${foreground}`;
    }
    function applySurface(element, background) {
        if (!element) return;
        element.style.setProperty('background', /^#[\da-f]{6}$/i.test(String(background)) ? background : '#142b43', 'important');
        for (const token of ['--vl-text', '--vl-muted', '--vl-accent']) element.style.setProperty(token, ink(background));
    }
    window.VisitaLojaColors = { ink, surfaceStyle, applySurface };
})();
