(function(){
  'use strict';
  const params=new URLSearchParams(location.search);
  const placeId=(params.get('checkin')||'').trim();
  const token=(params.get('token')||'').trim();
  const selfMode=params.get('mode')==='self';
  if(!selfMode||!placeId||!token)return;

  const $=id=>document.getElementById(id);
  function message(text,type='info'){
    const el=$('message'); if(!el)return;
    el.textContent=text;
    el.className='text-sm mt-4 '+(type==='error'?'text-rose-300':type==='ok'?'text-emerald-300':'text-amber-200');
  }
  function configureUi(){
    document.title='Registrar visita | Visita Loja';
    const loginText=$('login')?.querySelector('p.text-gray-400');
    if(loginText) loginText.textContent='Ingresa con tu cuenta para verificar que estás junto al atractivo y registrar tu visita.';
    const generate=$('generateBox'); if(generate){
      generate.innerHTML='<p class="text-sm text-gray-300">Para registrar esta visita necesitamos comprobar que estás a 15 metros o menos del atractivo.</p><p class="text-xs text-amber-200 mt-2"><i class="fa-solid fa-location-crosshairs mr-2"></i>Activa la ubicación precisa de tu teléfono. Tu posición se usa para validar esta visita.</p><button id="selfCheckinBtn" class="w-full bg-emerald-400 text-emerald-950 rounded-xl py-3 font-black mt-4"><i class="fa-solid fa-location-dot mr-2"></i>Verificar mi ubicación</button>';
    }
    $('placeProgress')?.classList.add('hidden');
    $('codeBox')?.classList.add('hidden');
  }
  function getPrecisePosition(){
    if(!navigator.geolocation) return Promise.reject(new Error('Este dispositivo no permite obtener la ubicación.'));
    return new Promise((resolve,reject)=>{
      let best=null,finished=false;
      const finish=(err,pos)=>{if(finished)return;finished=true;clearTimeout(timer);if(watchId!==null)navigator.geolocation.clearWatch(watchId);err?reject(err):resolve(pos);};
      const watchId=navigator.geolocation.watchPosition(pos=>{
        if(!best||pos.coords.accuracy<best.coords.accuracy)best=pos;
        message('Comprobando ubicación… precisión aproximada: '+Math.round(pos.coords.accuracy)+' m');
        if(pos.coords.accuracy<=15)finish(null,pos);
      },err=>finish(new Error(err.code===1?'Debes permitir el acceso a tu ubicación para registrar la visita.':'No pudimos obtener tu ubicación. Inténtalo nuevamente.')),{enableHighAccuracy:true,maximumAge:0,timeout:15000});
      const timer=setTimeout(()=>finish(best&&best.coords.accuracy<=15?null:new Error('Tu ubicación todavía no alcanza una precisión de 15 m. Acércate al atractivo, espera unos segundos e inténtalo nuevamente.'),best),15000);
    });
  }
  async function submit(){
    const btn=$('selfCheckinBtn'); if(!btn)return;
    btn.disabled=true; btn.classList.add('opacity-60');
    try{
      if(!firebase.auth().currentUser) throw new Error('Debes iniciar sesión antes de registrar la visita.');
      message('Obteniendo tu ubicación…');
      const pos=await getPrecisePosition();
      message('Validando cercanía con el atractivo…');
      if(!firebase.functions) throw new Error('El servicio de validación todavía no está disponible.');
      const call=firebase.app().functions('us-central1').httpsCallable('registerSelfCheckin');
      const result=await call({placeId,qrToken:token,latitude:pos.coords.latitude,longitude:pos.coords.longitude,accuracy:pos.coords.accuracy});
      const data=result.data||{};
      $('generateBox')?.classList.add('hidden');
      const confirmed=$('confirmed'); confirmed?.classList.remove('hidden');
      const title=$('confirmedTitle'),text=$('confirmedText');
      if(title)title.textContent=data.alreadyRegistered?'Visita ya registrada':'¡Visita registrada!';
      if(text)text.textContent=data.alreadyRegistered?'Ya habías registrado una visita válida en este atractivo hoy.':'Estás dentro del área permitida. La visita se añadió a tu Pasaporte y puede contar para las Misiones de Chabaquito.';
      message('Ubicación validada correctamente.','ok');
    }catch(error){
      const raw=error?.message||'No se pudo registrar la visita.';
      message(raw.replace(/^Firebase:\s*/,'').replace(/^.*?\]\s*/,''),'error');
    }finally{btn.disabled=false;btn.classList.remove('opacity-60');}
  }
  configureUi();
  document.addEventListener('click',e=>{if(e.target.closest('#selfCheckinBtn'))submit();});
  window.VisitaLojaSelfCheckin={active:true,placeId};
})();
