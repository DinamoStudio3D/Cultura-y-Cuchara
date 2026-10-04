import fs from 'node:fs';

const rulesPath = 'firestore.rules';
let rules = fs.readFileSync(rulesPath, 'utf8');

const oldLocaleBlock = `    function canMerchantEditLocale(documentId) {
      return isAssignedVisitMerchant(documentId)
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly([
          'description',
          'phone',
          'whatsapp',
          'hours',
          'merchantUpdatedAt',
          'merchantUpdatedBy'
        ])
        && request.resource.data.description is string
        && request.resource.data.description.size() <= 1200
        && request.resource.data.phone is string
        && request.resource.data.phone.size() <= 30
        && request.resource.data.whatsapp is string
        && request.resource.data.whatsapp.size() <= 30
        && request.resource.data.hours is string
        && request.resource.data.hours.size() <= 600
        && request.resource.data.merchantUpdatedAt == request.time
        && request.resource.data.merchantUpdatedBy == request.auth.uid;
    }`;

const newLocaleBlock = `    function hasBusinessAccess(placeId) {
      return request.auth != null
        && exists(/databases/$(database)/documents/businessAccess/$(request.auth.uid));
    }

    function hasBusinessOwnerAccess(placeId) {
      return hasBusinessAccess(placeId)
        && get(/databases/$(database)/documents/businessAccess/$(request.auth.uid)).data.active == true
        && get(/databases/$(database)/documents/businessAccess/$(request.auth.uid)).data.role == 'owner'
        && get(/databases/$(database)/documents/businessAccess/$(request.auth.uid)).data.placeIds is list
        && placeId in get(/databases/$(database)/documents/businessAccess/$(request.auth.uid)).data.placeIds;
    }

    function hasLegacyBusinessOwnerAccess(placeId) {
      return isAssignedVisitMerchant(placeId)
        && (!exists(/databases/$(database)/documents/businessAccess/$(request.auth.uid)));
    }

    function canOwnerEditBusiness(placeId) {
      return hasBusinessOwnerAccess(placeId) || hasLegacyBusinessOwnerAccess(placeId);
    }

    function validMerchantGallery(placeId) {
      return request.resource.data.gallery is list
        && exists(/databases/$(database)/documents/businessEntitlements/$(placeId))
        && request.resource.data.gallery.size()
          <= get(/databases/$(database)/documents/businessEntitlements/$(placeId)).data.maxGalleryImages;
    }

    function canMerchantEditLocale(documentId) {
      return canOwnerEditBusiness(documentId)
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly([
          'desc', 'description', 'phone', 'whatsapp', 'hours',
          'customLogoUrl', 'heroImage', 'gallery',
          'merchantUpdatedAt', 'merchantUpdatedBy'
        ])
        && (!('desc' in request.resource.data)
          || (request.resource.data.desc is string && request.resource.data.desc.size() <= 1200))
        && (!('description' in request.resource.data)
          || (request.resource.data.description is string && request.resource.data.description.size() <= 1200))
        && request.resource.data.phone is string
        && request.resource.data.phone.size() <= 30
        && request.resource.data.whatsapp is string
        && request.resource.data.whatsapp.size() <= 30
        && request.resource.data.hours is string
        && request.resource.data.hours.size() <= 600
        && request.resource.data.customLogoUrl is string
        && request.resource.data.customLogoUrl.size() <= 2000
        && request.resource.data.heroImage is string
        && request.resource.data.heroImage.size() <= 2000
        && validMerchantGallery(documentId)
        && request.resource.data.merchantUpdatedAt == request.time
        && request.resource.data.merchantUpdatedBy == request.auth.uid;
    }`;

if (!rules.includes(oldLocaleBlock)) {
  throw new Error('No se encontró el bloque canMerchantEditLocale esperado; no se modificó firestore.rules.');
}
rules = rules.replace(oldLocaleBlock, newLocaleBlock);

const finalDeny = `    match /{document=**} {\n      allow read, write: if false;\n    }`;
if (!rules.includes(finalDeny)) {
  throw new Error('No se encontró el deny final; no se modificó firestore.rules.');
}

const accessRules = `    // Acceso privado de propietarios/encargados. Cada usuario solo puede leer su propio documento.\n    match /businessAccess/{userId} {\n      allow read: if isViveLojaAdmin() || (request.auth != null && request.auth.uid == userId);\n      allow create, update, delete: if isViveLojaAdmin();\n    }\n\n`;

const entitlementRules = fs.readFileSync('firestore.business-entitlements.rules.fragment', 'utf8')
  .split('\n')
  .map(line => line ? '    ' + line : line)
  .join('\n') + '\n\n';

if (!rules.includes('match /businessAccess/{userId}')) {
  rules = rules.replace(finalDeny, accessRules + entitlementRules + finalDeny);
}

fs.writeFileSync(rulesPath, rules);
console.log('firestore.rules integrado correctamente.');
