/* Generador de QR de difusión. Aislado de los códigos y colecciones existentes. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const ORIGIN = 'https://www.visitaloja.com';
  const LOGO = 'visita-loja-icon-512.png'; // Icono publicado en manifest.webmanifest.
  const SVG_NS = 'http://www.w3.org/2000/svg';
  let generation = 0;
  let current = null;
  let logoPromise;

  function validatedUrl(raw) {
    const value = String(raw || '').trim();
    if (!value) throw new Error('Ingresa una URL antes de generar el QR.');
    if (value.length > 1800) throw new Error('El enlace supera el límite de 1800 caracteres.');
    let url;
    try { url = new URL(value); } catch (_) { throw new Error('Escribe una URL completa que empiece con https://.'); }
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password)
      throw new Error('Utiliza una URL https:// sin usuario ni contraseña.');
    if (/(^|\.)visitaloja\.com$/i.test(url.hostname) && (url.pathname === '/fidelidad.html' || url.searchParams.has('checkin')))
      throw new Error('Los enlaces de visitas y fidelidad usan un flujo QR distinto.');
    return url.href;
  }

  function colors() {
    const dark = $('staticQrDark').value, light = $('staticQrLight').value;
    const luminance = hex => {
      const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
      return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
    };
    if (!/^#[0-9a-f]{6}$/i.test(dark) || !/^#[0-9a-f]{6}$/i.test(light) ||
        (Math.max(luminance(dark), luminance(light)) + .05) /
        (Math.min(luminance(dark), luminance(light)) + .05) < 7 ||
        luminance(dark) >= luminance(light))
      throw new Error('El código debe ser oscuro sobre fondo claro, con contraste mínimo de 7:1.');
    return { dark, light };
  }

  function places() {
    if (typeof adminPlaces === 'undefined') return [];
    return adminPlaces.filter(place => (typeof adminPublicationStatus === 'function'
      ? adminPublicationStatus(place) : place.publicationStatus || 'published') === 'published' && place.title);
  }
  function populatePlaces() {
    const select = $('staticQrPlace'), previous = select.value;
    select.replaceChildren(new Option('Selecciona una parada…', ''));
    places().sort((a, b) => a.title.localeCompare(b.title, 'es'))
      .forEach(place => select.add(new Option(place.title, place.id)));
    if ([...select.options].some(option => option.value === previous)) select.value = previous;
  }
  function destination() {
    const kind = $('staticQrDestination').value;
    if (kind === 'manual') return $('staticQrUrl').value;
    if (kind === 'place') {
      const place = places().find(item => item.id === $('staticQrPlace').value);
      if (!place) throw new Error('Selecciona una parada publicada.');
      return publicPlaceUrl(place);
    }
    const paths = { home: '/', routes: '/#mapa', passport: '/#pasaporte',
      agenda: '/#agenda', shop: '/tienda.html', signup: '/sumar-negocio.html' };
    if (!Object.hasOwn(paths, kind)) throw new Error('Selecciona un destino válido.');
    return new URL(paths[kind], ORIGIN).href;
  }
  function logoData() {
    if (!logoPromise) logoPromise = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = 512;
          canvas.getContext('2d').drawImage(image, 0, 0, 512, 512);
          resolve({ image, data: canvas.toDataURL('image/png') });
        } catch (_) { reject(new Error('No se pudo preparar el logo oficial para descarga.')); }
      };
      image.onerror = () => reject(new Error('No se pudo cargar el logo oficial. Inténtalo sin logo.'));
      image.src = LOGO;
    }).catch(error => { logoPromise = null; throw error; });
    return logoPromise;
  }
  function qrMatrix(url, level) {
    if (typeof qrcode !== 'function') throw new Error('La biblioteca QR no está disponible. Recarga la página.');
    let code;
    try {
      code = qrcode(0, level);
      code.addData(url, 'Byte');
      code.make();
    } catch (_) { throw new Error('El enlace es demasiado largo para este nivel de corrección QR.'); }
    const count = code.getModuleCount();
    return Array.from({ length: count }, (_, row) =>
      Array.from({ length: count }, (_, col) => Boolean(code.isDark(row, col))));
  }
  function geometry(data) {
    const length = data.matrix.length, side = length + data.margin * 2;
    const logoSide = length * .14, padding = length * .025;
    const center = side / 2;
    return { length, side, logoSide, padding, center };
  }
  function svgMarkup(data) {
    const { length, side, logoSide, padding, center } = geometry(data);
    let path = '';
    for (let row = 0; row < length; row++) for (let col = 0; col < length; col++)
      if (data.matrix[row][col]) path += `M${col + data.margin} ${row + data.margin}h1v1h-1z`;
    const patch = logoSide + padding * 2;
    const logo = data.logo ? `<rect x="${center - patch / 2}" y="${center - patch / 2}" width="${patch}" height="${patch}" fill="${data.light}"/><image x="${center - logoSide / 2}" y="${center - logoSide / 2}" width="${logoSide}" height="${logoSide}" href="${data.logo.data}"/>` : '';
    return `<svg xmlns="${SVG_NS}" viewBox="0 0 ${side} ${side}" width="${data.size}" height="${data.size}" shape-rendering="crispEdges" role="img" aria-label="Código QR"><rect width="${side}" height="${side}" fill="${data.light}"/><path d="${path}" fill="${data.dark}"/>${logo}</svg>`;
  }
  function pngCanvas(data) {
    const { length, side, logoSide, padding, center } = geometry(data);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = data.size;
    const ctx = canvas.getContext('2d'), unit = data.size / side;
    ctx.fillStyle = data.light; ctx.fillRect(0, 0, data.size, data.size);
    ctx.fillStyle = data.dark;
    for (let row = 0; row < length; row++) for (let col = 0; col < length; col++) {
      if (!data.matrix[row][col]) continue;
      const x = Math.round((col + data.margin) * unit), y = Math.round((row + data.margin) * unit);
      ctx.fillRect(x, y, Math.round((col + data.margin + 1) * unit) - x,
        Math.round((row + data.margin + 1) * unit) - y);
    }
    if (data.logo) {
      const patch = logoSide + padding * 2;
      ctx.fillStyle = data.light;
      ctx.fillRect((center - patch / 2) * unit, (center - patch / 2) * unit, patch * unit, patch * unit);
      ctx.drawImage(data.logo.image, (center - logoSide / 2) * unit,
        (center - logoSide / 2) * unit, logoSide * unit, logoSide * unit);
    }
    return canvas;
  }
  function decodedValue(canvas) {
    if (typeof jsQR !== 'function') throw new Error('No se pudo cargar la verificación de lectura QR. Recarga la página.');
    const { width, height } = canvas;
    const pixels = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, width, height);
    return jsQR(pixels.data, width, height, { inversionAttempts: 'dontInvert' })?.data || '';
  }
  function assertQrDestination(canvas, expected) {
    const actual = decodedValue(canvas);
    if (actual !== expected) throw new Error(actual
      ? `El QR codifica un destino distinto (${actual}). Cambia el diseño o inténtalo nuevamente.`
      : 'El QR no pasó la prueba de lectura. Cambia el diseño o inténtalo nuevamente.');
  }
  function notice(text, error = true) {
    const box = $('staticQrMessage');
    box.textContent = text;
    box.className = `text-sm rounded-xl p-3 ${error ? 'bg-red-500/10 text-red-200' : 'bg-emerald-500/10 text-emerald-200'}`;
  }
  function resetPreview() {
    current = null;
    $('staticQrPreview').replaceChildren();
    const placeholder = document.createElement('p');
    placeholder.className = 'text-sm text-gray-500 px-5 text-center';
    placeholder.textContent = 'El QR aparecerá al ingresar un destino válido.';
    $('staticQrPreview').append(placeholder);
    $('staticQrPreviewUrl').textContent = '—';
    $('staticQrPng').disabled = $('staticQrSvg').disabled = true;
  }
  async function render() {
    const token = ++generation;
    resetPreview();
    $('staticQrMessage').classList.add('hidden');
    if ($('staticQrDestination').value === 'manual' && !$('staticQrUrl').value.trim()) return;
    try {
      const url = validatedUrl(destination());
      const { dark, light } = colors();
      const level = $('staticQrLevel').value;
      const wantsLogo = $('staticQrLogo').checked;
      if (wantsLogo && level !== 'H') throw new Error('Con logo se requiere corrección máxima (H).');
      const matrix = qrMatrix(url, level);
      if (wantsLogo && matrix.length >= 45)
        throw new Error('El enlace requiere un QR cuyo centro puede contener una marca de alineación. Acorta la URL o desactiva el logo.');
      const logo = wantsLogo ? await logoData() : null;
      if (token !== generation) return;
      const data = { url, matrix, logo, dark, light, size: Number($('staticQrSize').value),
        margin: Math.max(4, Number($('staticQrMargin').value) || 4) };
      assertQrDestination(pngCanvas(data), url);
      if (token !== generation) return;
      const svg = svgMarkup(data);
      const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
      if (parsed.querySelector('parsererror')) throw new Error('No se pudo dibujar el QR vectorial.');
      $('staticQrPreview').replaceChildren(document.importNode(parsed.documentElement, true));
      $('staticQrPreviewUrl').textContent = url;
      $('staticQrPng').disabled = $('staticQrSvg').disabled = false;
      current = { ...data, svg };
      if (logo) notice('QR con logo decodificado correctamente. Comprueba también la impresión con tu teléfono.', false);
    } catch (error) {
      if (token !== generation) return;
      notice(error.message || 'No se pudo generar el QR. Revisa el destino y los ajustes.');
      resetPreview();
    }
  }
  function updateDestination() {
    const kind = $('staticQrDestination').value;
    $('staticQrUrlWrap').classList.toggle('hidden', kind !== 'manual');
    $('staticQrPlaceWrap').classList.toggle('hidden', kind !== 'place');
    if (kind === 'place') populatePlaces();
    $('staticQrDestinationHint').textContent = kind === 'routes'
      ? 'Abre el mapa de la web pública. Todavía no existe un enlace directo a una ruta turística concreta.'
      : kind === 'manual' ? 'Usa un enlace https:// válido. No se añaden parámetros de seguimiento.'
      : 'Se utiliza el enlace público real de Visita Loja.';
    render();
  }
  function filename(extension) {
    const name = $('staticQrName').value.trim() || $('staticQrDestination').selectedOptions[0].textContent;
    const slug = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0,75) || 'visita-loja';
    return `visita-loja-qr-${slug}.${extension}`;
  }
  function saveBlob(blob, extension) {
    const url = URL.createObjectURL(blob), anchor = document.createElement('a');
    anchor.href = url; anchor.download = filename(extension); anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  function downloadSvg() {
    if (!current) return notice('Primero genera un QR válido.');
    saveBlob(new Blob([current.svg], { type: 'image/svg+xml;charset=utf-8' }), 'svg');
  }
  function downloadPng() {
    if (!current) return notice('Primero genera un QR válido.');
    const canvas = pngCanvas(current);
    canvas.toBlob(blob => blob ? saveBlob(blob, 'png') : notice('No se pudo exportar el PNG.'), 'image/png');
  }
  const module = $('qrModule');
  if (!module) return;
  module.addEventListener('input', event => {
    if (['staticQrUrl', 'staticQrDark', 'staticQrLight'].includes(event.target.id)) render();
  });
  module.addEventListener('change', event => {
    if (event.target.id === 'staticQrDestination') updateDestination();
    else if (['staticQrPlace', 'staticQrSize', 'staticQrMargin', 'staticQrLevel',
      'staticQrDark', 'staticQrLight', 'staticQrLogo'].includes(event.target.id)) render();
  });
  $('staticQrPlace').addEventListener('focus', populatePlaces);
  $('staticQrPng').addEventListener('click', downloadPng);
  $('staticQrSvg').addEventListener('click', downloadSvg);
})();
