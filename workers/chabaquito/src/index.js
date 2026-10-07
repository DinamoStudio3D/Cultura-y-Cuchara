const PROJECT_ID = "cultura-y-cuchara";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const FIRESTORE_SCOPE = "https://www.googleapis.com/auth/datastore";
const FIREBASE_JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const ALLOWED_ORIGINS = new Set([
  "https://visitaloja-hu6l8wk0v-dinamostudio3d.vercel.app",
  "https://visitaloja-anqyaznga-dinamostudio3d.vercel.app"
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

function fromFirestoreValue(value) {
  if (!value || typeof value !== "object") return null;
  if ("nullValue" in value) return null;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("stringValue" in value) return value.stringValue;
  if ("timestampValue" in value) return Date.parse(value.timestampValue);
  if ("arrayValue" in value) return (value.arrayValue.values || []).map(fromFirestoreValue);
  if ("mapValue" in value) {
    return Object.fromEntries(
      Object.entries(value.mapValue.fields || {}).map(([key, item]) => [key, fromFirestoreValue(item)])
    );
  }
  return null;
}

function decodeFirestoreDocument(document) {
  return Object.fromEntries(
    Object.entries(document?.fields || {}).map(([key, value]) => [key, fromFirestoreValue(value)])
  );
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

function validDocumentId(value) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

function toFirestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Invalid numeric value");
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (typeof value === "string") return { stringValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toFirestoreValue) } };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  return {
    mapValue: {
      fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toFirestoreValue(item)]))
    }
  };
}

function firestoreFields(value) {
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toFirestoreValue(item)]));
}

function cleanId(value) {
  return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 180);
}

function ecuadorDay(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Guayaquil",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

async function firestoreBeginTransaction(accessToken) {
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:beginTransaction`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ options: { readWrite: {} } })
    }
  );
  if (!response.ok) throw new Error(`Firestore transaction failed to start (${response.status})`);
  const data = await response.json();
  if (!data.transaction) throw new Error("Firestore transaction id was not returned");
  return data.transaction;
}

async function firestoreGetDocumentInTransaction(accessToken, documentPath, transaction) {
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${documentPath}?transaction=${encodeURIComponent(transaction)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Firestore transactional read failed (${response.status})`);
  return response.json();
}

async function firestoreCommit(accessToken, transaction, writes) {
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:commit`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ transaction, writes })
    }
  );
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Firestore commit failed (${response.status}): ${detail.slice(0, 180)}`);
  }
  return response.json();
}

function documentName(path) {
  return `projects/${PROJECT_ID}/databases/(default)/documents/${path}`;
}

async function confirmMerchantVisit(env, user, input) {
  const requestId = String(input?.requestId || "").trim();
  if (!validDocumentId(requestId)) throw new Error("Visit request id is invalid");

  const amountRaw = Number(input?.purchaseAmount || 0);
  const purchaseAmount = Number.isFinite(amountRaw)
    ? Math.max(0, Math.min(100000, Math.round(amountRaw * 100) / 100))
    : 0;
  const receiptRef = String(input?.receiptRef || "").trim().slice(0, 80);
  const accessToken = await getGoogleAccessToken(env);
  const transaction = await firestoreBeginTransaction(accessToken);

  const merchantDocument = await firestoreGetDocumentInTransaction(
    accessToken,
    `missionRewardMerchants/${user.uid}`,
    transaction
  );
  if (!merchantDocument) throw new Error("Merchant account is not authorized");
  const merchant = decodeFirestoreDocument(merchantDocument);
  if (merchant.active === false || !Array.isArray(merchant.placeIds) || !merchant.placeIds.length) {
    throw new Error("Merchant account is not authorized");
  }

  const codePath = `visitCodes/${requestId}`;
  const codeDocument = await firestoreGetDocumentInTransaction(accessToken, codePath, transaction);
  if (!codeDocument) throw new Error("Visit code was not found");
  const code = decodeFirestoreDocument(codeDocument);
  if (code.status !== "pending") throw new Error("Visit code is not pending");
  if (!Number.isFinite(code.expiresAt) || code.expiresAt < Date.now()) throw new Error("Visit code has expired");
  if (!merchant.placeIds.includes(code.placeId)) throw new Error("Merchant cannot confirm this place");
  if (!validDocumentId(code.userId) || !validDocumentId(code.placeId)) throw new Error("Visit code data is invalid");

  const visitPath = `loyaltyVisits/${requestId}`;
  const counterId = cleanId(`${code.userId}_${code.placeId}`);
  const counterPath = `loyaltyCounters/${counterId}`;
  const programPath = `loyaltyPrograms/${code.placeId}`;

  const [visitDocument, counterDocument, programDocument] = await Promise.all([
    firestoreGetDocumentInTransaction(accessToken, visitPath, transaction),
    firestoreGetDocumentInTransaction(accessToken, counterPath, transaction),
    firestoreGetDocumentInTransaction(accessToken, programPath, transaction)
  ]);
  if (visitDocument) throw new Error("Visit was already registered");

  const counter = counterDocument ? decodeFirestoreDocument(counterDocument) : null;
  const program = programDocument ? decodeFirestoreDocument(programDocument) : null;
  const today = ecuadorDay();
  const maxDaily = Math.max(1, Math.min(3, Number(program?.maxVisitsPerDay || 1)));
  const previousDaily = counter?.lastVisitDay === today ? Number(counter.dailyVisitCount || 0) : 0;
  if (previousDaily >= maxDaily) throw new Error("Daily visit limit reached");

  const now = new Date();
  const newCount = Number(counter?.visitCount || 0) + 1;
  const target = Math.max(10, Number(program?.targetVisits || 10));
  const merchantName = merchant.businessName || user.email || "";

  const codeFields = {
    ...decodeFirestoreDocument(codeDocument),
    status: "confirmed",
    confirmedAt: now,
    confirmedBy: user.uid,
    confirmedByName: merchantName,
    updatedAt: now
  };
  const visitFields = {
    requestId,
    userId: code.userId,
    userName: code.userName || "",
    userEmail: code.userEmail || "",
    placeId: code.placeId,
    placeName: code.placeName || "",
    confirmedBy: user.uid,
    confirmedByName: merchantName,
    confirmedAt: now,
    purchaseAmount,
    receiptRef,
    status: "confirmed",
    previousVisitCount: Number(counter?.visitCount || 0),
    previousTotalSpend: Number(counter?.totalSpend || 0),
    previousDailyVisitCount: previousDaily,
    previousLastVisitDay: counter?.lastVisitDay || "",
    previousLastVisitAt: Number.isFinite(counter?.lastVisitAt) ? new Date(counter.lastVisitAt) : null,
    previousLastVisitRequestId: counter?.lastVisitRequestId || ""
  };
  const counterFields = {
    ...(counter || {}),
    userId: code.userId,
    userName: code.userName || counter?.userName || "",
    userEmail: code.userEmail || counter?.userEmail || "",
    placeId: code.placeId,
    placeName: code.placeName || counter?.placeName || "",
    visitCount: newCount,
    lastVisitDay: today,
    dailyVisitCount: previousDaily + 1,
    lastVisitRequestId: requestId,
    lastVisitAt: now,
    totalSpend: Number(counter?.totalSpend || 0) + purchaseAmount,
    updatedAt: now
  };
  if (!counter) counterFields.firstVisitAt = now;

  const writes = [
    { update: { name: documentName(codePath), fields: firestoreFields(codeFields) } },
    { update: { name: documentName(visitPath), fields: firestoreFields(visitFields) }, currentDocument: { exists: false } },
    {
      update: { name: documentName(counterPath), fields: firestoreFields(counterFields) },
      ...(counterDocument ? { currentDocument: { updateTime: counterDocument.updateTime } } : { currentDocument: { exists: false } })
    }
  ];

  await firestoreCommit(accessToken, transaction, writes);
  const missions = await syncTotalVisitMissionProgress(env, code.userId);
  return { visitCount: newCount, target, visitorUid: code.userId, placeId: code.placeId, missions };
}

async function reverseMerchantVisit(env, user, input) {
  const requestId = String(input?.requestId || "").trim();
  if (!validDocumentId(requestId)) throw new Error("Visit request id is invalid");

  const accessToken = await getGoogleAccessToken(env);
  const transaction = await firestoreBeginTransaction(accessToken);
  const merchantDocument = await firestoreGetDocumentInTransaction(
    accessToken,
    `missionRewardMerchants/${user.uid}`,
    transaction
  );
  if (!merchantDocument) throw new Error("Merchant account is not authorized");
  const merchant = decodeFirestoreDocument(merchantDocument);
  if (merchant.active === false || !Array.isArray(merchant.placeIds) || !merchant.placeIds.length) {
    throw new Error("Merchant account is not authorized");
  }

  const visitPath = `loyaltyVisits/${requestId}`;
  const codePath = `visitCodes/${requestId}`;
  const visitDocument = await firestoreGetDocumentInTransaction(accessToken, visitPath, transaction);
  if (!visitDocument) throw new Error("Visit was not found");
  const visit = decodeFirestoreDocument(visitDocument);
  if (visit.status !== "confirmed") throw new Error("Visit is not confirmed");
  if (visit.confirmedBy !== user.uid) throw new Error("Only the confirming merchant can reverse this visit");
  if (!validDocumentId(visit.userId) || !validDocumentId(visit.placeId)) throw new Error("Visit data is invalid");
  if (!merchant.placeIds.includes(visit.placeId)) throw new Error("Merchant cannot reverse this place");
  if (!Number.isFinite(visit.confirmedAt) || Date.now() - visit.confirmedAt > 15 * 60 * 1000) {
    throw new Error("Reversal deadline exceeded");
  }

  const counterId = cleanId(`${visit.userId}_${visit.placeId}`);
  const counterPath = `loyaltyCounters/${counterId}`;
  const programPath = `loyaltyPrograms/${visit.placeId}`;
  const [counterDocument, codeDocument, programDocument] = await Promise.all([
    firestoreGetDocumentInTransaction(accessToken, counterPath, transaction),
    firestoreGetDocumentInTransaction(accessToken, codePath, transaction),
    firestoreGetDocumentInTransaction(accessToken, programPath, transaction)
  ]);
  if (!counterDocument) throw new Error("Loyalty counter was not found");
  const counter = decodeFirestoreDocument(counterDocument);
  if (counter.lastVisitRequestId !== requestId) throw new Error("Only the most recent visit can be reversed");

  const now = new Date();
  const restoredCount = Math.max(0, Number(visit.previousVisitCount || 0));
  const restoredSpend = Math.max(0, Number(visit.previousTotalSpend || 0));
  const restoredDaily = Math.max(0, Number(visit.previousDailyVisitCount || 0));
  const restoredDay = String(visit.previousLastVisitDay || "");
  const restoredLastRequestId = String(visit.previousLastVisitRequestId || "");
  const restoredLastVisitAt = Number.isFinite(visit.previousLastVisitAt)
    ? new Date(visit.previousLastVisitAt)
    : null;
  const target = Math.max(10, Number(decodeFirestoreDocument(programDocument || {}).targetVisits || 10));

  const visitFields = {
    ...visit,
    status: "reversed",
    reversedAt: now,
    reversedBy: user.uid,
    reversedByName: merchant.businessName || user.email || "",
    updatedAt: now
  };
  const counterFields = {
    ...counter,
    visitCount: restoredCount,
    totalSpend: restoredSpend,
    dailyVisitCount: restoredDaily,
    lastVisitDay: restoredDay,
    lastVisitRequestId: restoredLastRequestId,
    lastVisitAt: restoredLastVisitAt,
    updatedAt: now
  };
  const writes = [
    {
      update: { name: documentName(visitPath), fields: firestoreFields(visitFields) },
      currentDocument: { updateTime: visitDocument.updateTime }
    },
    {
      update: { name: documentName(counterPath), fields: firestoreFields(counterFields) },
      currentDocument: { updateTime: counterDocument.updateTime }
    }
  ];
  if (codeDocument) {
    const code = decodeFirestoreDocument(codeDocument);
    writes.push({
      update: {
        name: documentName(codePath),
        fields: firestoreFields({
          ...code,
          status: "reversed",
          reversedAt: now,
          reversedBy: user.uid,
          updatedAt: now
        })
      },
      currentDocument: { updateTime: codeDocument.updateTime }
    });
  }

  await firestoreCommit(accessToken, transaction, writes);
  const missions = await syncTotalVisitMissionProgress(env, visit.userId);
  return { visitCount: restoredCount, target, visitorUid: visit.userId, placeId: visit.placeId, missions };
}

async function firestoreRunQuery(accessToken, structuredQuery) {
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify({ structuredQuery })
    }
  );
  if (!response.ok) throw new Error(`Firestore query failed (${response.status})`);
  const rows = await response.json();
  return rows.map(row => row.document).filter(Boolean);
}

async function loadConfirmedVisits(accessToken, visitorUid) {
  const documents = await firestoreRunQuery(accessToken, {
    from: [{ collectionId: "loyaltyVisits" }],
    where: {
      fieldFilter: { field: { fieldPath: "userId" }, op: "EQUAL", value: { stringValue: visitorUid } }
    }
  });
  return documents.map(document => {
    const visit = decodeFirestoreDocument(document);
    return { ...visit, requestId: visit.requestId || document.name.split("/").pop() };
  }).filter(visit => visit.status === "confirmed" && Number.isFinite(visit.confirmedAt));
}

function missionVisitIsEligible(mission, visit) {
  const startsAt = Number.isFinite(mission?.startsAt) ? mission.startsAt : null;
  const endsAt = Number.isFinite(mission?.endsAt) ? mission.endsAt : null;
  if (startsAt !== null && visit.confirmedAt < startsAt) return false;
  if (endsAt !== null && visit.confirmedAt > endsAt) return false;
  return true;
}

function missionProgressDocumentId(userId, missionId) {
  return `v2_${base64url(userId)}_${base64url(missionId)}`;
}

async function syncTotalVisitMissionProgress(env, visitorUid) {
  const accessToken = await getGoogleAccessToken(env);
  const missionDocuments = await firestoreRunQuery(accessToken, {
    from: [{ collectionId: "chabaquitoMissions" }],
    where: {
      compositeFilter: {
        op: "AND",
        filters: [
          { fieldFilter: { field: { fieldPath: "status" }, op: "EQUAL", value: { stringValue: "active" } } },
          { fieldFilter: { field: { fieldPath: "type" }, op: "EQUAL", value: { stringValue: "total_visits" } } }
        ]
      }
    }
  });
  const confirmedVisits = await loadConfirmedVisits(accessToken, visitorUid);
  const states = [];

  for (const document of missionDocuments) {
    const missionId = document.name.split("/").pop();
    const mission = decodeFirestoreDocument(document);
    const target = Number(mission.targetCount);
    if (!Number.isSafeInteger(target) || target < 1 || target > 500) continue;

    const qualifyingVisits = confirmedVisits.filter(visit => missionVisitIsEligible(mission, visit));
    const qualifyingVisitIds = [...new Set(qualifyingVisits.map(visit => String(visit.requestId || "")).filter(Boolean))];
    const current = Math.min(qualifyingVisitIds.length, target);
    const completed = current >= target;
    const progressId = missionProgressDocumentId(visitorUid, missionId);
    const progressPath = `chabaquitoMissionProgress/${progressId}`;
    const rewardPath = `chabaquitoDigitalRewards/${progressId}`;
    const [existingDocument, rewardDocument] = await Promise.all([
      firestoreGetDocument(accessToken, progressPath),
      firestoreGetDocument(accessToken, rewardPath)
    ]);
    const existing = existingDocument ? decodeFirestoreDocument(existingDocument) : null;
    const now = new Date();
    const progressData = {
      missionId,
      userId: visitorUid,
      current,
      target,
      completed,
      qualifyingVisitIds,
      completedAt: completed
        ? (Number.isFinite(existing?.completedAt) ? new Date(existing.completedAt) : now)
        : null,
      updatedAt: now
    };
    const writes = [{ update: { name: documentName(progressPath), fields: firestoreFields(progressData) } }];

    if (completed && !rewardDocument) {
      writes.push({
        update: {
          name: documentName(rewardPath),
          fields: firestoreFields({
            missionId,
            userId: visitorUid,
            badge: mission.badge || null,
            rewardType: mission.rewardType || "digital",
            physicalCampaignId: mission.physicalCampaignId || null,
            unlockedAt: now,
            source: "chabaquito_mission_v2",
            version: 1
          })
        },
        currentDocument: { exists: false }
      });
    } else if (!completed && rewardDocument) {
      writes.push({ delete: documentName(rewardPath), currentDocument: { updateTime: rewardDocument.updateTime } });
    }

    const response = await fetch(
      `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:commit`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
        body: JSON.stringify({ writes })
      }
    );
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Mission progress write failed (${response.status}): ${detail.slice(0, 180)}`);
    }
    states.push({ missionId, current, target, completed });
  }
  return states;
}

function rankingAlias(value) {
  const alias = String(value || "").trim();
  if (!alias || alias.length > 40 || /[<>\x00-\x1f]/.test(alias)) throw new Error("Public ranking alias is invalid");
  return alias;
}

async function sha256Base64url(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return base64url(digest);
}

function levelForRankingXp(xp) {
  const thresholds = [0, 500, 1500, 3000, 5000, 8000, 12000, 20000];
  return thresholds.filter(min => xp >= min).length;
}

async function saveRankingPreference(env, user, input) {
  const participateInRanking = input?.participateInRanking;
  if (typeof participateInRanking !== "boolean") throw new Error("Ranking preference is invalid");
  const publicAlias = participateInRanking ? rankingAlias(input?.publicAlias) : "";
  const accessToken = await getGoogleAccessToken(env);
  const profilePath = `chabaquitoExplorerProfiles/${user.uid}`;
  const profileDocument = await firestoreGetDocument(accessToken, profilePath);
  if (!profileDocument) throw new Error("Explorer profile was not found");
  const profile = decodeFirestoreDocument(profileDocument);
  const now = new Date();
  const profileFields = {
    ...profile,
    participateInRanking,
    publicAlias,
    updatedAt: now
  };
  const rankingId = await sha256Base64url(user.uid);
  const rankingPath = `chabaquitoPublicRanking/${rankingId}`;
  const writes = [{
    update: { name: documentName(profilePath), fields: firestoreFields(profileFields) },
    currentDocument: { updateTime: profileDocument.updateTime }
  }];

  if (participateInRanking) {
    const xp = Math.max(0, Number(profile.validatedXp || 0));
    if (!Number.isSafeInteger(xp)) throw new Error("Explorer XP is invalid");
    const avatar = profile.publicAvatar == null ? null : String(profile.publicAvatar);
    if (avatar !== null && (!/^https:\/\/[a-z0-9.-]+\//i.test(avatar) || avatar.length > 1000)) {
      throw new Error("Public avatar is invalid");
    }
    const badgeIds = Array.isArray(profile.publicBadgeIds)
      ? profile.publicBadgeIds.filter(id => typeof id === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(id)).slice(0, 3)
      : [];
    writes.push({
      update: {
        name: documentName(rankingPath),
        fields: firestoreFields({
          alias: publicAlias,
          avatar,
          level: levelForRankingXp(xp),
          xp,
          badgeIds,
          updatedAt: now
        })
      }
    });
  } else {
    const rankingDocument = await firestoreGetDocument(accessToken, rankingPath);
    if (rankingDocument) {
      writes.push({ delete: documentName(rankingPath), currentDocument: { updateTime: rankingDocument.updateTime } });
    }
  }

  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:commit`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify({ writes })
    }
  );
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Ranking preference write failed (${response.status}): ${detail.slice(0, 180)}`);
  }
  return { participateInRanking, publicAlias };
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

    if (request.method === "POST" && url.pathname === "/ranking-preference") {
      try {
        const user = await verifyFirebaseIdToken(request);
        const body = await request.json().catch(() => ({}));
        const result = await saveRankingPreference(env, user, body);
        return withCors(json({ ok: true, ...result }), request);
      } catch (error) {
        return withCors(json({ ok: false, error: error.message }, 400), request);
      }
    }
    if (request.method === "POST" && url.pathname === "/merchant-confirm-visit") {
      try {
        const user = await verifyFirebaseIdToken(request);
        const body = await request.json().catch(() => ({}));
        const result = await confirmMerchantVisit(env, user, body);
        return withCors(json({ ok: true, ...result }), request);
      } catch (error) {
        return withCors(json({ ok: false, error: error.message }, 400), request);
      }
    }
    if (request.method === "POST" && url.pathname === "/merchant-reverse-visit") {
      try {
        const user = await verifyFirebaseIdToken(request);
        const body = await request.json().catch(() => ({}));
        const result = await reverseMerchantVisit(env, user, body);
        return withCors(json({ ok: true, ...result }), request);
      } catch (error) {
        return withCors(json({ ok: false, error: error.message }, 400), request);
      }
    }
    return json({ ok: false, error: "Not found" }, 404);
  }
};
