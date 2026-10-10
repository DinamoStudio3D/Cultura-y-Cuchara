import assert from "node:assert/strict";
import { test } from "node:test";
import "../js/homepage-content.js";
const { safeUrl, normalize } = globalThis.VisitaLojaHomepage;
test("content links reject executable schemes and credential-bearing URLs", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:image/svg+xml,x",
    "//example.com/x",
    "https://user:password@example.com/x",
    "https://example.com/\n<script>",
  ])
    assert.equal(safeUrl(url), false, url);
  for (const url of [
    "#mapa",
    "/hoteles-en-loja",
    "assets/photos/loja-puerta.webp",
    "https://example.com/loja.webp",
  ])
    assert.equal(safeUrl(url), true, url);
});
test("old settings keep the redesigned defaults; clearing photos uses the neutral marker", () => {
  const base = normalize();
  assert.equal(base.blocks.explore.imageUrl, "assets/photos/loja-puerta.webp");
  assert.equal(base.blocks.mobileWelcome.title, "Loja te espera.");
  const edited = normalize({
    blocks: {
      explore: {
        imageUrl: "",
        enabled: false,
        title: "Mi Loja",
        buttonUrl: "javascript:alert(1)",
      },
    },
  });
  assert.equal(
    edited.blocks.explore.imageUrl,
    "assets/photos/photo-unavailable.svg",
  );
  assert.equal(edited.blocks.explore.enabled, false);
  assert.equal(edited.blocks.explore.title, "Mi Loja");
  assert.equal(edited.blocks.explore.buttonUrl, "#establecimientos");
  assert.equal(
    edited.blocks.entrepreneurs.imageUrl,
    base.blocks.entrepreneurs.imageUrl,
  );
});

test("homepage uploads require an administrator and keep their fixed destination", async () => {
  const { createRequire } = await import("node:module");
  const { createHandler } = createRequire(import.meta.url)(
    "../api/sign-homepage-image.js",
  );
  const env = {
    CLOUDINARY_CLOUD_NAME: "fixture",
    CLOUDINARY_API_KEY: "123",
    CLOUDINARY_API_SECRET: "test-secret",
    CLOUDINARY_UPLOAD_PRESET: "fixture",
  };
  async function call(admin) {
    let status, body;
    const handler = createHandler({
      env,
      folder: "unexpected",
      now: () => 1000,
      fetchImpl: async (url) =>
        url.includes("accounts:lookup")
          ? {
              ok: true,
              json: async () => ({
                users: [
                  {
                    email: "test@example.com",
                    localId: "fixture",
                    customAttributes: JSON.stringify({ admin }),
                  },
                ],
              }),
            }
          : { ok: false },
    });
    await handler(
      {
        method: "POST",
        headers: { authorization: "Bearer fixture.token.test" },
        body: { folder: "unexpected" },
      },
      {
        setHeader() {},
        status(n) {
          status = n;
          return this;
        },
        json(v) {
          body = v;
        },
      },
    );
    return { status, body };
  }
  assert.equal((await call(false)).status, 403);
  const permitted = await call(true);
  assert.equal(permitted.status, 200);
  assert.equal(permitted.body.params.folder, "visitaloja/homepage");
  assert(!JSON.stringify(permitted.body).includes(env.CLOUDINARY_API_SECRET));
});
