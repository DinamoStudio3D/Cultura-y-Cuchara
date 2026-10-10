/* Existing event controls plus photographs of historical places. No remote deletion. */
(function (root) {
  'use strict';
  const controls = new Map(), jobs = new Map();
  const $ = id => document.getElementById(id);
  function cancel(group) {
    for (const [id, job] of jobs) {
      if (!group || controls.get(id).group === group) {job.contextChanged = true; job.controller.abort();}
    }
  }
  function refresh(group) {
    for (const control of controls.values()) if (control.group === group) {control.preview();control.notice.textContent=control.hint;if(!jobs.has(control.id))control.file.value='';}
  }
  function mount({id, fieldId, formId, group, endpoint, existingFile, existingButton, existingStatus}) {
    const field = $(fieldId);
    if (!field) return;
    const box = document.createElement('div');
    box.className = 'space-y-2 mt-2';
    const file = existingFile ? $(existingFile) : document.createElement('input');
    const upload = existingButton ? $(existingButton) : document.createElement('button');
    const notice = existingStatus ? $(existingStatus) : document.createElement('p');
    const stop = document.createElement('button'), image = document.createElement('img');
    const hint = group === 'events' ? 'JPG, PNG o WebP · máximo 5 MB. Guarda el evento para publicar el afiche.' : 'JPG, PNG o WebP · máximo 20 MB. Guardar punto publica la fotografía.';
    if (!existingFile) {
      file.type = 'file'; file.id = id+'File'; file.accept = 'image/jpeg,image/png,image/webp'; file.className = 'field';
      file.setAttribute('aria-label', 'Elegir '+(id === 'timePast' ? 'fotografía antigua' : 'fotografía actual'));
      upload.type = 'button'; upload.id = id+'Upload'; upload.textContent = 'Subir fotografía';
      upload.className = 'rounded-lg bg-sky-400 text-black font-black px-4 py-2 disabled:opacity-50';
      notice.id = id+'Status'; notice.textContent = hint;
      box.append(file, upload);
    }
    stop.type = 'button'; stop.id = id+'Cancel'; stop.textContent = 'Cancelar subida';
    stop.className = 'hidden rounded-lg border border-gray-600 text-gray-200 px-4 py-2';
    notice.setAttribute('role', 'status'); notice.className = 'text-sm text-gray-300';
    image.id = id+'Preview'; image.className = 'hidden w-full rounded-xl border border-gray-700';
    image.style.cssText = 'max-height:180px;object-fit:contain;background:#0d1420'; image.alt = 'Vista previa de la fotografía';
    box.append(stop);
    if (!existingStatus) box.append(notice);
    box.append(image); field.after(box);
    const preview = () => {
      const value = field.value.trim();
      const safe = root.VisitaLojaHomepage?.safeUrl(value) ?? /^(https:\/\/|\/?[A-Za-z0-9_-])[A-Za-z0-9_./?=&%:~-]*$/.test(value);
      if (value && safe) { image.src = value; image.classList.remove('hidden'); }
      else { image.removeAttribute('src'); image.classList.add('hidden'); }
    };
    image.onerror = () => { image.classList.add('hidden'); notice.textContent = 'No se pudo visualizar la fotografía. Revisa el enlace antes de publicar.'; };
    field.addEventListener('input', preview); field.addEventListener('change', preview);
    stop.addEventListener('click', () => jobs.get(id)?.controller.abort());
    const start = async () => {
      if (jobs.has(id)) return;
      const selected = file.files?.[0];
      try { root.VisitaLojaImageCompressor.validateImageFile(selected, {maxInputBytes:group === 'events' ? 5*1024*1024 : 20*1024*1024}); }
      catch (error) { notice.textContent = error.message; return; }
      let user;
      try { user = auth.currentUser; } catch {}
      if (!user) { notice.textContent = 'Inicia sesión como administrador.'; return; }
      const job = {controller: new AbortController(), target: $(group === 'time' ? 'timeEditIdSecure' : 'generalEventEditId')?.value};
      jobs.set(id, job);
      root.VisitaLojaMediaGuard.begin(formId, id);
      const previousDisabled = field.disabled;
      field.disabled = file.disabled = upload.disabled = true;
      stop.classList.remove('hidden');
      let timedOut = false;
      const timer = setTimeout(() => { timedOut = true; job.controller.abort(); }, 150000);
      try {
        notice.textContent = 'Optimizando fotografía…';
        const optimized = await root.VisitaLojaImageCompressor.compressImageClientSide(selected, root.VisitaLojaImageConfig.CONFIG.compression);
        job.controller.signal.throwIfAborted();
        notice.textContent = 'Autorizando subida…';
        const token = await user.getIdToken();
        job.controller.signal.throwIfAborted();
        const response = await fetch(endpoint, {method:'POST', headers:{Authorization:'Bearer '+token, 'Content-Type':'application/json'}, body:'{}', signal:job.controller.signal});
        const authorization = await response.json().catch(() => ({}));
        if (!response.ok) throw Error(authorization.error || 'No se pudo autorizar la fotografía (HTTP '+response.status+').');
        job.controller.signal.throwIfAborted();
        notice.textContent = 'Subiendo fotografía a Cloudinary…';
        const result = await root.VisitaLojaCloudinaryUploader.uploadSignedImage(optimized.blob, authorization, {filename:id+'-'+Date.now()+'.webp',signal:job.controller.signal});
        job.controller.signal.throwIfAborted();
        if (job.target !== $(group === 'time' ? 'timeEditIdSecure' : 'generalEventEditId')?.value) throw Object.assign(Error('Subida cancelada.'), {name:'AbortError'});
        field.value = result.url;
        field.dispatchEvent(new Event('input', {bubbles:true}));
        if (typeof setAdminUnsavedChanges === 'function') setAdminUnsavedChanges(true);
        notice.textContent = 'Fotografía subida. Revisa la vista previa y guarda '+(group === 'time' ? 'el punto' : 'el evento')+' para publicarla.';
        file.value = '';
      } catch (error) {
        notice.textContent = job.contextChanged ? hint : timedOut ? 'La carga agotó el tiempo disponible. Puedes volver a intentarlo.' : error.name === 'AbortError' ? 'Subida cancelada. Se conserva la fotografía anterior.' : 'No se pudo subir: '+error.message;
      } finally {
        clearTimeout(timer); jobs.delete(id);
        field.disabled = previousDisabled; file.disabled = upload.disabled = false;
        stop.classList.add('hidden'); root.VisitaLojaMediaGuard.end(formId, id);
      }
    };
    if (!existingButton) upload.addEventListener('click', start);
    controls.set(id, {id, group, start, preview, notice, hint, file}); preview();
  }
  function init() {
    mount({id:'timePast',fieldId:'timeImagePast',formId:'timeForm',group:'time',endpoint:'/api/sign-time-image'});
    mount({id:'timePresent',fieldId:'timeImagePresent',formId:'timeForm',group:'time',endpoint:'/api/sign-time-image'});
    mount({id:'eventPoster',fieldId:'generalEventImage',formId:'generalEventForm',group:'events',endpoint:'/api/sign-event-image',existingFile:'generalEventImageFile',existingButton:'generalEventUploadBtn',existingStatus:'generalEventUploadStatus'});
  }
  root.VisitaLojaAdminImages = {cancel, refresh, uploadEvent: () => controls.get('eventPoster')?.start()};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true}); else init();
})(window);
