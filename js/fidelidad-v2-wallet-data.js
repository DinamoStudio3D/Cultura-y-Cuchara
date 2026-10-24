(function(){
  'use strict';

  function isProgramActive(data){
    if (!data) return false;
    if (data.active === false || data.enabled === false) return false;
    const status=String(data.status||'').trim().toLowerCase();
    return !status || ['active','activo','published','publicado'].includes(status);
  }

  function placeLogo(place){
    return place.customLogoUrl || place.logoUrl || place.logo || place.image || place.heroImage || '';
  }

  function rewardTitle(program){
    return program.rewardTitle || program.reward || program.rewardName || program.prizeTitle || 'Beneficio de fidelidad';
  }

  function stampIcon(program){
    return program.stampIcon || program.icon || program.loyaltyIcon || program.stamp || 'fa-solid fa-location-dot';
  }

  async function loadPrograms(db){
    const snap=await db.collection('loyaltyPrograms').get();
    const programs=[];
    snap.forEach(doc=>{
      const data=doc.data()||{};
      if(isProgramActive(data)) programs.push({id:doc.id,...data});
    });
    return programs;
  }

  async function loadPlaces(db,programs){
    const ids=[...new Set(programs.map(p=>String(p.placeId||p.localId||p.businessId||p.id||'')).filter(Boolean))];
    const docs=await Promise.all(ids.map(id=>db.collection('locales').doc(id).get()));
    const map=new Map();
    docs.forEach(doc=>{if(doc.exists) map.set(doc.id,{id:doc.id,...doc.data()});});
    return map;
  }

  async function loadCounters(db,user){
    if(!user) return new Map();
    const snap=await db.collection('loyaltyCounters').where('userId','==',user.uid).get();
    const map=new Map();
    snap.forEach(doc=>{
      const data=doc.data()||{};
      const placeId=String(data.placeId||data.localId||data.businessId||'');
      if(placeId) map.set(placeId,{id:doc.id,...data});
    });
    return map;
  }

  async function buildWalletCards(db,user){
    const programs=await loadPrograms(db);
    const [places,counters]=await Promise.all([loadPlaces(db,programs),loadCounters(db,user)]);
    return programs.flatMap(baseProgram=>{
      const placeId=String(baseProgram.placeId||baseProgram.localId||baseProgram.businessId||baseProgram.id||'');
      const place=places.get(placeId)||{},baseCounter=counters.get(placeId)||{},policy=window.VisitaLojaLoyaltySeasonPolicy;
      const selected=policy?policy.select(baseProgram,baseCounter):{seasonal:false,program:baseProgram,counter:baseCounter};
      const card=(program,counter,label='')=>({placeId,placeName:(place.title||place.name||program.placeName||program.businessName||'Establecimiento')+label,logo:placeLogo(place),total:Number(counter.visitCount||counter.totalVisits||0),target:Math.max(10,Number(program.targetVisits||10)),reward:rewardTitle(program),rewardDescription:program.rewardDescription||'',stampIcon:stampIcon(program),program,place,counter});
      const cards=[card({...baseProgram,active:selected.seasonal?false:baseProgram.active},baseCounter,selected.seasonal?' · habitual en pausa':'')];
      if(selected.seasonal)cards.unshift(card(selected.program,selected.counter,' · '+selected.program.title));
      for(const [id,progress]of Object.entries(baseCounter.seasonalCards||{}))if(id!==selected.id&&progress.policy)cards.push(card({...progress.policy,active:false},{...baseCounter,...progress},' · '+progress.policy.title+' (finalizada)'));
      return cards;
    }).sort((a,b)=>{
      const av=a.total>0?1:0,bv=b.total>0?1:0;
      return bv-av || a.placeName.localeCompare(b.placeName,'es');
    });
  }

  window.VisitaLojaLoyaltyWalletData={buildWalletCards,loadPrograms,loadCounters};
})();
