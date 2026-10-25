import '../../../functions/loyalty-season-policy.js';
import '../../../functions/loyalty-consumption.js';
const Consumption=globalThis.VisitaLojaConsumption;
const LoyaltySeasons = globalThis.VisitaLojaLoyaltySeasonPolicy;
const PROJECT_ID = "cultura-y-cuchara";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const FIRESTORE_SCOPE = "https://www.googleapis.com/auth/datastore";
const FIREBASE_JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const ALLOWED_ORIGINS = new Set([
  "https://visitaloja-cfnfu6lib-dinamostudio3d.vercel.app",
  "https://visitaloja-git-improve-existing-rewards-dinamostudio3d.vercel.app",
  "https://visitaloja-git-integration-chabaquito-mis-433c03-dinamostudio3d.vercel.app",
  "https://www.visitaloja.com",
  "https://visitaloja.com"
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

  const [visitDocument, counterDocument, programDocument, passportDocument, placeDocument] = await Promise.all([
    firestoreGetDocumentInTransaction(accessToken, visitPath, transaction),
    firestoreGetDocumentInTransaction(accessToken, counterPath, transaction),
    firestoreGetDocumentInTransaction(accessToken, programPath, transaction),
    firestoreGetDocumentInTransaction(accessToken, "siteContent/passport", transaction),
    firestoreGetDocumentInTransaction(accessToken, `locales/${code.placeId}`, transaction)
  ]);
  if (visitDocument) throw new Error("Visit was already registered");

  const baseCounter = counterDocument ? decodeFirestoreDocument(counterDocument) : {},baseProgram = programDocument ? decodeFirestoreDocument(programDocument) : {};
  const card = LoyaltySeasons.select(baseProgram,baseCounter,Date.now()),counter=card.counter,program=card.program;
  if(!placeDocument)throw new Error('La parada no existe.');
  const consumption=Consumption.validate(input,decodeFirestoreDocument(placeDocument),program);
  const {purchaseAmount,receiptRef}=consumption;
  const passport=decodeFirestoreDocument(passportDocument||{}),campaignId=passport.campaignId||'pasaporte-2026';
  const stampId=cleanId(`${campaignId}_${code.userId}_${code.placeId}`),stampPath=`securePassportStamps/${stampId}`;
  const stampDocument=await firestoreGetDocumentInTransaction(accessToken,stampPath,transaction);
  if(stampDocument){const stamp=decodeFirestoreDocument(stampDocument);if(stamp.userId!==code.userId||stamp.placeId!==code.placeId||stamp.campaignId!==campaignId)throw new Error('Passport stamp requires review before confirmation');}
  const today = ecuadorDay();
  const maxDaily = Math.max(1, Math.min(3, Number(program?.maxVisitsPerDay || 1)));
  const previousDaily = counter?.lastVisitDay === today ? Number(counter.dailyVisitCount || 0) : 0;
  if (previousDaily >= maxDaily) throw new Error("Daily visit limit reached");

  const now = new Date();
  const newCount = Number(counter?.visitCount || 0) + 1;
  const target = Math.max(10, Number(program?.targetVisits || 10));
  const merchantName = merchant.businessName || user.email || "";

  const codeFields = {
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
    ...consumption,
    status: "confirmed",
    ...(!card.seasonal?{previousPermanentPolicy:baseCounter.permanentPolicy||null}:{}), ...(card.seasonal?{seasonId:card.id,seasonTarget:target,previousSeasonCard:baseCounter.seasonalCards?.[card.id]||null}:{}),
    previousVisitCount: Number(counter?.visitCount || 0),
    previousRewardCycles:Number(counter?.rewardCycles||0),
    passportAdded:!stampDocument,
    passportStampId:!stampDocument?stampId:"",
    previousTotalSpend: Number(counter?.totalSpend || 0),
    previousDailyVisitCount: previousDaily,
    previousLastVisitDay: counter?.lastVisitDay || "",
    previousLastVisitAt: Number.isFinite(counter?.lastVisitAt) ? new Date(counter.lastVisitAt) : null,
    previousLastVisitRequestId: counter?.lastVisitRequestId || ""
  };
  const counterFields = {
    userId: code.userId,
    userName: code.userName || counter?.userName || "",
    userEmail: code.userEmail || counter?.userEmail || "",
    placeId: code.placeId,
    placeName: code.placeName || counter?.placeName || "",
    ...LoyaltySeasons.progressPatch(card,baseCounter,newCount),
    lastVisitDay: today,
    dailyVisitCount: previousDaily + 1,
    lastVisitRequestId: requestId,
    lastVisitAt: now,
    totalSpend: Number(counter?.totalSpend || 0) + purchaseAmount,
    updatedAt: now
  };
  if (!counterDocument) counterFields.firstVisitAt = now;

  const writes = [
    { update: { name: documentName(codePath), fields: firestoreFields(codeFields) }, updateMask: { fieldPaths: Object.keys(codeFields) } },
    { update: { name: documentName(visitPath), fields: firestoreFields(visitFields) }, currentDocument: { exists: false } },
    {
      update: { name: documentName(counterPath), fields: firestoreFields(counterFields) },
      updateMask: { fieldPaths: Object.keys(counterFields) },
      ...(counterDocument ? { currentDocument: { updateTime: counterDocument.updateTime } } : { currentDocument: { exists: false } })
    }
  ];

  const programPatch=card.seasonal?{seasonUsage:{...(baseProgram.seasonUsage||{}),[card.id]:true}}:{};
  const oldCycles=Number(counter.rewardCycles||0),cycle=Math.floor(newCount/target),claimed=Number(program.claimedCount||0);
  let rewardCreated=false;
  if(programDocument&&program.active!==false&&cycle>oldCycles&&(program.stock==null||claimed<Number(program.stock))){
    const rewardId=card.seasonal?'season-'+await sha256Hex(JSON.stringify([code.userId,code.placeId,card.id,cycle])):cleanId(`${code.userId}_${code.placeId}_${cycle}`);
    const rewardFields={userId:code.userId,userName:code.userName||'',userEmail:code.userEmail||'',placeId:code.placeId,placeName:code.placeName||'',programId:code.placeId,...(card.seasonal?{seasonId:card.id,seasonTitle:program.title}:{}),cycle,rewardTitle:program.rewardTitle||'Beneficio de fidelidad',rewardDescription:program.rewardDescription||'',claimCode:'FID-'+Array.from(crypto.getRandomValues(new Uint8Array(8)),n=>n.toString(16).padStart(2,'0')).join('').toUpperCase(),status:'pending',createdAt:now,expiresAt:new Date(now.getTime()+Number(program.rewardValidityDays||30)*86400000)};
    visitFields.rewardClaimId=rewardId;
    if(card.seasonal){counterFields.seasonalCards[card.id].rewardCycles=cycle;programPatch.seasonClaimedCounts={...(baseProgram.seasonClaimedCounts||{}),[card.id]:claimed+1};}
    else{counterFields.rewardCycles=cycle;programPatch.claimedCount=claimed+1;}
    writes.push({update:{name:documentName(`loyaltyRewardClaims/${rewardId}`),fields:firestoreFields(rewardFields)},currentDocument:{exists:false}});
    rewardCreated=true;
  }
  if(!stampDocument)writes.push({update:{name:documentName(stampPath),fields:firestoreFields({requestId,campaignId,userId:code.userId,placeId:code.placeId,placeName:code.placeName||'',confirmedBy:user.uid,confirmedAt:now})},currentDocument:{exists:false}});
  if(Object.keys(programPatch).length)writes.push({update:{name:documentName(programPath),fields:firestoreFields({...programPatch,updatedAt:now})},updateMask:{fieldPaths:[...Object.keys(programPatch),'updatedAt']},currentDocument:{updateTime:programDocument.updateTime}});
  writes[1].update.fields=firestoreFields(visitFields);
  writes[2].update.fields=firestoreFields(counterFields);
  writes[2].updateMask.fieldPaths=Object.keys(counterFields);
  writes.push({update:{name:documentName(`systemAudit/${requestId}_added`),fields:firestoreFields({action:'loyalty_stamp_added',actorUid:user.uid,actorName:merchantName,userId:code.userId,placeId:code.placeId,requestId,...consumption,createdAt:now})},currentDocument:{exists:false}});
  await firestoreCommit(accessToken, transaction, writes);
  const missionResult = await postVisitMissionSync(env, code.userId);
  return { visitCount: newCount, target, passportAdded:!stampDocument,rewardCreated, visitorUid: code.userId, placeId: code.placeId, ...missionResult };
}

async function reverseMerchantVisit(env, user, input) {
  const requestId = String(input?.requestId || "").trim();
  if (!validDocumentId(requestId)) throw new Error("Visit request id is invalid");

  const reversalReason=Consumption.reason(input?.reversalReason,'Motivo de la anulación');
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
  if(visit.passportClaimIds?.length)throw new Error("Esta visita respalda una recompensa del pasaporte registrada. Solicita revisión al administrador.");
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
  const target = Math.max(10, Number(visit.seasonId?visit.seasonTarget:(counter.permanentPolicy?.targetVisits||decodeFirestoreDocument(programDocument || {}).targetVisits||10)));

  const visitFields = {
    status: "reversed",
    reversedAt: now,
    reversedBy: user.uid,
    reversedByName: merchant.businessName || user.email || "",
    reversalReason,
    updatedAt: now
  };
  const counterFields = {
    ...LoyaltySeasons.restorePatch(visit,counter),
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
      updateMask: { fieldPaths: Object.keys(visitFields) },
      currentDocument: { updateTime: visitDocument.updateTime }
    },
    {
      update: { name: documentName(counterPath), fields: firestoreFields(counterFields) },
      updateMask: { fieldPaths: Object.keys(counterFields) },
      currentDocument: { updateTime: counterDocument.updateTime }
    }
  ];
  if(visit.rewardClaimId){
    const rewardPath=`loyaltyRewardClaims/${visit.rewardClaimId}`,rewardDoc=await firestoreGetDocumentInTransaction(accessToken,rewardPath,transaction);
    if(rewardDoc){
      const reward=decodeFirestoreDocument(rewardDoc);
      if(reward.status!=='pending')throw new Error('Reward already delivered; reversal requires review');
      if(!programDocument)throw new Error('Reward program requires review before reversal');
      const rawProgram=decodeFirestoreDocument(programDocument),claimed=Number(rawProgram.claimedCount);
      if(!visit.seasonId&&(!Number.isSafeInteger(claimed)||claimed<1))throw new Error('Reward stock requires review before reversal');
      const patch=visit.seasonId?{seasonClaimedCounts:LoyaltySeasons.reverseSeasonClaim(rawProgram,visit.seasonId)}:{claimedCount:claimed-1};
      writes.push({delete:documentName(rewardPath),currentDocument:{updateTime:rewardDoc.updateTime}});
      writes.push({update:{name:documentName(programPath),fields:firestoreFields({...patch,updatedAt:now})},updateMask:{fieldPaths:[...Object.keys(patch),'updatedAt']},currentDocument:{updateTime:programDocument.updateTime}});
    }
  }
  if(visit.passportStampId){
    const stampPath=`securePassportStamps/${visit.passportStampId}`,stampDoc=await firestoreGetDocumentInTransaction(accessToken,stampPath,transaction);
    if(stampDoc){const stamp=decodeFirestoreDocument(stampDoc);if(stamp.requestId!==requestId||stamp.userId!==visit.userId||stamp.placeId!==visit.placeId)throw new Error('Passport stamp requires review before reversal');writes.push({delete:documentName(stampPath),currentDocument:{updateTime:stampDoc.updateTime}});}
  }
  if (codeDocument) {
    const code = decodeFirestoreDocument(codeDocument);
    writes.push({
      update: {
        name: documentName(codePath),
        fields: firestoreFields({
          status: "reversed",
          reversedAt: now,
          reversedBy: user.uid,
          updatedAt: now
        })
      },
      updateMask: { fieldPaths: ["status", "reversedAt", "reversedBy", "updatedAt"] },
      currentDocument: { updateTime: codeDocument.updateTime }
    });
  }

  writes.push({update:{name:documentName(`systemAudit/${requestId}_reversed`),fields:firestoreFields({action:'loyalty_stamp_reversed',actorUid:user.uid,actorName:merchant.businessName||'',userId:visit.userId,placeId:visit.placeId,requestId,purchaseAmount:Number(visit.purchaseAmount||0),recordKind:visit.recordKind||'legacy',reversalReason,createdAt:now})},currentDocument:{exists:false}});
  await firestoreCommit(accessToken, transaction, writes);
  const missionResult = await postVisitMissionSync(env, visit.userId);
  return { visitCount: restoredCount, target, visitorUid: visit.userId, placeId: visit.placeId, ...missionResult };
}

// The visit transaction is already committed. Mission refresh must not report it as failed.
async function postVisitMissionSync(env,userId){
  try{return {missions:await syncUserMissionProgress(env,userId),missionsPending:false};}
  catch(error){console.warn('Mission refresh pending after saved visit',{code:error.firestoreCode||'unavailable',collection:error.queryCollection||'',status:error.httpStatus||0});return {missions:[],missionsPending:true};}
}

async function firestoreRunQuery(accessToken, structuredQuery, transaction = null, parentPath = "") {
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents${parentPath ? "/" + parentPath : ""}:runQuery`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify(transaction ? { structuredQuery, transaction } : { structuredQuery })
    }
  );
  if (!response.ok){const body=await response.json().catch(()=>({}));const error=new Error(`Firestore query failed (${response.status})`);error.httpStatus=response.status;error.firestoreCode=body.error?.status||'unknown';error.queryCollection=structuredQuery.from?.[0]?.collectionId||'';console.warn('Firestore query rejected',{status:response.status,code:error.firestoreCode,collection:error.queryCollection,details:body.error?.message||''});throw error;}
  const rows = await response.json();
  return rows.map(row => row.document).filter(Boolean);
}

async function loadMissionVisits(accessToken, visitorUid) {
  const [loyaltyDocuments, evidenceDocuments] = await Promise.all([
    firestoreRunQuery(accessToken, {
      from: [{ collectionId: "loyaltyVisits" }],
      where: { fieldFilter: { field: { fieldPath: "userId" }, op: "EQUAL", value: { stringValue: visitorUid } } }
    }),
    firestoreRunQuery(accessToken, {
      from: [{ collectionId: "evidence" }],
      where: { fieldFilter: { field: { fieldPath: "userId" }, op: "EQUAL", value: { stringValue: visitorUid } } }
    }, null, `chabaquitoExplorerProfiles/${visitorUid}`)
  ]);
  const evidence = evidenceDocuments.map(document => {
    const item = decodeFirestoreDocument(document);
    const trustedType = item.type === "confirmed_visit" || item.type === "self_visit";
    const trustedStatus = item.status === "validated" || item.status === "reversed";
    const trustedMethod = ["staff_confirmation", "self_visit", "checkin"].includes(item.validationMethod);
    if (item.scope !== "tourism_discovery" || !trustedType || !trustedStatus || !trustedMethod || !item.placeId) return null;
    const sourceId = String(item.sourceId || document.name.split("/").pop() || "");
    return {
      requestId: sourceId.startsWith("qr_") ? sourceId.slice(3) : sourceId,
      placeId: String(item.placeId),
      status: item.status === "validated" ? "confirmed" : "reversed",
      confirmedAt: Number.isFinite(item.firstVerifiedAt) ? item.firstVerifiedAt : item.verifiedAt,
      source: "chabaquito_evidence"
    };
  }).filter(Boolean);
  const evidenceIds = new Set(evidence.map(visit => visit.requestId));
  const legacy = loyaltyDocuments.map(document => {
    const visit = decodeFirestoreDocument(document);
    return { ...visit, requestId: visit.requestId || document.name.split("/").pop(), source: "loyalty_visit" };
  }).filter(visit => ["confirmed", "reversed"].includes(visit.status) && Number.isFinite(visit.confirmedAt));
  return evidence.concat(legacy.filter(visit => !evidenceIds.has(String(visit.requestId || ""))));
}

async function loadMissionPlaces(accessToken) {
  const documents = await firestoreRunQuery(accessToken, { from: [{ collectionId: "locales" }] });
  return Object.fromEntries(documents.map(document => {
    const place = decodeFirestoreDocument(document);
    return [document.name.split("/").pop(), place];
  }));
}

function missionVisitIsEligible(mission, visit) {
  const startsAt = Number.isFinite(mission?.startsAt) ? mission.startsAt : null;
  const endsAt = Number.isFinite(mission?.endsAt) ? mission.endsAt : null;
  if (!Number.isFinite(visit.confirmedAt)) return false;
  if (startsAt !== null && visit.confirmedAt < startsAt) return false;
  if (endsAt !== null && visit.confirmedAt > endsAt) return false;
  return true;
}

function missionText(value) {
  return String(value ?? "").trim();
}

function missionList(value) {
  return Array.isArray(value) ? value.map(missionText).filter(Boolean) : [];
}

function missionMatchedKeys(mission, visits, placesById) {
  const byVisitId = new Map();
  for (const visit of Array.isArray(visits) ? visits : []) {
    const visitId = missionText(visit?.requestId);
    if (!visitId) continue;
    const previous = byVisitId.get(visitId);
    if (!previous || visit.status === "reversed" || previous.status !== "reversed") byVisitId.set(visitId, visit);
  }
  const valid = [...byVisitId.values()].filter(visit => visit.status === "confirmed" && missionVisitIsEligible(mission, visit));
  if (mission.type === "total_visits") return valid.map(visit => missionText(visit.requestId)).filter(Boolean);
  if (mission.type === "unique_places") return valid.map(visit => missionText(visit.placeId)).filter(Boolean);
  if (mission.type === "place_visits") {
    const allowed = new Set(missionList(mission.placeIds));
    return valid.map(visit => missionText(visit.placeId)).filter(placeId => placeId && allowed.has(placeId));
  }
  if (mission.type === "category_visits") {
    const allowed = new Set(missionList(mission.categoryIds).map(value => value.toLocaleLowerCase("es")));
    return valid.map(visit => {
      const placeId = missionText(visit.placeId);
      const place = placesById[placeId] || {};
      const category = missionText(place.category || place.categoria || place.type || place.tipo).toLocaleLowerCase("es");
      return category && allowed.has(category) ? placeId : "";
    }).filter(Boolean);
  }
  if (mission.type === "canton_visits") {
    const allowed = new Set(missionList(mission.cantonIds).map(value => value.toLocaleLowerCase("es")));
    return valid.map(visit => {
      const place = placesById[missionText(visit.placeId)] || {};
      const canton = missionText(place.cantonId).toLocaleLowerCase("es");
      return canton && allowed.has(canton) ? canton : "";
    }).filter(Boolean);
  }
  return [];
}

function missionProgressDocumentId(userId, missionId) {
  return `v2_${base64url(userId)}_${base64url(missionId)}`;
}

async function syncUserMissionProgress(env, visitorUid) {
  const accessToken = await getGoogleAccessToken(env);
  const missionDocuments = await firestoreRunQuery(accessToken, {
    from: [{ collectionId: "chabaquitoMissions" }],
    where: { fieldFilter: { field: { fieldPath: "status" }, op: "EQUAL", value: { stringValue: "active" } } }
  });
  const [visits, placesById] = await Promise.all([
    loadMissionVisits(accessToken, visitorUid),
    loadMissionPlaces(accessToken)
  ]);
  const states = [];

  for (const document of missionDocuments) {
    const missionId = document.name.split("/").pop();
    const mission = decodeFirestoreDocument(document);
    const target = Number(mission.targetCount);
    if (!Number.isSafeInteger(target) || target < 1 || target > 500) continue;
    if (!["total_visits", "unique_places", "place_visits", "category_visits", "canton_visits"].includes(mission.type)) continue;

    const matchedKeys = missionMatchedKeys(mission, visits, placesById);
    const qualifyingVisitIds = mission.type === "total_visits" ? matchedKeys : [...new Set(matchedKeys)];
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
      completedAt: completed ? (Number.isFinite(existing?.completedAt) ? new Date(existing.completedAt) : now) : null,
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
    states.push({ missionId, type: mission.type, current, target, completed, newlyCompleted: completed && !existing?.completed });
  }
  return states;
}


function distanceMeters(a, b) {
  const rad = value => value * Math.PI / 180;
  const earth = 6371000;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * earth * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function validateProximityVisit(env, user, input) {
  const qrId = String(input?.qrId || "").trim();
  if (!validDocumentId(qrId)) throw new Error("QR inválido");
  const coordinates = input?.coordinates || {};
  const latitude = Number(coordinates.latitude), longitude = Number(coordinates.longitude);
  const accuracy = Number(coordinates.accuracy), capturedAt = Number(coordinates.capturedAt);
  const nowMs = Date.now();
  if (![latitude, longitude, accuracy, capturedAt].every(Number.isFinite) ||
      Math.abs(latitude) > 90 || Math.abs(longitude) > 180 ||
      accuracy <= 0 || accuracy > 20 || capturedAt > nowMs || nowMs - capturedAt > 30000) {
    throw new Error("GPS inválido, impreciso o antiguo");
  }

  const accessToken = await getGoogleAccessToken(env);
  const qrDocument = await firestoreGetDocument(accessToken, `qrCodes/${qrId}`);
  if (!qrDocument) throw new Error("QR no encontrado");
  const qr = decodeFirestoreDocument(qrDocument);
  if (qr.active !== true || qr.discoveryEnabled !== true || !validDocumentId(qr.placeId)) throw new Error("QR no habilitado para descubrimientos");

  const placeDocument = await firestoreGetDocument(accessToken, `locales/${qr.placeId}`);
  if (!placeDocument) throw new Error("Parada no encontrada");
  const place = decodeFirestoreDocument(placeDocument);
  if (place.active === false || (place.publicationStatus != null && String(place.publicationStatus).toLowerCase() !== "published")) {
    throw new Error("Parada no publicada o inactiva");
  }
  const canonicalCantons = new Set(["loja","calvas","catamayo","celica","chaguarpamba","espindola","gonzanama","macara","olmedo","paltas","pindal","puyango","quilanga","saraguro","sozoranga","zapotillo"]);
  const cantonId = String(place.cantonId || "").trim().toLocaleLowerCase("es");
  if (!canonicalCantons.has(cantonId)) throw new Error("Parada sin cantonId válido");
  const method = String(place.discovery?.method || "");
  if (place.discovery?.enabled !== true || !["proximity", "both"].includes(method) || String(place.discovery?.qrId || "") !== qrId) {
    throw new Error("QR no asociado o método no permitido");
  }
  const placeLat = Number(place.lat ?? place.latitude), placeLng = Number(place.lng ?? place.longitude);
  if (!Number.isFinite(placeLat) || !Number.isFinite(placeLng) || Math.abs(placeLat) > 90 || Math.abs(placeLng) > 180) throw new Error("Parada sin coordenadas válidas");
  if (distanceMeters({ latitude: placeLat, longitude: placeLng }, { latitude, longitude }) > 15) throw new Error("Fuera del radio de 15 metros");

  const transaction = await firestoreBeginTransaction(accessToken);
  const evidenceDocuments = await firestoreRunQuery(accessToken, {
    from: [{ collectionId: "evidence" }],
    where: { fieldFilter: { field: { fieldPath: "userId" }, op: "EQUAL", value: { stringValue: user.uid } } }
  }, transaction, `chabaquitoExplorerProfiles/${user.uid}`);
  const recent = evidenceDocuments.map(decodeFirestoreDocument).find(item =>
    item.scope === "tourism_discovery" && item.type === "self_visit" && item.status === "validated" &&
    item.placeId === qr.placeId && Number.isFinite(item.verifiedAt) && nowMs >= item.verifiedAt &&
    nowMs - item.verifiedAt < 24 * 60 * 60 * 1000
  );
  if (recent) throw new Error("Esta parada ya fue validada recientemente. Intenta nuevamente después de 24 horas.");

  const fingerprint = (await sha256Hex(qrId)).slice(0, 22);
  const evidenceId = `qr_${fingerprint}_${nowMs}`;
  const evidenceKey = `self_visit:${evidenceId}`;
  const evidencePath = `chabaquitoExplorerProfiles/${user.uid}/evidence/${base64url(evidenceKey)}`;
  const profilePath = `chabaquitoExplorerProfiles/${user.uid}`;
  const evidence = {
    type: "self_visit", sourceId: evidenceId, proofId: null, userId: user.uid,
    placeId: qr.placeId, cantonId, status: "validated",
    verifiedAt: nowMs, firstVerifiedAt: nowMs, validationMethod: "self_visit",
    scope: "tourism_discovery", schemaVersion: 1, reversedAt: null, updatedAt: nowMs
  };
  const existingEvidence = await firestoreGetDocumentInTransaction(accessToken, evidencePath, transaction);
  if (existingEvidence) throw new Error("Esta evidencia de visita ya fue registrada");

  const validatedEvidence = evidenceDocuments.map(decodeFirestoreDocument).filter(item =>
    item.scope === "tourism_discovery" && item.status === "validated"
  );
  const placeIds = new Set(validatedEvidence.map(item => item.placeId).filter(Boolean));
  const cantonIds = new Set(validatedEvidence.map(item => item.cantonId).filter(Boolean));
  const isNewPlace = !placeIds.has(qr.placeId);
  const isNewCanton = !cantonIds.has(cantonId);
  placeIds.add(qr.placeId);
  cantonIds.add(cantonId);

  const profileDocument = await firestoreGetDocumentInTransaction(accessToken, profilePath, transaction);
  const profile = profileDocument ? decodeFirestoreDocument(profileDocument) : {};
  const previousXp = Number(profile.validatedXp || 0);
  if (!Number.isSafeInteger(previousXp) || previousXp < 0) throw new Error("Perfil Chabaquito inconsistente");
  const xpDelta = (isNewPlace ? 20 : 0) + (isNewCanton ? 50 : 0);
  const validatedXp = previousXp + xpDelta;
  const thresholds = [0, 500, 1500, 3000, 5000, 8000, 12000, 20000];
  const profileFields = {
    validatedXp,
    level: thresholds.filter(min => validatedXp >= min).length,
    discoveredPlaces: placeIds.size,
    discoveredCantons: cantonIds.size,
    schemaVersion: 1,
    updatedAt: nowMs
  };
  const writes = [{
    update: { name: documentName(evidencePath), fields: firestoreFields(evidence) },
    currentDocument: { exists: false }
  }, {
    update: { name: documentName(profilePath), fields: firestoreFields(profileFields) },
    updateMask: { fieldPaths: Object.keys(profileFields) },
    ...(profileDocument ? { currentDocument: { updateTime: profileDocument.updateTime } } : { currentDocument: { exists: false } })
  }];
  if (isNewPlace) {
    const eventId = `discovery:place:${qr.placeId}`;
    writes.push({
      update: {
        name: documentName(`${profilePath}/xpEvents/${base64url(eventId)}`),
        fields: firestoreFields({ id: eventId, eventId, uid: user.uid, type: "VISIT_DISCOVERY", targetId: qr.placeId, xp: 20, placeId: qr.placeId, cantonId, evidenceKey, validationMethod: "self_visit", policyVersion: 1, schemaVersion: 1, status: "granted", createdAt: nowMs, updatedAt: nowMs })
      },
      currentDocument: { exists: false }
    });
  }
  if (isNewCanton) {
    const eventId = `discovery:canton:${cantonId}`;
    writes.push({
      update: {
        name: documentName(`${profilePath}/xpEvents/${base64url(eventId)}`),
        fields: firestoreFields({ id: eventId, eventId, uid: user.uid, type: "FIRST_CANTON", targetId: cantonId, xp: 50, placeId: null, cantonId, evidenceKey, validationMethod: "self_visit", policyVersion: 1, schemaVersion: 1, status: "granted", createdAt: nowMs, updatedAt: nowMs })
      },
      currentDocument: { exists: false }
    });
  }

  writes.push({
    update: {
      name: documentName(`${profilePath}/xpAudit/${base64url(evidenceId)}`),
      fields: firestoreFields({ uid: user.uid, evidenceKey, action: "validated", grants: [], revocations: [], xpDelta, processedAt: nowMs, schemaVersion: 1 })
    },
    currentDocument: { exists: false }
  });

  try {
    await firestoreCommit(accessToken, transaction, writes);
  } catch (error) {
    throw new Error("No se pudo registrar la evidencia de visita de forma segura");
  }
  const missions = await syncUserMissionProgress(env, user.uid);
  return { validated: true, alreadyRegistered: false, discoveryChanged: true, xpDelta, validatedXp, missionCount: missions.length, completedCount: missions.filter(item => item.completed).length, newlyCompletedMissionIds: missions.filter(item => item.newlyCompleted).map(item => item.missionId) };
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
    participateInRanking,
    publicAlias,
    updatedAt: now
  };
  const rankingId = await sha256Base64url(user.uid);
  const rankingPath = `chabaquitoPublicRanking/${rankingId}`;
  const writes = [{
    update: { name: documentName(profilePath), fields: firestoreFields(profileFields) },
    updateMask: { fieldPaths: Object.keys(profileFields) },
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
      return withCors(json({ ok: true, service: "chabaquito", missionSyncPolicyVersion:1,consumptionPolicyVersion:1,loyaltySeasonPolicyVersion:1,passportStampPolicyVersion:1,loyaltyRewardPolicyVersion:1, project: env.FIREBASE_PROJECT_ID || PROJECT_ID }),request);
    }

    if (request.method === "POST" && url.pathname === "/proximity-visit") {
      try {
        const user = await verifyFirebaseIdToken(request);
        const body = await request.json().catch(() => ({}));
        const result = await validateProximityVisit(env, user, body);
        return withCors(json({ ok: true, ...result }), request);
      } catch (error) {
        return withCors(json({ ok: false, error: error.message }, 400), request);
      }
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
