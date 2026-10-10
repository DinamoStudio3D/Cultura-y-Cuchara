(function () {
  "use strict";
  const model = window.VisitaLojaHomepage,
    form = document.getElementById("homepageContentForm");
  if (!model || !form) return;
  const container = form.querySelector("[data-home-editor-blocks]");
  let dirty = false,
    uploadPending = false,
    latestSettings = window.visitaLojaLoadedSettings || {};
  function field(id, label, value, area = false) {
    const wrap = document.createElement("label");
    wrap.className = "block";
    const caption = document.createElement("span");
    caption.className = "block text-sm font-semibold mb-2";
    caption.textContent = label;
    const input = document.createElement(area ? "textarea" : "input");
    input.id = id;
    input.className = "field";
    input.maxLength = /Url$/.test(id) ? 2000 : 700;
    input.value = value;
    wrap.append(caption, input);
    return wrap;
  }
  function build() {
    for (const b of model.blocks) {
      const section = document.createElement("details");
      section.className =
        "bg-black/25 border border-gray-700 rounded-2xl p-4 sm:p-5";
      section.open = b.id === "mobileWelcome";
      const summary = document.createElement("summary");
      summary.className = "font-black text-lg cursor-pointer";
      summary.textContent = b.name;
      section.append(summary);
      const visible = field(
        "home-" + b.id + "-enabled",
        "Mostrar este bloque",
        "",
      );
      visible.querySelector("input").type = "checkbox";
      visible.querySelector("input").className = "w-5 h-5 accent-emerald-500";
      section.append(visible);
      const grid = document.createElement("div");
      grid.className = "grid md:grid-cols-2 gap-4 mt-4";
      for (const [key, label] of b.fields) {
        grid.append(
          field(
            "home-" + b.id + "-" + key,
            label + " · Español",
            "",
            key === "description",
          ),
          field(
            "home-" + b.id + "-" + key + "En",
            label + " · Inglés",
            "",
            key === "description",
          ),
        );
      }
      for (const [key, label] of b.links || [])
        grid.append(field("home-" + b.id + "-" + key, label, ""));
      if (b.image) {
        grid.append(
          field("home-" + b.id + "-imageUrl", "Dirección de la fotografía", ""),
          field(
            "home-" + b.id + "-imageAlt",
            "Descripción accesible de la fotografía",
            "",
          ),
          field(
            "home-" + b.id + "-imageCredit",
            "Crédito de la nueva fotografía (autor y licencia)",
            "",
          ),
        );
        const upload = field(
          "home-" + b.id + "-file",
          "Subir una fotografía desde tu dispositivo",
          "",
        );
        const file = upload.querySelector("input");
        file.type = "file";
        file.accept = "image/jpeg,image/png,image/webp";
        file.removeAttribute("maxlength");
        grid.append(upload);
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className =
          "border border-gray-600 rounded-xl px-4 py-3 text-sm";
        remove.textContent = "Quitar fotografía";
        remove.addEventListener("click", () => {
          document.getElementById("home-" + b.id + "-imageUrl").value = "";
          changed();
        });
        grid.append(remove);
        file.addEventListener("change", () => uploadPhoto(b, file));
      }
      section.append(grid);
      const preview = document.createElement("div");
      preview.className = "home-editor-preview";
      preview.dataset.preview = b.id;
      section.append(preview);
      container.append(section);
    }
  }
  function read() {
    const data = {
      version: 1,
      contactEmail: document.getElementById("home-contactEmail").value.trim(),
      blocks: {},
    };
    for (const b of model.blocks) {
      const saved = {
        enabled: document.getElementById("home-" + b.id + "-enabled").checked,
      };
      for (const [key] of b.fields) {
        saved[key] = document
          .getElementById("home-" + b.id + "-" + key)
          .value.trim();
        saved[key + "En"] = document
          .getElementById("home-" + b.id + "-" + key + "En")
          .value.trim();
      }
      for (const [key] of b.links || [])
        saved[key] = document
          .getElementById("home-" + b.id + "-" + key)
          .value.trim();
      if (b.image)
        for (const key of ["imageUrl", "imageAlt", "imageCredit"])
          saved[key] = document
            .getElementById("home-" + b.id + "-" + key)
            .value.trim();
      data.blocks[b.id] = saved;
    }
    return data;
  }
  function previews() {
    const data = read();
    for (const b of model.blocks) {
      const saved = data.blocks[b.id],
        preview = container.querySelector('[data-preview="' + b.id + '"]');
      preview.replaceChildren();
      if (!saved.enabled) {
        preview.textContent = "Bloque oculto en la web.";
        continue;
      }
      if (b.image) {
        const img = document.createElement("img");
        img.src = model.safeUrl(saved.imageUrl)
          ? saved.imageUrl
          : model.placeholder;
        img.alt = saved.imageAlt;
        img.onerror = () => {
          img.onerror = null;
          img.src = model.placeholder;
        };
        preview.append(img);
      }
      const body = document.createElement("div"),
        title = document.createElement("strong"),
        description = document.createElement("p");
      title.textContent = saved.title;
      description.textContent = saved.description;
      body.append(title, description);
      for (const [key, label] of b.links || []) {
        const span = document.createElement("p");
        span.textContent = label + ": " + saved[key];
        body.append(span);
      }
      preview.append(body);
    }
  }
  function changed() {
    dirty = true;
    if (typeof setAdminUnsavedChanges === "function")
      setAdminUnsavedChanges(true);
    document.getElementById("home-content-status").textContent =
      "Cambios sin publicar";
    previews();
  }
  function load(settings) {
    latestSettings = settings || {};
    if (dirty) return;
    const data = model.normalize(settings?.homepageContent);
    document.getElementById("home-contactEmail").value = data.contactEmail;
    for (const b of model.blocks) {
      const saved = data.blocks[b.id];
      for (const [key, value] of Object.entries(saved)) {
        const input = document.getElementById("home-" + b.id + "-" + key);
        if (input) {
          if (key === "enabled") input.checked = value;
          else input.value = value;
        }
      }
    }
    previews();
  }
  async function uploadPhoto(b, input) {
    const file = input.files[0],
      status = document.getElementById("home-content-status");
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 15 * 1024 * 1024
    ) {
      status.textContent = "Usa JPG, PNG o WebP de hasta 15 MB.";
      input.value = "";
      return;
    }
    uploadPending = true;
    form
      .querySelectorAll('input[type="file"]')
      .forEach((el) => (el.disabled = true));
    document.getElementById("home-content-publish").disabled = true;
    try {
      if (!auth.currentUser) throw Error("Inicia sesión como administrador.");
      status.textContent = "Optimizando y subiendo fotografía…";
      const optimized =
        await window.VisitaLojaImageCompressor.compressImageClientSide(
          file,
          window.VisitaLojaImageConfig.CONFIG.compression,
        );
      const response = await fetch("/api/sign-homepage-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + (await auth.currentUser.getIdToken()),
        },
        body: "{}",
      });
      const authorization = await response.json();
      if (!response.ok)
        throw Error(authorization.error || "No se pudo autorizar la subida.");
      const result =
        await window.VisitaLojaCloudinaryUploader.uploadSignedImage(
          optimized.blob,
          authorization,
          { filename: "portada-" + Date.now() + ".webp" },
        );
      document.getElementById("home-" + b.id + "-imageUrl").value = result.url;
      changed();
      status.textContent =
        "Fotografía subida. Publica los cambios para mostrarla en la web.";
    } catch (error) {
      status.textContent =
        "No se pudo subir: " +
        error.message +
        " Puedes usar una dirección de imagen.";
    } finally {
      uploadPending = false;
      form
        .querySelectorAll('input[type="file"]')
        .forEach((el) => (el.disabled = false));
      input.value = "";
      document.getElementById("home-content-publish").disabled = false;
    }
  }
  build();
  load(latestSettings);
  document
    .getElementById("home-content-discard")
    .addEventListener("click", () => {
      dirty = false;
      if (typeof setAdminUnsavedChanges === "function")
        setAdminUnsavedChanges(false);
      load(latestSettings);
      document.getElementById("home-content-status").textContent =
        "Cambios descartados";
    });
  window.addEventListener("beforeunload", (event) => {
    if (dirty) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
  form.addEventListener("input", changed);
  window.VisitaLojaHomepageEditor = { load, read };
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (uploadPending) return;
    const data = read(),
      status = document.getElementById("home-content-status"),
      button = document.getElementById("home-content-publish");
    if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(data.contactEmail)) {
      status.textContent = "Revisa el correo de contacto.";
      return;
    }
    for (const b of model.blocks) {
      const saved = data.blocks[b.id];
      for (const [key, label] of b.links || [])
        if (!model.safeUrl(saved[key])) {
          status.textContent =
            b.name +
            ": " +
            label +
            " debe ser un enlace HTTPS o un destino de la web.";
          return;
        }
      if (b.image && saved.imageUrl && !model.safeUrl(saved.imageUrl)) {
        status.textContent = b.name + ": la dirección de la foto no es válida.";
        return;
      }
    }
    button.disabled = true;
    status.textContent = "Publicando…";
    try {
      if (!auth.currentUser) throw Error("Inicia sesión como administrador.");
      await settingsRef.set(
        {
          homepageContent: data,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedBy: auth.currentUser.email,
        },
        { merge: true },
      );
      dirty = false;
      if (typeof setAdminUnsavedChanges === "function")
        setAdminUnsavedChanges(false);
      latestSettings = { ...latestSettings, homepageContent: data };
      status.textContent =
        "Publicado. El contenido se actualiza en la web sin otro despliegue.";
    } catch (error) {
      status.textContent =
        "No publicado. " +
        (error.code === "permission-denied"
          ? "Tu cuenta no tiene permiso."
          : error.message || "Revisa la conexión.");
    } finally {
      button.disabled = false;
    }
  });
})();
