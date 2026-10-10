(function () {
  "use strict";
  const model = window.VisitaLojaHomepage;
  if (!model || !document.getElementById("homepageContentForm")) return;
  const editors = [];
  function createEditor(form, selectedBlocks, prefix) {
    const statusId = prefix + "-status",
      publishId = prefix + "-publish",
      discardId = prefix + "-discard";
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
      for (const b of selectedBlocks) {
        const section = document.createElement("details");
        section.className =
          "bg-black/25 border border-gray-700 rounded-2xl p-4 sm:p-5";
        section.open = selectedBlocks.length === 1 || b.id === "mobileWelcome";
        const summary = document.createElement("summary");
        summary.className = "font-black text-lg cursor-pointer";
        summary.textContent = b.name;
        section.append(summary);
        const moduleAnchors = {
          places: "categorias",
          events: "agenda",
          postcards: "postales",
          time: "loja-tiempo",
          podcast: "podcast",
          settings: "especias",
          passport: "pasaporte",
          chabaquitoMissions: "misiones",
        };
        const portadaAnchors = {
          mobileWelcome: "inicio",
          explore: "categorias",
          entrepreneurs: "emprendedores",
          cooking: "especias",
        };
        const anchor =
          b.previewAnchor ||
          (b.id.startsWith("festival")
            ? "fiavl"
            : moduleAnchors[b.adminModule] || portadaAnchors[b.id] || "inicio");
        const publicLink = document.createElement("a");
        publicLink.href = "index.html#" + anchor;
        publicLink.target = "_blank";
        publicLink.rel = "noopener";
        publicLink.className =
          "inline-flex items-center gap-2 text-sm font-bold text-sky-200 underline underline-offset-4 my-3";
        publicLink.textContent = "Ver esta sección en la web ↗";
        publicLink.setAttribute(
          "aria-label",
          "Ver " + b.name + " en la web (nueva pestaña)",
        );
        section.append(publicLink);
        const visible = field(
          "home-" + b.id + "-enabled",
          "Mostrar este bloque",
          "",
        );
        visible.querySelector("input").type = "checkbox";
        visible.querySelector("input").className = "w-5 h-5 accent-emerald-500";
        if (!b.noVisibility) section.append(visible);
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
            field(
              "home-" + b.id + "-imageUrl",
              "Dirección de la fotografía",
              "",
            ),
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

        blocks: {},
      };
      const email = form.querySelector("#home-contactEmail");
      if (email) data.contactEmail = email.value.trim();
      for (const b of selectedBlocks) {
        const saved = {
          enabled: b.noVisibility
            ? true
            : document.getElementById("home-" + b.id + "-enabled").checked,
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
      for (const b of selectedBlocks) {
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
      document.getElementById(statusId).textContent = "Cambios sin publicar";
      previews();
    }
    function load(settings) {
      latestSettings = settings || {};
      if (dirty) return;
      const data = model.normalize(settings?.homepageContent);
      const email = form.querySelector("#home-contactEmail");
      if (email) email.value = data.contactEmail;
      for (const b of selectedBlocks) {
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
        status = document.getElementById(statusId);
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
      document.getElementById(publishId).disabled = true;
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
        document.getElementById("home-" + b.id + "-imageUrl").value =
          result.url;
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
        document.getElementById(publishId).disabled = false;
      }
    }
    build();
    load(latestSettings);
    document.getElementById(discardId).addEventListener("click", () => {
      dirty = false;
      if (typeof setAdminUnsavedChanges === "function")
        setAdminUnsavedChanges(editors.some((editor) => editor.isDirty()));
      load(latestSettings);
      document.getElementById(statusId).textContent = "Cambios descartados";
    });
    window.addEventListener("beforeunload", (event) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    });
    form.addEventListener("input", changed);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (uploadPending) return;
      const data = read(),
        status = document.getElementById(statusId),
        button = document.getElementById(publishId);
      if (
        data.contactEmail !== undefined &&
        !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(data.contactEmail)
      ) {
        status.textContent = "Revisa el correo de contacto.";
        return;
      }
      for (const b of selectedBlocks) {
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
          status.textContent =
            b.name + ": la dirección de la foto no es válida.";
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
          setAdminUnsavedChanges(editors.some((editor) => editor.isDirty()));
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

    return { load, read, isDirty: () => dirty };
  }
  editors.push(
    createEditor(
      document.getElementById("homepageContentForm"),
      model.blocks.filter((b) => !b.adminModule),
      "home-content",
    ),
  );
  for (const moduleName of new Set(
    model.blocks.filter((b) => b.adminModule).map((b) => b.adminModule),
  )) {
    const module = document.getElementById(moduleName + "Module");
    if (!module) continue;
    const prefix = "section-content-" + moduleName,
      form = document.createElement("form");
    form.id = prefix + "-form";
    form.className =
      "space-y-4 mt-8 mb-6 rounded-2xl border border-sky-500/30 p-4 sm:p-6";
    const title = document.createElement("h3");
    title.className = "font-black text-xl text-sky-200";
    title.textContent =
      moduleName === "settings"
        ? "Ingredientes y sabores de ILE"
        : "Presentación de esta sección en la web";
    const help = document.createElement("p");
    help.className = "text-sm text-gray-300";
    help.textContent =
      "Edita la presentación en español e inglés. Este formulario publica solo estos bloques; los registros y funciones se administran con sus controles habituales.";
    const container = document.createElement("div");
    container.dataset.homeEditorBlocks = "";
    container.className = "space-y-4";
    const actions = document.createElement("div");
    actions.className = "flex flex-wrap items-center gap-4";
    const publish = document.createElement("button");
    publish.type = "submit";
    publish.id = prefix + "-publish";
    publish.className =
      "rounded-xl bg-emerald-500 text-black font-black px-5 py-3";
    publish.textContent = "Publicar presentación";
    const discard = document.createElement("button");
    discard.type = "button";
    discard.id = prefix + "-discard";
    discard.className = "border border-gray-600 rounded-xl px-4 py-3 text-sm";
    discard.textContent = "Descartar cambios";
    const status = document.createElement("span");
    status.id = prefix + "-status";
    status.setAttribute("role", "status");
    status.className = "text-sm text-gray-200";
    status.textContent = "Sin cambios pendientes";
    actions.append(publish, discard, status);
    form.append(title, help, container, actions);
    if (moduleName === "settings")
      module.insertBefore(form, document.getElementById("settingsForm"));
    else module.insertBefore(form, module.children[1] || null);
    editors.push(
      createEditor(
        form,
        model.blocks.filter((b) => b.adminModule === moduleName),
        prefix,
      ),
    );
  }
  window.VisitaLojaHomepageEditor = {
    load: (settings) => editors.forEach((editor) => editor.load(settings)),
    read: () => editors[0].read(),
  };
})();
