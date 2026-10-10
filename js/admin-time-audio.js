/* Signed historical narrations: files go directly to Cloudinary, never GitHub. */
(function (root) {
  "use strict";
  const MAX = 20 * 1024 * 1024;
  const formats = /\.(mp3|m4a|wav|ogg|aac|flac|opus|webm)$/i;
  const jobs = new Map();
  const $ = (id) => document.getElementById(id);
  function status(node, text, error = false) {
    node.textContent = text;
    node.className = "text-sm " + (error ? "text-red-300" : "text-gray-300");
  }
  function updateSave() {
    $("timeSaveBtn").disabled = jobs.size > 0;
  }
  function cancel() {
    for (const job of jobs.values()) {
      job.controller.abort();
      job.xhr?.abort();
    }
    jobs.clear();
    document
      .querySelectorAll("[data-time-audio-upload]")
      .forEach((button) => (button.disabled = false));
    document
      .querySelectorAll("[data-time-audio-file]")
      .forEach((input) => (input.value = ""));
    document
      .querySelectorAll("[data-time-audio-status]")
      .forEach((node) =>
        status(
          node,
          "MP3, M4A, WAV, OGG, AAC, FLAC, Opus o WebM · máximo 20 MB.",
        ),
      );
    document.querySelectorAll('[id^="timeAudioCancel"]').forEach(button => button.classList.add("hidden"));
    updateSave();
  }
  function send(file, auth, job, notice) {
    if (
      !/^[A-Za-z0-9_-]+$/.test(auth.cloudName || "") ||
      !/^[a-f0-9]{40}$/.test(auth.signature || "") ||
      !auth.apiKey ||
      !Number.isSafeInteger(auth.params?.timestamp) ||
      auth.params?.folder !== "visitaloja/time/audio"
    )
      throw Error("La autorización de audio no es válida.");
    const body = new FormData();
    body.append("file", file, file.name);
    body.append("folder", auth.params.folder);
    body.append("timestamp", String(auth.params.timestamp));
    body.append("api_key", auth.apiKey);
    body.append("signature", auth.signature);
    return new Promise((resolve, reject) => {
      const xhr = (job.xhr = new XMLHttpRequest());
      xhr.open(
        "POST",
        "https://api.cloudinary.com/v1_1/" + auth.cloudName + "/video/upload",
      );
      xhr.timeout = 120000;
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable)
          status(
            notice,
            "Subiendo audio… " +
              Math.round((event.loaded / event.total) * 100) +
              "%",
          );
      };
      xhr.onerror = () =>
        reject(
          Error(
            "No se pudo conectar con Cloudinary. Revisa la conexión e inténtalo de nuevo.",
          ),
        );
      xhr.ontimeout = () =>
        reject(
          Error(
            "La subida superó dos minutos. Inténtalo con un archivo más pequeño.",
          ),
        );
      xhr.onabort = () =>
        reject(
          Object.assign(Error("Subida cancelada."), { name: "AbortError" }),
        );
      xhr.onload = () => {
        let data = {};
        try {
          data = JSON.parse(xhr.responseText);
        } catch {}
        if (xhr.status < 200 || xhr.status >= 300)
          return reject(
            Error(
              data.error?.message
                ? "Cloudinary: " + data.error.message
                : "Cloudinary rechazó el audio (HTTP " + xhr.status + ").",
            ),
          );
        try {
          const url = new URL(data.secure_url);
          if (
            url.protocol !== "https:" ||
            url.hostname !== "res.cloudinary.com" ||
            url.username ||
            url.password ||
            data.resource_type !== "video" ||
            !data.public_id
          )
            throw Error();
          resolve(url.href);
        } catch {
          reject(Error("Cloudinary no devolvió una URL de audio válida."));
        }
      };
      if (job.controller.signal.aborted)
        return reject(
          Object.assign(Error("Subida cancelada."), { name: "AbortError" }),
        );
      job.controller.signal.addEventListener("abort", () => xhr.abort(), {
        once: true,
      });
      xhr.send(body);
    });
  }
  function mount(fieldId, previewId, language) {
    const field = $(fieldId),
      preview = $(previewId);
    if (!field || !preview) return;
    const box = document.createElement("div");
    box.className = "space-y-2";
    const file = document.createElement("input");
    file.type = "file";
    file.accept = "audio/*,.mp3,.m4a,.wav,.ogg,.aac,.flac,.opus,.webm";
    file.id = "timeAudioFile" + language;
    file.dataset.timeAudioFile = "";
    file.className = "field w-full";
    file.setAttribute(
      "aria-label",
      "Elegir narración en " + (language === "Es" ? "español" : "inglés"),
    );
    const actions = document.createElement("div");
    actions.className = "flex flex-wrap gap-2";
    const upload = document.createElement("button");
    upload.type = "button";
    upload.id = "timeAudioUpload" + language;
    upload.dataset.timeAudioUpload = "";
    upload.textContent = "Subir audio";
    upload.className =
      "rounded-lg bg-sky-400 text-black font-black px-4 py-2 disabled:opacity-50";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.id = "timeAudioRemove" + language;
    remove.textContent = "Quitar audio";
    remove.className =
      "rounded-lg border border-gray-600 text-gray-200 px-4 py-2";
    const notice = document.createElement("p");
    notice.id = "timeAudioStatus" + language;
    notice.dataset.timeAudioStatus = "";
    notice.setAttribute("role", "status");
    status(
      notice,
      "MP3, M4A, WAV, OGG, AAC, FLAC, Opus o WebM · máximo 20 MB.",
    );
    const stop = document.createElement("button");
    stop.type = "button";
    stop.id = "timeAudioCancel" + language;
    stop.textContent = "Cancelar subida";
    stop.className = "hidden rounded-lg border border-gray-600 text-gray-200 px-4 py-2";
    stop.addEventListener("click", () => jobs.get(language)?.controller.abort());
    actions.append(upload, stop, remove);
    box.append(file, actions, notice);
    field.after(box);
    upload.addEventListener("click", async () => {
      const selected = file.files?.[0];
      if (!selected)
        return status(notice, "Selecciona primero un archivo de audio.", true);
      if (!selected.size || selected.size > MAX)
        return status(notice, "Selecciona un audio de hasta 20 MB.", true);
      if (
        !formats.test(selected.name) ||
        (selected.type &&
          !selected.type.startsWith("audio/") &&
          ![
            "video/webm",
            "application/ogg",
            "application/octet-stream",
          ].includes(selected.type))
      )
        return status(
          notice,
          "El archivo seleccionado no es un audio compatible.",
          true,
        );
      let user;
      try {
        user = auth.currentUser;
      } catch {}
      if (!user)
        return status(
          notice,
          "Inicia sesión como administrador para subir el audio.",
          true,
        );
      const job = { controller: new AbortController() };
      jobs.set(language, job);
      updateSave();
      upload.disabled = true;
      stop.classList.remove("hidden");
      const timer = setTimeout(() => job.controller.abort(), 150000);
      status(notice, "Autorizando subida…");
      try {
        const token = await user.getIdToken();
        const response = await fetch("/api/sign-time-audio", {
          method: "POST",
          headers: { Authorization: "Bearer " + token },
          signal: job.controller.signal,
        });
        let data = {};
        try {
          data = await response.json();
        } catch {}
        if (!response.ok)
          throw Error(
            data.error ||
              "No se pudo autorizar el audio (HTTP " + response.status + ").",
          );
        const url = await send(selected, data, job, notice);
        if (jobs.get(language) !== job) return;
        field.value = url;
        field.dispatchEvent(new Event("input", { bubbles: true }));
        field.dispatchEvent(new Event("change", { bubbles: true }));
        preview.src = url;
        preview.classList.remove("hidden");
        preview.load();
        if (typeof setAdminUnsavedChanges === "function")
          setAdminUnsavedChanges(true);
        status(
          notice,
          "Audio subido. Escúchalo y pulsa Guardar punto para publicarlo.",
        );
        file.value = "";
      } catch (error) {
        if (jobs.get(language) === job)
          status(
            notice,
            error.name === "AbortError"
              ? "Subida cancelada o agotada. Puedes volver a intentarlo."
              : error.message,
            true,
          );
      } finally {
        clearTimeout(timer);
        if (jobs.get(language) === job) {
          jobs.delete(language);
          upload.disabled = false;
          stop.classList.add("hidden");
          updateSave();
        }
      }
    });
    remove.addEventListener("click", () => {
      const job = jobs.get(language);
      if (job) {
        job.controller.abort();
        jobs.delete(language);
        upload.disabled = false;
        stop.classList.add("hidden");
        updateSave();
      }
      field.value = "";
      file.value = "";
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
      if (typeof setAdminUnsavedChanges === "function")
        setAdminUnsavedChanges(true);
      status(
        notice,
        "Audio retirado del formulario. Guarda el punto para aplicar el cambio.",
      );
    });
  }
  function init() {
    mount("timeAudioUrl", "timeAudioPreviewEs", "Es");
    mount("timeAudioUrlEn", "timeAudioPreviewEn", "En");
    $("timeForm")?.addEventListener(
      "submit",
      (event) => {
        if (!jobs.size) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        for (const language of jobs.keys())
          status(
            $("timeAudioStatus" + language),
            "Espera a que termine la subida antes de guardar el punto.",
            true,
          );
      },
      true,
    );
  }
  root.VisitaLojaTimeAudio = { cancel };
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})(window);
