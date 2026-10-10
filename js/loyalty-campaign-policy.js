/* Pure policy for the proposed loyalty campaign service; no writes or sends. */
(function(root){
 'use strict';
 const phases=['before','birthday','after'];
 function id(value){if(typeof value!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(value))throw Error('Identificador inválido.');return value;}
 function calendarDay(now){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Guayaquil',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now));const get=t=>Number(parts.find(p=>p.type===t).value);return{year:get('year'),month:get('month'),day:get('day')};}
 function birthdayWindow(monthDay,now,daysBefore=7,daysAfter=2){
  if(!/^\d{2}-\d{2}$/.test(monthDay||''))return null;const [month,day]=monthDay.split('-').map(Number),check=new Date(Date.UTC(2000,month-1,day));if(check.getUTCMonth()!==month-1||check.getUTCDate()!==day)return null;
  if(!Number.isInteger(daysBefore)||daysBefore<0||daysBefore>30||!Number.isInteger(daysAfter)||daysAfter<0||daysAfter>30)throw Error('Ventana de cumpleaños inválida.');
  const today=calendarDay(now),base=Date.UTC(today.year,today.month-1,today.day);
  for(const year of [today.year-1,today.year,today.year+1]){let date=new Date(Date.UTC(year,month-1,day));if(month===2&&day===29&&date.getUTCMonth()===2)date=new Date(Date.UTC(year,1,28));const distance=Math.round((date.getTime()-base)/86400000);if(distance<=daysBefore&&distance>=-daysAfter)return{year,distance,phase:distance>0?'before':distance<0?'after':'birthday'};}
  return null;
 }
 function text(value,max){if(typeof value!=='string'||!value.trim()||value.trim().length>max)throw Error('Completa los textos dentro del límite.');return value.trim();}
 function normalizeDraft(data){id(data.placeId);const daysBefore=Number(data.daysBefore),daysAfter=Number(data.daysAfter);if(!Number.isInteger(daysBefore)||daysBefore<0||daysBefore>30||!Number.isInteger(daysAfter)||daysAfter<0||daysAfter>30)throw Error('Usa entre 0 y 30 días.');const offers={};for(const phase of phases){const raw=data.offers?.[phase]||{};offers[phase]={title:text(raw.title,120),message:text(raw.message,500)};}return{schemaVersion:1,status:'draft',placeId:data.placeId,daysBefore,daysAfter,offers};}
 function notificationPlan({campaign,subscription,birthMonthDay,now,alreadyDelivered=[]}){
  const draft=normalizeDraft(campaign),uid=id(subscription?.userId||'');if(subscription.placeId!==draft.placeId||subscription.active!==true||subscription.consent?.inApp!==true||campaign.status!=='published')return null;
  const window=birthdayWindow(birthMonthDay,now,draft.daysBefore,draft.daysAfter);if(!window)return null;const deliveryId=`birthday:${draft.placeId}:${uid}:${window.year}:${window.phase}`;if(alreadyDelivered.includes(deliveryId))return null;
  return{deliveryId,userId:uid,placeId:draft.placeId,year:window.year,phase:window.phase,title:draft.offers[window.phase].title,message:draft.offers[window.phase].message,inApp:true,push:subscription.consent.push===true,url:`/fidelidad.html?place=${encodeURIComponent(draft.placeId)}`};
 }
 const api={birthdayWindow,calendarDay,normalizeDraft,notificationPlan,phases};if(typeof module==='object'&&module.exports)module.exports=api;root.VisitaLojaLoyaltyCampaignPolicy=api;
})(typeof window==='undefined'?globalThis:window);
