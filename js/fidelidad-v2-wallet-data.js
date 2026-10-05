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
    return program.stampIcon || program.icon || program.stamp || 'fa-solid fa-location-dot';
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
    const snap=await db.collection('loyaltyCounters').where('uid','==',user.uid).get();
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
    return programs.map(program=>{
      const placeId=String(program.placeId||program.localId||program.businessId||program.id||'');
      const place=places.get(placeId)||{};
      const counter=counters.get(placeId)||{};
      return {
        placeId,
        placeName:place.title||place.name||program.placeName||program.businessName||'Establecimiento',
        logo:placeLogo(place),
        total:Number(counter.visitCount||counter.totalVisits||0),
        target:Math.max(1,Number(program.targetVisits||10)),
        reward:rewardTitle(program),
        stampIcon:stampIcon(program),
        program,
        place,
        counter
      };
    }).sort((a,b)=>{
      const av=a.total>0?1:0,bv=b.total>0?1:0;
      return bv-av || a.placeName.localeCompare(b.placeName,'es');
    });
  }

  window.VisitaLojaLoyaltyWalletData={buildWalletCards,loadPrograms,loadCounters};
})();
