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
        // Cleanup must never roll back a successfully saved merchant profile.
        console.warn("No se pudo limpiar una imagen anterior.", error);
        results.push({ error: error.message || String(error) });
      }
    }
    return results;
  }

  global.VisitaLojaMerchantImageCleanup = {
    isCloudinaryUrl,
    requestDelete,
    cleanupAfterSave
  };
})(window);
