/* Generador de QR de difusión. Aislado de los códigos y colecciones existentes. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const ORIGIN = 'https://www.visitaloja.com';
  const LOGO = 'visita-loja-icon-512.png';
  let logoPromise;
  let generation = 0;
  let current = null;

  function validatedUrl(raw) {
    const value = String(raw || '').trim();
    if (!value) throw new Error('Ingresa una URL antes de generar el QR.');
    if (value.length > 1800) throw new Error('El enlace supera el límite de 1800 caracteres.');
    let url;
    try { url = new URL(value); } catch (_) { throw new Error('Escribe una URL completa que empiece con https://.'); }
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password)
      throw new Error('Utiliza una URL https:// sin usuario ni contraseña.');
    if (!url.hostname.startsWith('[') && !url.hostname.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label)))
      throw new Error('El dominio de la URL es inválido. Revisa puntos adicionales, como en https://.visitaloja.com/.');
    if (/(^|\.)visitaloja\.com$/i.test(url.hostname) && (url.pathname === '/fidelidad.html' || url.searchParams.has('checkin')))
      throw new Error('Los enlaces de visitas y fidelidad usan un flujo QR distinto.');
    return url.href;
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
  function qrCode(url, level) {
    if (typeof qrcode !== 'function') throw new Error('La biblioteca QR no está disponible. Recarga la página.');
    try {
      const code = qrcode(0, level);
      code.addData(url, 'Byte');
      code.make();
      return code;
    } catch (_) { throw new Error('El enlace es demasiado largo para este nivel de corrección QR.'); }
  }
  function quietModules() {
    return Math.max(4, Number($('staticQrMargin').value) || 4);
  }
  function modulePixels(code, maxPixels, margin = quietModules()) {
    return Math.max(1, Math.floor(maxPixels / (code.getModuleCount() + margin * 2)));
  }
  function libraryImage(code, pixels, margin = quietModules()) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('No se pudo cargar la imagen QR.'));
      image.src = code.createDataURL(pixels, pixels * margin);
    });
  }
  function logoData() {
    if (!logoPromise) logoPromise = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = 128;
          canvas.getContext('2d').drawImage(image, 0, 0, 128, 128);
          resolve({ image, data: canvas.toDataURL('image/png') });
        } catch (_) { reject(new Error('No se pudo preparar el logo oficial.')); }
      };
      image.onerror = () => reject(new Error('No se pudo cargar el logo oficial.'));
      image.src = LOGO;
    }).catch(error => { logoPromise = null; throw error; });
    return logoPromise;
  }
  function logoGeometry(code, pixels, margin, percent) {
    const count = code.getModuleCount();
    if (count >= 45) throw new Error('Este QR tiene una marca de alineación central. No se permite el logo en esta URL; desactívalo.');
    const size = Math.max(2, Math.round(count * percent / 100)) * pixels;
    const patch = size + pixels;
    const side = (count + margin * 2) * pixels;
    return { size, patch, x: Math.round((side - patch) / 2), y: Math.round((side - patch) / 2) };
  }
  function drawLogo(canvas, logo, code, pixels, margin, percent) {
    const { size, patch, x, y } = logoGeometry(code, pixels, margin, percent);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, patch, patch);
    const inset = Math.round((patch - size) / 2);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(logo.image, x + inset, y + inset, size, size);
  }
  function svgWithLogo(svg, logo, code, pixels, margin, percent) {
    const { size, patch, x, y } = logoGeometry(code, pixels, margin, percent);
    const inset = Math.round((patch - size) / 2);
    return svg.replace('</svg>', `<rect x="${x}" y="${y}" width="${patch}" height="${patch}" fill="white"/><image x="${x + inset}" y="${y + inset}" width="${size}" height="${size}" href="${logo.data}"/></svg>`);
  }
  function copyImage(image) {
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.imageSmoothingEnabled = false;
    context.drawImage(image, 0, 0);
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
      const wantsLogo = $('staticQrLogo').checked;
      if (wantsLogo && $('staticQrLevel').value !== 'H') {
        $('staticQrLevel').value = 'H';
        notice('Con logo se utiliza corrección H. Comprueba el QR con tu teléfono antes de imprimir.', false);
      }
      const code = qrCode(url, $('staticQrLevel').value);
      const margin = quietModules();
      const logoSize = Number($('staticQrLogoSize').value);
      if (wantsLogo) logoGeometry(code, 1, margin, logoSize);
      const preview = $('staticQrPreview');
      const available = Math.min(320, Math.max(160, (preview.clientWidth || 320) - 16));
      const pixels = modulePixels(code, available, margin);
      const [image, logo] = await Promise.all([libraryImage(code, pixels, margin), wantsLogo ? logoData() : Promise.resolve(null)]);
      if (token !== generation) return;
      const canvas = copyImage(image);
      if (logo) drawLogo(canvas, logo, code, pixels, margin, logoSize);
      assertQrDestination(canvas, url);
      if (token !== generation) return;
      if (logo) image.src = canvas.toDataURL('image/png');
      image.alt = 'QR de ' + url;
      image.className = 'static-qr-image';
      preview.replaceChildren(image);
      $('staticQrPreviewUrl').textContent = url;
      $('staticQrPng').disabled = $('staticQrSvg').disabled = false;
      current = { url, code, margin, logo, logoSize };
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
    const pixels = modulePixels(current.code, Number($('staticQrSize').value), current.margin);
    const native = current.code.createSvgTag(pixels, pixels * current.margin);
    const svg = current.logo ? svgWithLogo(native, current.logo, current.code, pixels, current.margin, current.logoSize) : native;
    saveBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), 'svg');
  }
  async function downloadPng() {
    if (!current) return notice('Primero genera un QR válido.');
    const snapshot = current;
    try {
      const pixels = modulePixels(snapshot.code, Number($('staticQrSize').value), snapshot.margin);
      const image = await libraryImage(snapshot.code, pixels, snapshot.margin);
      if (snapshot !== current) return;
      const canvas = copyImage(image);
      if (snapshot.logo) drawLogo(canvas, snapshot.logo, snapshot.code, pixels, snapshot.margin, snapshot.logoSize);
      assertQrDestination(canvas, snapshot.url);
      canvas.toBlob(blob => {
        if (snapshot !== current) return;
        blob ? saveBlob(blob, 'png') : notice('No se pudo exportar el PNG.');
      }, 'image/png');
    } catch (error) { notice(error.message || 'No se pudo exportar el PNG.'); }
  }
  const module = $('qrModule');
  if (!module) return;
  module.addEventListener('input', event => {
    if (event.target.id === 'staticQrUrl') render();
    if (event.target.id === 'staticQrLogoSize') {
      $('staticQrLogoSizeValue').textContent = `${event.target.value}%`;
      if ($('staticQrLogo').checked) render();
    }
  });
  module.addEventListener('change', event => {
    if (event.target.id === 'staticQrDestination') updateDestination();
    else if (['staticQrPlace', 'staticQrSize', 'staticQrMargin', 'staticQrLevel',
      'staticQrDark', 'staticQrLight', 'staticQrLogo'].includes(event.target.id)) render();
  });
  $('staticQrPlace').addEventListener('focus', populatePlaces);
  $('staticQrPng').addEventListener('click', downloadPng);
  $('staticQrSvg').addEventListener('click', downloadSvg);
  updateDestination();
  window.addEventListener('resize', () => { if (current) render(); });
})();
