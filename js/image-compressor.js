(function (global) {
  'use strict';

  const DEFAULTS = Object.freeze({
    maxWidth: 1600,
    maxHeight: 1600,
    quality: 0.82,
    mimeType: 'image/webp',
    maxInputBytes: 20 * 1024 * 1024
  });

  const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

  function validateImageFile(file, options) {
    const opts = Object.assign({}, DEFAULTS, options || {});
    if (!file) throw new Error('Selecciona una imagen.');
    if (!ALLOWED_TYPES.has(file.type)) {
      throw new Error('Solo se permiten imágenes JPG, PNG o WebP.');
    }
    if (file.size > opts.maxInputBytes) {
      throw new Error('La imagen original supera el límite permitido.');
    }
    return opts;
  }

  function calculateDimensions(width, height, maxWidth, maxHeight) {
    if (!(width > 0) || !(height > 0)) throw new Error('Dimensiones de imagen no válidas.');
    const ratio = Math.min(1, maxWidth / width, maxHeight / height);
    return {
      width: Math.max(1, Math.round(width * ratio)),
      height: Math.max(1, Math.round(height * ratio))
    };
  }

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('No se pudo leer la imagen seleccionada.'));
      };
      img.src = url;
    });
  }

  function canvasToBlob(canvas, mimeType, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (!blob) return reject(new Error('No se pudo optimizar la imagen.'));
        resolve(blob);
      }, mimeType, quality);
    });
  }

  async function compressImageClientSide(file, options) {
    const opts = validateImageFile(file, options);
    const img = await loadImage(file);
    const dimensions = calculateDimensions(img.naturalWidth, img.naturalHeight, opts.maxWidth, opts.maxHeight);
    const canvas = document.createElement('canvas');
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Este navegador no permite optimizar imágenes.');
    ctx.drawImage(img, 0, 0, dimensions.width, dimensions.height);
    const blob = await canvasToBlob(canvas, opts.mimeType, opts.quality);
    return {
      blob,
      width: dimensions.width,
      height: dimensions.height,
      originalBytes: file.size,
      optimizedBytes: blob.size,
      savingsPercent: file.size ? Math.max(0, Math.round((1 - blob.size / file.size) * 100)) : 0,
      mimeType: blob.type || opts.mimeType
    };
  }

  const api = { DEFAULTS, validateImageFile, calculateDimensions, compressImageClientSide };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.VisitaLojaImageCompressor = api;
})(typeof window !== 'undefined' ? window : globalThis);
