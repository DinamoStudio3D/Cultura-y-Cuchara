/* Admin editor for siteContent/partnerMarquee. Firestore rules authorize writes. */
(function () {
    'use strict';
    const api=window.VisitaLojaPartnerMarquee;
    const form=document.getElementById('partnersForm');if(!form||!api)return;
    const $=id=>document.getElementById(id),rows=$('partnersRows'),status=$('partnersStatus'),save=$('partnersSave');
    const fields=['Enabled','Source','Title','TitleEn','Subtitle','SubtitleEn','LogoSize','Speed','Direction','BackgroundColor','AccentColor','Placement'];
    const docRef=db.collection('siteContent').doc('partnerMarquee');
    let unsubscribe=null,placesUnsubscribe=null,loaded=false,dirty=false,existingPlaces=[];
    function setStatus(text,error=false){status.textContent=text;status.style.color=error?'#fca5a5':'';}
    function input(label,value,limit,required=false){
        const wrapper=document.createElement('label'),caption=document.createElement('span'),field=document.createElement('input');
        caption.textContent=label;caption.className='block text-xs font-semibold text-gray-300 mb-1';field.className='field';field.value=value||'';field.maxLength=limit;field.required=required;
        wrapper.append(caption,field);return wrapper;
    }
    function addRow(item={}){
        if(rows.children.length>=40){setStatus('Máximo 40 marcas.',true);return;}
        const row=document.createElement('div');row.className='rounded-2xl border border-gray-700 bg-black/25 p-4 space-y-3 partner-admin-row';
        const toolbar=document.createElement('div'),label=document.createElement('strong');toolbar.className='flex flex-wrap items-center justify-between gap-2';
        label.className='text-amber-300';label.textContent='Marca';toolbar.append(label);
        const actions=document.createElement('div');actions.className='flex gap-2';
        [['↑','Subir','up'],['↓','Bajar','down'],['Eliminar','Eliminar marca','remove']].forEach(([text,title,action])=>{
            const button=document.createElement('button');button.type='button';button.textContent=text;button.title=title;button.setAttribute('aria-label',title);button.className='rounded-lg border border-gray-600 px-3 py-1 text-sm hover:bg-white/10';
            button.addEventListener('click',()=>{if(action==='remove')row.remove();else {const sibling=action==='up'?row.previousElementSibling:row.nextElementSibling;if(sibling)rows.insertBefore(row,action==='up'?sibling:sibling.nextSibling);}changed();});actions.append(button);
        });toolbar.append(actions);row.append(toolbar);
        const grid=document.createElement('div');grid.className='grid sm:grid-cols-2 gap-3';
        [['Nombre *','name',100,true],['Name (English)','nameEn',100],['Descripción / actividad','detail',110],['Description (English)','detailEn',110],['URL del logo HTTPS *','imageUrl',1000,true],['Enlace HTTPS (opcional)','linkUrl',1000]].forEach(([label,key,max,required])=>{const control=input(label,item[key],max,required);control.querySelector('input').dataset.field=key;grid.append(control);});
        row.append(grid);rows.append(row);updateCount();return row;
    }
    function updateCount(){$('partnersCount').textContent=`(${rows.children.length}/40)`;}
    function values(){
        const config={enabled:$('partnersEnabled').checked,source:$('partnersSource').value,title:$('partnersTitle').value.trim(),titleEn:$('partnersTitleEn').value.trim(),subtitle:$('partnersSubtitle').value.trim(),subtitleEn:$('partnersSubtitleEn').value.trim(),logoSize:Number($('partnersLogoSize').value),speed:Number($('partnersSpeed').value),direction:$('partnersDirection').value,backgroundColor:$('partnersBackgroundColor').value,accentColor:$('partnersAccentColor').value,placement:$('partnersPlacement').value,brands:[...rows.children].map(row=>Object.fromEntries([...row.querySelectorAll('[data-field]')].map(field=>[field.dataset.field,field.value.trim()])))};
        return config;
    }
    function preview(){
        const config=values(),automatic=config.source==='auto';
        $('partnersManualEditor').classList.toggle('hidden',automatic);
        $('partnersAutoInfo').classList.toggle('hidden',!automatic);
        rows.querySelectorAll('[data-field]').forEach(field=>{field.disabled=automatic;});
        const brands=automatic?existingPlaces.map(place=>({name:place.title,nameEn:place.titleEn||'',detail:place.tag||'',detailEn:place.tagEn||'',imageUrl:place.customLogoUrl||place.gallery?.[0]?.img||''})):config.brands;
        api.render($('partnersPreview'),{...config,brands},{preview:true});
    }
    function changed(){dirty=true;setAdminUnsavedChanges(true);setStatus('Cambios sin guardar');updateCount();preview();}
    function populate(data){
        const config=api.normalize(data);$('partnersEnabled').checked=config.enabled;
        fields.filter(key=>key!=='Enabled').forEach(key=>{$('partners'+key).value=config[key.charAt(0).toLowerCase()+key.slice(1)];});
        rows.replaceChildren();config.brands.forEach(addRow);updateCount();dirty=false;setStatus('Listo para editar');preview();
    }
    $('partnersAdd').addEventListener('click',()=>{addRow();changed();rows.lastElementChild?.querySelector('[data-field="name"]')?.focus();});
    form.addEventListener('input',changed);form.addEventListener('change',changed);
    form.addEventListener('submit',async event=>{
        event.preventDefault();if(!loaded)return;
        const data=values();
        if(!Number.isInteger(data.logoSize)||data.logoSize<48||data.logoSize>140||!Number.isInteger(data.speed)||data.speed<15||data.speed>120){setStatus('Revisa el tamaño (48–140) y la velocidad (15–120).',true);return;}
        if(api.contrast(data.backgroundColor,data.accentColor)<3){setStatus('El color de acento necesita más contraste con el fondo para que se lea bien.',true);return;}
        if(data.source==='manual'&&data.enabled&&!data.brands.length){setStatus('Añade al menos una marca antes de activar la lista manual.',true);return;}
        if(data.source==='manual'&&data.brands.some(item=>!item.name||!api.httpsUrl(item.imageUrl)||item.linkUrl&&!api.httpsUrl(item.linkUrl))){setStatus('Cada marca necesita nombre y logo HTTPS; los enlaces también deben usar HTTPS.',true);return;}
        save.disabled=true;setStatus('Guardando…');
        try{
            await docRef.set({...data,updatedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedByUid:auth.currentUser.uid},{merge:true});
            dirty=false;setAdminUnsavedChanges(false);setStatus('Guardado correctamente');
        }catch(error){setStatus(error.code==='permission-denied'?'Tu cuenta no tiene permiso para guardar marcas.':'No se pudo guardar. Revisa la conexión e inténtalo otra vez.',true);}
        finally{save.disabled=false;}
    });
    auth.onAuthStateChanged(async user=>{
        if(unsubscribe){unsubscribe();unsubscribe=null;}
        if(placesUnsubscribe){placesUnsubscribe();placesUnsubscribe=null;}
        existingPlaces=[];loaded=false;dirty=false;save.disabled=true;
        if(!user){rows.replaceChildren();setStatus('Inicia sesión para editar');return;}
        try{
            if(!(await resolveAdminAccess(user)))return;
            placesUnsubscribe=db.collection('locales').onSnapshot(snapshot=>{
                existingPlaces=snapshot.docs.map(doc=>({id:doc.id,...doc.data()})).filter(place=>(!place.publicationStatus||place.publicationStatus==='published')&&!([place.category,place.tag,place.title,place.type].join(' ').toLowerCase().includes('motel')));
                if($('partnersSource').value==='auto')preview();
            },()=>{if($('partnersSource').value==='auto')setStatus('No se pudieron cargar los negocios para la vista previa.',true);});
            unsubscribe=docRef.onSnapshot(snapshot=>{
                loaded=true;save.disabled=false;
                if(dirty)return;
                populate(snapshot.exists?snapshot.data():{...api.defaults,enabled:true});
            },()=>setStatus('No se pudo cargar la configuración de marcas.',true));
        }catch(_){setStatus('No se pudo comprobar el acceso administrativo.',true);}
    });
})();
