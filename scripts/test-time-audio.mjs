import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import crypto from "node:crypto";
const require = createRequire(import.meta.url);
const { createHandler } = require("../api/sign-time-audio.js");
const env = {
  CLOUDINARY_CLOUD_NAME: "fixture",
  CLOUDINARY_API_KEY: "123",
  CLOUDINARY_API_SECRET: "test-secret",
};
async function call({
  token = "fixture-token",
  user = { localId: "test", email: "sukogames1996@gmail.com" },
  profile = null,
  config = env,
} = {}) {
  let code, body;
  const res = {
    setHeader() {},
    status(n) {
      code = n;
      return this;
    },
    json(v) {
      body = v;
      return this;
    },
  };
  const fetchImpl = async (url) =>
    url.includes("identitytoolkit")
      ? { ok: true, json: async () => ({ users: [user] }) }
      : { ok: !!profile, json: async () => ({ fields: profile }) };
  await createHandler({
    env: config,
    fetchImpl,
    now: () => 1700000000000,
    folder: "override",
    usePreset: true,
  })(
    {
      method: "POST",
      headers: { authorization: token ? "Bearer " + token : "" },
      body: { folder: "override" },
    },
    res,
  );
  return { code, body };
}
test("audio signing rejects anonymous, non-admin and disabled accounts", async () => {
  assert.equal((await call({ token: null })).code, 401);
  assert.equal(
    (await call({ user: { localId: "test", email: "visitor@example.com" } }))
      .code,
    403,
  );
  assert.equal(
    (
      await call({
        user: {
          localId: "test",
          email: "sukogames1996@gmail.com",
          disabled: true,
        },
      })
    ).code,
    401,
  );
});
test("audio uses its fixed folder without image preset or exposed secret", async () => {
  const { code, body } = await call();
  assert.equal(code, 200);
  assert.deepEqual(body.params, {
    folder: "visitaloja/time/audio",
    timestamp: 1700000000,
  });
  assert.equal(
    body.signature,
    crypto
      .createHash("sha1")
      .update("folder=visitaloja/time/audio&timestamp=1700000000test-secret")
      .digest("hex"),
  );
  assert(!JSON.stringify(body).includes("test-secret"));
  const profile = {
    active: { booleanValue: true },
    role: { stringValue: "admin" },
  };
  assert.equal(
    (
      await call({
        user: { localId: "other", email: "other@example.com" },
        profile,
      })
    ).code,
    200,
  );
  profile.active.booleanValue = false;
  assert.equal(
    (
      await call({
        user: { localId: "other", email: "other@example.com" },
        profile,
      })
    ).code,
    403,
  );
});
test("missing credentials fail clearly; existing posters still require their preset", async () => {
  assert.equal((await call({ config: {} })).code, 503);
  let code;
  await require("../api/sign-event-image.js").createHandler({ env })(
    { method: "POST", headers: { authorization: "Bearer fixture-token" } },
    {
      setHeader() {},
      status(n) {
        code = n;
        return this;
      },
      json() {},
    },
  );
  assert.equal(code, 503);
});
