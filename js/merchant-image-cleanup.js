(function (global) {
  "use strict";

  function isCloudinaryUrl(url) {
    if (typeof url !== "string" || !url) return false;
    try {
      const parsed = new URL(url);
      return parsed.protocol === "https:" && parsed.hostname === "res.cloudinary.com";
    } catch (_) {
      return false;
    }
  }

  async function requestDelete({ auth, placeId, purpose, url }) {
    if (!isCloudinaryUrl(url)) return { skipped: true, reason: "not-cloudinary" };
    const user = auth && auth.currentUser;
    if (!user) throw new Error("Debes iniciar sesión.");
    const response = await fetch("/api/delete-merchant-image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + await user.getIdToken()
      },
      body: JSON.stringify({ placeId, purpose, url })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "No se pudo limpiar la imagen anterior.");
    return result;
  }

  async function cleanupAfterSave(options) {
    const jobs = Array.isArray(options && options.images) ? options.images : [];
    const results = [];
    for (const image of jobs) {
      if (!image || !image.url) continue;
      try {
        results.push(await requestDelete({
          auth: options.auth,
          placeId: options.placeId,
          purpose: image.purpose,
          url: image.url
        }));
      } catch (error) {
        console.warn("No se pudo limpiar una imagen anterior.", error);
        results.push({ error: error.message || String(error) });
      }
    }
    return results;
  }

  // Queue old URLs while the user edits. Nothing is deleted until Firestore
  // has confirmed the profile save. This keeps failed saves reversible.
  function createCleanupQueue() {
    let jobs = [];
    function add(purpose, url) {
      if (!purpose || !url || !isCloudinaryUrl(url)) return;
      if (!jobs.some(job => job.purpose === purpose && job.url === url)) jobs.push({ purpose, url });
    }
    function snapshot() { return jobs.slice(); }
    function clear() { jobs = []; }
    async function flush(options) {
      const images = snapshot();
      if (!images.length) return [];
      const results = await cleanupAfterSave({ auth: options.auth, placeId: options.placeId, images });
      clear();
      return results;
    }
    return Object.freeze({ add, snapshot, clear, flush });
  }

  global.VisitaLojaMerchantImageCleanup = {
    isCloudinaryUrl,
    requestDelete,
    cleanupAfterSave,
    createCleanupQueue
  };
})(window);
