'use strict';

const {readFileSync} = require('node:fs');
const {initializeApp, deleteApp, cert} = require('firebase-admin/app');
const {getFirestore, Timestamp} = require('firebase-admin/firestore');
const {createHash} = require('node:crypto');

const DEMO = 'demo-visitaloja-rules';
const EMULATOR = '127.0.0.1:8089';
const roles = ['admin', 'owner', 'staff', 'customer'];
const fixtureId = 'rewards-preview-mobile-v1';
const safeId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,120}$/.test(value);

function settings() {
  const project = process.env.REWARDS_PREVIEW_FIREBASE_PROJECT;
  const emulator = process.env.FIRESTORE_EMULATOR_HOST;
  if (emulator) {
    if (emulator !== EMULATOR || (project && project !== DEMO)) throw new Error('Destino de emulador inválido.');
    return {projectId: DEMO};
  }
  if (!project || project === 'cultura-y-cuchara' || project.startsWith('demo-') ||
      process.argv[2] !== '--apply' || process.argv[3] !== project) {
    throw new Error('Confirma explícitamente el proyecto Firebase separado con --apply ID_DEL_PROYECTO.');
  }
  const account = JSON.parse(process.env.REWARDS_PREVIEW_FIREBASE_ACCOUNT || 'null');
  if (account?.project_id !== project) throw new Error('La credencial no coincide con el proyecto separado.');
  return {projectId: project, credential: cert(account)};
}

function fixtures() {
  const path = process.env.REWARDS_QA_FIXTURE_FILE;
  const input = path ? JSON.parse(readFileSync(path, 'utf8')) : process.env.FIRESTORE_EMULATOR_HOST ? {
    admin: 'demo-admin', owner: 'demo-owner', staff: 'demo-staff', customer: 'demo-customer',
    placeId: 'demo-cafe'
  } : {};
  if (![...roles, 'placeId'].every(key => safeId(input[key])) || new Set(roles.map(role => input[role])).size !== roles.length) {
    throw new Error('Indica cuatro UID distintos y el ID de la parada en REWARDS_QA_FIXTURE_FILE.');
  }
  return input;
}

async function main() {
  const options = settings();
  const {admin, owner, staff, customer, placeId} = fixtures();
  const campaignId = 'qa-rewards-mobile';
  const now = Timestamp.now();
  const stopIds = [placeId, 'qa-rewards-segunda-parada'];
  if (new Set(stopIds).size !== 2) throw new Error('Elige una parada distinta de qa-rewards-segunda-parada.');
  const records = {
    ['adminUsers/' + admin]: {active: true, role: 'admin'},
    ['businessAccess/' + owner + '_' + placeId]: {active: true, uid: owner, role: 'owner', placeId},
    ['missionRewardMerchants/' + staff]: {active: true, placeIds: [placeId]},
    ['loyaltyCounters/' + fixtureId]: {userId: customer, placeId, visitCount: 10},
    'siteContent/passport': {active: true, campaignId}
  };
  for (const [index, stop] of stopIds.entries()) {
    const requestId = fixtureId + '-' + index;
    records['locales/' + stop] = {title: 'Parada de prueba ' + (index + 1)};
    records['loyaltyVisits/' + requestId] = {userId: customer, placeId: stop, status: 'confirmed', confirmedAt: now};
    records['securePassportStamps/' + requestId] = {userId: customer, placeId: stop, requestId, campaignId, confirmedAt: now};
  }
  const fingerprint = createHash('sha256').update(JSON.stringify([admin, owner, staff, customer, placeId])).digest('hex');
  const app = initializeApp(options);
  try {
    const db = getFirestore(app);
    const outcome = await db.runTransaction(async tx => {
      const marker = db.doc('rewardsCenterQaPreview/' + fixtureId);
      const previous = await tx.get(marker);
      if (previous.exists) {
        if (previous.data().fingerprint !== fingerprint) throw new Error('Ya hay un conjunto de pruebas con otros datos.');
        return 'ya preparado';
      }
      for (const path of Object.keys(records)) {
        if ((await tx.get(db.doc(path))).exists) throw new Error('El destino contiene registros previos. Usa un proyecto vacío.');
      }
      for (const [path, data] of Object.entries(records)) tx.create(db.doc(path), data);
      tx.create(marker, {fingerprint, createdAt: now});
      return 'preparado';
    });
    console.log('Entorno ' + outcome + ': cuatro roles, diez sellos de fidelidad y dos paradas del pasaporte.');
  } finally {
    await deleteApp(app);
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
