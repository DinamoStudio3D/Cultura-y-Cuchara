const PROJECT_ID = "cultura-y-cuchara";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const FIRESTORE_SCOPE = "https://www.googleapis.com/auth/datastore";
const FIREBASE_JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const ALLOWED_ORIGINS = new Set([
  "https://visitaloja-hu6l8wk0v-dinamostudio3d.vercel.app"
]);

function corsHeaders(request) {
  const origin = request.headers.get("origin") || "";
  return ALLOWED_ORIGINS.has(origin)
    ? {
        "access-control-allow-origin": origin,
        "access-control-allow-methods": "GET,POST,OPTIONS",
        "access-control-allow-headers": "Authorization,Content-Type",
        "access-control-max-age": "600",
        "vary": "Origin"
      }
    : {};
}

function withCors(response, request) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders(request))) headers.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function decodeJwtPart(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(padded), ch => ch.charCodeAt(0))));
}

async function verifyFirebaseIdToken(request) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) throw new Error("Firebase ID token is required");
  const token = authorization.slice(7).trim();
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid Firebase ID token");

  const header = decodeJwtPart(parts[0]);
  const payload = decodeJwtPart(parts[1]);
  if (header.alg !== "RS256" || !header.kid) throw new Error("Unsupported Firebase ID token");

  const keysResponse = await fetch(FIREBASE_JWKS_URL, { cf: { cacheTtl: 3600, cacheEverything: true } });
  if (!keysResponse.ok) throw new Error("Firebase signing keys unavailable");
  const jwks = await keysResponse.json();
  const jwk = Array.isArray(jwks.keys) ? jwks.keys.find(key => key.kid === header.kid) : null;
  if (!jwk) throw new Error("Firebase signing key not found");

  const publicKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const signatureValue = parts[2].replace(/-/g, "+").replace(/_/g, "/");
  const signaturePadded = signatureValue + "=".repeat((4 - signatureValue.length % 4) % 4);
  const signature = Uint8Array.from(atob(signaturePadded), ch => ch.charCodeAt(0));
  const validSignature = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    publicKey,
    signature,
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  );
  if (!validSignature) throw new Error("Invalid Firebase ID token signature");

  const now = Math.floor(Date.now() / 1000);
  if (payload.aud !== PROJECT_ID) throw new Error("Invalid Firebase ID token audience");
  if (payload.iss !== `https://securetoken.google.com/${PROJECT_ID}`) throw new Error("Invalid Firebase ID token issuer");
  if (!payload.sub || typeof payload.sub !== "string" || payload.sub.length > 128) throw new Error("Invalid Firebase user");
  if (!Number.isFinite(payload.exp) || payload.exp <= now) throw new Error("Firebase ID token expired");
  if (!Number.isFinite(payload.iat) || payload.iat > now + 60) throw new Error("Invalid Firebase ID token issued-at time");
  if (Number.isFinite(payload.auth_time) && payload.auth_time > now + 60) throw new Error("Invalid Firebase authentication time");

  return { uid: payload.sub, email: typeof payload.email === "string" ? payload.email : null };
}


const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  }
});

function base64url(input) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function pemToArrayBuffer(pem) {
  const base64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function getGoogleAccessToken(env) {
  if (!env.FIREBASE_SERVICE_ACCOUNT_JSON) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON secret is missing");
  const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (serviceAccount.project_id !== PROJECT_ID || !serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error("Invalid Chabaquito service account");
  }
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: FIRESTORE_SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600
  }));
  const unsignedJwt = `${header}.${payload}`;
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(serviceAccount.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(unsignedJwt)
  );
  const assertion = `${unsignedJwt}.${base64url(signature)}`;
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });
  if (!response.ok) throw new Error(`Google authentication failed (${response.status})`);
  const token = await response.json();
  if (!token.access_token) throw new Error("Google access token was not returned");
  return token.access_token;
}

async function firestoreGetDocument(accessToken, documentPath) {
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${documentPath}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Firestore read failed (${response.status})`);
  return response.json();
}

async function testFirestore(env) {
  const accessToken = await getGoogleAccessToken(env);
  const firestoreUrl =
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/chabaquitoMissions?pageSize=1`;
  const response = await fetch(firestoreUrl, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) throw new Error(`Firestore request failed (${response.status})`);
  const data = await response.json();
  return { documentsFound: Array.isArray(data.documents) ? data.documents.length : 0 };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("origin") || "";
    if (request.method === "OPTIONS") {
      if (!ALLOWED_ORIGINS.has(origin)) return json({ ok: false, error: "Origin not allowed" }, 403);
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }
    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true, service: "chabaquito", project: env.FIREBASE_PROJECT_ID || PROJECT_ID });
    }

    if (request.method === "GET" && url.pathname === "/auth-test") {
      try {
        const user = await verifyFirebaseIdToken(request);
        return withCors(json({ ok: true, authenticated: true, uid: user.uid }), request);
      } catch (error) {
        return withCors(json({ ok: false, authenticated: false, error: error.message }, 401), request);
      }
    }
    if (request.method === "GET" && url.pathname === "/firebase-test") {
      try {
        await getGoogleAccessToken(env);
        return json({ ok: true, service: "chabaquito", firebaseAuth: true, project: PROJECT_ID });
      } catch (error) {
        return json({ ok: false, firebaseAuth: false, error: error.message }, 500);
      }
    }
    if (request.method === "GET" && url.pathname === "/firestore-test") {
      try {
        const result = await testFirestore(env);
        return json({
          ok: true,
          firestore: true,
          project: PROJECT_ID,
          collection: "chabaquitoMissions",
          readable: true,
          documentsFound: result.documentsFound
        });
      } catch (error) {
        return json({ ok: false, firestore: false, error: error.message }, 500);
      }
    }
    return json({ ok: false, error: "Not found" }, 404);
  }
};
