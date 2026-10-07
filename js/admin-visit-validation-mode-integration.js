"use strict";

(function () {
  const api = window.VisitaLojaVisitValidationAdmin;
  if (!api) return;

  function findPlaceForm() { return document.getElementById("placeForm"); }
  function ensureSelector() {
    const form = findPlaceForm();
    if (!form || document.getElementById("placeValidationMode")) return;
    const wrapper = document.createElement("div");
    wrapper.id = "placeValidationModeField";
    wrapper.className = "rounded-xl border border-cyan-500/25 bg-cyan-500/10 p-4";
    wrapper.innerHTML = `<div class="flex items-start gap-3"><i class="fa-solid fa-qrcode text-cyan-300 mt-1"></i><div class="flex-1"><span class="text-sm font-black block mb-1">Validación de visita y QR</span><p class="text-xs text-gray-400 mb-3">Define cómo Chabaquito comprobará la visita en esta parada.</p><select id="placeValidationMode" class="field"><option value="merchant_confirmation">👤 Con encargado — confirmación del negocio</option><option value="self_checkin">📍 Sin encargado — QR permanente + GPS</option></select><p id="placeValidationModeHelp" class="text-xs text-cyan-100 mt-2"></p></div></div>`;
    const publication = document.getElementById("placePublicationStatus")?.closest("label");
    if (publication) publication.insertAdjacentElement("afterend", wrapper);
    else {
      const submit = form.querySelector('button[type="submit"]');
      if (submit && submit.parentElement) submit.parentElement.insertBefore(wrapper, submit); else form.appendChild(wrapper);
    }
    wrapper.querySelector("#placeValidationMode").addEventListener("change", renderHelp); renderHelp();
    ensureCantonSelector();
  }
  function ensureCantonSelector() {
    const form=findPlaceForm();
    if(!form||document.getElementById("placeCantonId"))return;
    const cantons=window.ChabaquitoPlaceConfig?.CANTONS||[];
    const field=document.createElement("div");
    field.id="placeCantonField";
    field.className="rounded-xl border border-cyan-500/25 bg-cyan-500/10 p-4";
    field.innerHTML=`<label class="block"><span class="text-sm font-black block mb-2"><i class="fa-solid fa-location-dot mr-1"></i>Cantón *</span><select id="placeCantonId" class="field"><option value="">Selecciona el cantón</option>${cantons.map(c=>`<option value="${c.id}">${c.name}</option>`).join("")}</select></label><p class="text-xs text-gray-400 mt-2">Se usa para validar visitas, misiones y descubrimientos de Chabaquito.</p>`;
    const mode=document.getElementById("placeValidationModeField");
    if(mode)mode.insertAdjacentElement("afterend",field);else form.prepend(field);
  }
  function ensureMesaTuristicaNav() {
    if (document.getElementById("mesaTuristicaNavLink")) return;
    const postcards = document.getElementById("postcardsNavBtn"), navItems = postcards && postcards.parentElement;
    if (!navItems) return;
    const link = document.createElement("a"); link.id="mesaTuristicaNavLink"; link.setAttribute("data-nav-item",""); link.href="gestion-mesa-turistica.html"; link.className="block w-full text-left text-cyan-200 hover:bg-cyan-500/10 font-bold rounded-xl px-4 py-3"; link.innerHTML='<i class="fa-solid fa-people-group w-6"></i>Mesa Turística'; link.title="Administrar información, agenda, noticias, integrantes, galería y contacto de la Mesa Turística de Loja"; navItems.appendChild(link);
  }
  function canonicalCantonIds(){return new Set((window.ChabaquitoPlaceConfig?.CANTONS||[]).map(c=>c.id));}
  function normalizeCantonId(value){const candidate=String(value||"").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");return canonicalCantonIds().has(candidate)?candidate:"";}
  function setCanton(value){ensureSelector();ensureCantonSelector();const select=document.getElementById("placeCantonId");if(!select)return "";const cantonId=normalizeCantonId(value);select.value=cantonId;return cantonId;}
  function getCanton(){const select=document.getElementById("placeCantonId");return normalizeCantonId(select&&select.value);}
  function isCanonicalCanton(value){return Boolean(normalizeCantonId(value));}
  function renderHelp(){const select=document.getElementById("placeValidationMode"),help=document.getElementById("placeValidationModeHelp"),canton=document.getElementById("placeCantonId");if(!select||!help)return;const selfCheckin=select.value==="self_checkin";if(canton)canton.required=selfCheckin;help.textContent=selfCheckin?"El visitante escanea un QR permanente y el celular valida que esté físicamente en el lugar mediante GPS. Requiere coordenadas, cantón y la parada publicada.":"El visitante obtiene su visita mediante confirmación de personal autorizado. Fidelidad comercial permanece habilitada.";}
  function setMode(value){ensureSelector();ensureCantonSelector();const select=document.getElementById("placeValidationMode");if(!select)return;select.value=api.normalizeAdminVisitValidationMode(value);renderHelp();}
  function getMode(){const select=document.getElementById("placeValidationMode");return api.normalizeAdminVisitValidationMode(select&&select.value);}
  function subscriptionDraft(){try{const plans=window.eval("subscriptionDraftPlans");return Array.isArray(plans)?plans:[];}catch(_){return[];}}
  function adminPlaces(){try{const places=window.eval("adminPlaces");return Array.isArray(places)?places:[];}catch(_){return[];}}
  function adminDb(){try{return window.eval("db");}catch(_){return null;}}
  function adminAuth(){try{return window.eval("auth");}catch(_){return null;}}
  function normalizedGalleryLimit(plan){const raw=Number(plan&&plan.features&&plan.features.maxGalleryImages);return Number.isInteger(raw)&&raw>=0?Math.min(raw,100):6;}
  function findPlan(planId){const wanted=String(planId||"free").trim().toLowerCase();return subscriptionDraft().find(plan=>String(plan&&plan.id||"").trim().toLowerCase()===wanted)||null;}
  function effectiveEntitlement(place){const planId=String(place&&place.subscription&&place.subscription.plan||"free").trim()||"free",plan=findPlan(planId);return{placeId:String(place&&place.id||""),planId,maxGalleryImages:normalizedGalleryLimit(plan),planConfigured:Boolean(plan)};}
  async function writeBusinessEntitlement(place){const db=adminDb(),auth=adminAuth(),entitlement=effectiveEntitlement(place);if(!db||!entitlement.placeId)throw new Error("No se pudo preparar el límite seguro del negocio.");const user=auth&&auth.currentUser;await db.collection("businessEntitlements").doc(entitlement.placeId).set({...entitlement,updatedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedBy:user&&user.email||""},{merge:true});return entitlement;}
  async function syncAllBusinessEntitlements(){const places=adminPlaces();if(!places.length)return 0;for(let start=0;start<places.length;start+=400){const db=adminDb(),batch=db.batch(),user=adminAuth()&&adminAuth().currentUser;places.slice(start,start+400).forEach(place=>{const entitlement=effectiveEntitlement(place);batch.set(db.collection("businessEntitlements").doc(place.id),{...entitlement,updatedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedBy:user&&user.email||""},{merge:true});});await batch.commit();}return places.length;}
  function injectGalleryLimitsIntoExistingPlanEditor(){const editor=document.getElementById("subscriptionPlansEditor");if(!editor)return;const plans=subscriptionDraft(),cards=Array.from(editor.children);cards.forEach((card,index)=>{if(card.querySelector("[data-plan-gallery-limit]"))return;const plan=plans[index]||{},description=card.querySelector('[data-plan-field="description"]'),descriptionLabel=description&&description.closest("label");if(!descriptionLabel)return;const field=document.createElement("label");field.className="block bg-teal-500/10 border border-teal-500/25 rounded-xl p-3";field.innerHTML=`<span class="text-xs font-black text-teal-200 block mb-1"><i class="fa-solid fa-images mr-1"></i>Máximo de fotos en galería</span><input data-plan-gallery-limit data-plan-index="${index}" class="field" type="number" min="0" max="100" step="1" value="${normalizedGalleryLimit(plan)}"><span class="text-[11px] text-gray-400 mt-1 block">Solo cuenta la galería. Logo y portada son independientes.</span>`;descriptionLabel.insertAdjacentElement("afterend",field);});}
  function syncGalleryLimitsIntoDraft(){const plans=subscriptionDraft();document.querySelectorAll("[data-plan-gallery-limit]").forEach(input=>{const index=Number(input.dataset.planIndex),plan=plans[index];if(!plan)return;const parsed=Number.parseInt(input.value,10),limit=Number.isFinite(parsed)?Math.min(100,Math.max(0,parsed)):6;plan.features={...(plan.features||{}),maxGalleryImages:limit};input.value=String(limit);});}
  function integrateGalleryLimitsWithPlanEditor(){if(typeof window.renderSubscriptionEditors==="function"&&!window.renderSubscriptionEditors.__galleryLimitsIntegrated){const original=window.renderSubscriptionEditors,wrapped=function(){const result=original.apply(this,arguments);injectGalleryLimitsIntoExistingPlanEditor();return result;};wrapped.__galleryLimitsIntegrated=true;window.renderSubscriptionEditors=wrapped;}if(typeof window.syncSubscriptionEditors==="function"&&!window.syncSubscriptionEditors.__galleryLimitsIntegrated){const original=window.syncSubscriptionEditors,wrapped=function(){const result=original.apply(this,arguments);syncGalleryLimitsIntoDraft();return result;};wrapped.__galleryLimitsIntegrated=true;window.syncSubscriptionEditors=wrapped;}injectGalleryLimitsIntoExistingPlanEditor();}
  function watchPlacePlanSaves(){const form=findPlaceForm();if(!form||form.dataset.entitlementSyncBound)return;form.dataset.entitlementSyncBound="true";form.addEventListener("submit",()=>{const placeId=document.getElementById("placeEditId")?.value;setTimeout(async()=>{if(!placeId)return;const place=adminPlaces().find(item=>item.id===placeId);if(!place)return;try{await writeBusinessEntitlement(place);}catch(error){console.warn("No se pudo sincronizar businessEntitlements:",error);}},1200);});}
  function watchPlanSettingsSaves(){const form=document.getElementById("subscriptionsForm");if(!form||form.dataset.entitlementSyncBound)return;form.dataset.entitlementSyncBound="true";form.addEventListener("submit",()=>setTimeout(()=>syncAllBusinessEntitlements().catch(error=>console.warn("No se pudieron sincronizar límites de negocios:",error)),1200));}
  function initializeAdminIntegration(){ensureSelector();ensureCantonSelector();ensureMesaTuristicaNav();integrateGalleryLimitsWithPlanEditor();watchPlacePlanSaves();watchPlanSettingsSaves();}
  window.VisitaLojaVisitValidationAdminIntegration=Object.freeze({ensureSelector,ensureCantonSelector,setMode,getMode,setCanton,getCanton,isCanonicalCanton,normalizeCantonId,ensureMesaTuristicaNav,integrateGalleryLimitsWithPlanEditor,injectGalleryLimitsIntoExistingPlanEditor,writeBusinessEntitlement,syncAllBusinessEntitlements,effectiveEntitlement});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initializeAdminIntegration);else initializeAdminIntegration();
})();
