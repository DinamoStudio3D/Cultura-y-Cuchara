const PROJECT_ID = "cultura-y-cuchara";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const FIRESTORE_SCOPE = "https://www.googleapis.com/auth/datastore";

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
    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true, service: "chabaquito", project: env.FIREBASE_PROJECT_ID || PROJECT_ID });
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
