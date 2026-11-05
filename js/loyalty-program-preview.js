(function () {
  'use strict';

  const form = document.getElementById('programForm');
  const host = document.getElementById('loyaltyProgramCardPreview');
  if (!form || !host) return;

  let previousMarkup;
  let previousPlace;
  const value = id => document.getElementById(id).value;
  const rulesSelector = '.loyalty-pass__rules';

  function update() {
    const selected = value('programPlace');
    const business = (typeof places !== 'undefined' ? places : []).find(place => place.id === selected) || {};
    const markup = window.VisitaLojaLoyaltyV2.card({
      placeName: business.title || 'Selecciona una parada',
      logo: business.customLogoUrl || business.logoUrl || business.logo || '',
      target: Number(value('programTarget')),
      total: 3,
      maxVisitsPerDay: Number(document.getElementById('programDaily').value),
      rewardValidityDays: Number(document.getElementById('programValidity').value),
      reward: value('programReward') || 'Tu beneficio',
      rewardDescription: value('programDescription'),
      stampIcon: 'fa-solid fa-stamp'
    });

    if (markup === previousMarkup && selected === previousPlace) return;

    const rules = host.querySelector(rulesSelector);
    const keepOpen = selected === previousPlace && rules?.open;
    const restoreFocus = selected === previousPlace && rules?.querySelector('summary') === document.activeElement;

    host.innerHTML = markup;
    previousMarkup = markup;
    previousPlace = selected;
    const updatedRules = host.querySelector(rulesSelector);
    if (keepOpen && updatedRules) updatedRules.open = true;
    if (restoreFocus) updatedRules?.querySelector('summary')?.focus({preventScroll: true});
  }

  form.addEventListener('input', update);
  form.addEventListener('change', update);
  window.refreshLoyaltyProgramPreview = update;
  update();
})();
