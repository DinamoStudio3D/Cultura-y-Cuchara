/* Shared renderer for the public page and the administrator preview. */
(function () {
    'use strict';
    const doc = document;
    const DEFAULTS = {enabled:false,source:'auto',title:'Marcas que ya trabajan con nosotros',titleEn:'Brands working with us',subtitle:'Conoce a quienes forman parte de Visita Loja.',subtitleEn:'Discover the businesses working with Visita Loja.',logoSize:76,speed:40,direction:'left',backgroundColor:'#11151b',accentColor:'#fbbf24',placement:'beforeSupport',brands:[]};
    function httpsUrl(value) {
        if (!value) return '';
        try { const url = new URL(String(value).trim()); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; }
        catch (_) { return ''; }
    }
    function bounded(value, min, max, fallback) { const number=Number(value); return Number.isFinite(number) ? Math.max(min,Math.min(max,Math.round(number))) : fallback; }
    function safeColor(value,fallback){return typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)?value.toLowerCase():fallback;}
    function luminance(hex){const channels=[1,3,5].map(index=>parseInt(hex.slice(index,index+2),16)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;}
    function contrast(a,b){const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
    function normalize(source) {
        const data=source && typeof source==='object' ? source : {};
        return {
            enabled:data.enabled===true,
            source:data.source==='manual'||(!('source' in data)&&Array.isArray(data.brands)&&data.brands.length>0)?'manual':'auto',
            title:String(data.title||DEFAULTS.title).slice(0,100),titleEn:String(data.titleEn||DEFAULTS.titleEn).slice(0,100),
            subtitle:String(data.subtitle||DEFAULTS.subtitle).slice(0,180),subtitleEn:String(data.subtitleEn||DEFAULTS.subtitleEn).slice(0,180),
            logoSize:bounded(data.logoSize,48,140,76),speed:bounded(data.speed,15,120,40),direction:data.direction==='right'?'right':'left',
            backgroundColor:safeColor(data.backgroundColor,DEFAULTS.backgroundColor),accentColor:safeColor(data.accentColor,DEFAULTS.accentColor),placement:data.placement==='afterPlaces'?'afterPlaces':'beforeSupport',
            brands:(Array.isArray(data.brands)?data.brands:[]).slice(0,40).map(item=>({name:String(item?.name||'').trim().slice(0,100),nameEn:String(item?.nameEn||'').trim().slice(0,100),detail:String(item?.detail||'').trim().slice(0,110),detailEn:String(item?.detailEn||'').trim().slice(0,110),imageUrl:httpsUrl(item?.imageUrl),linkUrl:httpsUrl(item?.linkUrl)})).filter(item=>item.name && item.imageUrl)
        };
    }
    function el(tag, className, textValue) {const node=doc.createElement(tag);if(className)node.className=className;if(textValue!==undefined)node.textContent=textValue;return node;}
    function render(host, source, options={}) {
        if (!host) return;
        if (host._partnerResize) { host._partnerResize.disconnect();host._partnerResize=null; }
        if (host._partnerResizeTimer) {clearTimeout(host._partnerResizeTimer);host._partnerResizeTimer=null;}
        const data=normalize(source),preview=options.preview===true,english=doc.documentElement.lang?.toLowerCase().startsWith('en');
        host.replaceChildren();host.hidden=!preview && (!data.enabled || !data.brands.length);
        if(host.hidden)return;
        const light=luminance(data.backgroundColor)>.18;
        host.style.setProperty('--partner-size',data.logoSize+'px');host.style.setProperty('--partner-background',data.backgroundColor);host.style.setProperty('--partner-accent',data.accentColor);
        host.style.setProperty('--partner-ink',light?'#111827':'#f8fafc');host.style.setProperty('--partner-muted',light?'#374151':'#c4cbd5');host.style.setProperty('--partner-card',light?'rgba(0,0,0,.055)':'rgba(255,255,255,.045)');host.dataset.direction=data.direction;
        if (!data.brands.length) {host.append(el('p','partner-marquee__empty','Añade al menos una marca con nombre y logo HTTPS para ver la franja.'));return;}
        const heading=el('div','partner-marquee__heading'),eyebrow=el('p','partner-marquee__eyebrow',english?'VISIT LOJA PARTNERS':'ALIADOS DE VISITA LOJA'),title=el('h2','partner-marquee__title',english?data.titleEn:data.title),subtitle=el('p','partner-marquee__subtitle',english?data.subtitleEn:data.subtitle);
        heading.append(eyebrow,title,subtitle);host.append(heading);
        const viewport=el('div','partner-marquee__viewport'),track=el('div','partner-marquee__track');
        function card(item,interactive) {
            const outer=interactive && item.linkUrl ? el('a','partner-marquee__card') : el('div','partner-marquee__card');
            if(outer.tagName==='A'){outer.href=item.linkUrl;outer.target='_blank';outer.rel='noopener noreferrer';outer.referrerPolicy='no-referrer';}
            const img=el('img','partner-marquee__logo');img.src=item.imageUrl;img.alt='';img.loading=preview?'eager':'lazy';img.decoding='async';
            const label=el('span',''),name=el('span','partner-marquee__name',english?(item.nameEn||item.name):item.name),detail=el('span','partner-marquee__detail',english?(item.detailEn||item.detail):item.detail);
            label.append(name);if(detail.textContent)label.append(detail);outer.append(img,label);return outer;
        }
        const group=el('div','partner-marquee__group');
        // Repeat within the first half until it is wider than the viewport, including a single-brand list.
        const cycles=Math.min(24,Math.max(1,Math.ceil((host.clientWidth+300)/(data.brands.length*(data.logoSize+115)))));
        for(let cycle=0;cycle<cycles;cycle++)data.brands.forEach(item=>{const node=card(item,cycle===0);if(cycle>0)node.setAttribute('aria-hidden','true');group.append(node);});
        const clone=group.cloneNode(true);clone.setAttribute('aria-hidden','true');clone.querySelectorAll('a').forEach(link=>{link.removeAttribute('href');link.removeAttribute('target');});
        track.append(group,clone);viewport.append(track);host.append(viewport);
        const update=()=>host.style.setProperty('--partner-duration',Math.max(8,group.scrollWidth/data.speed).toFixed(2)+'s');update();
        if(typeof ResizeObserver!=='undefined'){
            const widthAtRender=host.clientWidth;
            host._partnerResize=new ResizeObserver(()=>{
                if(Math.abs(host.clientWidth-widthAtRender)>24){
                    if(!host._partnerResizeTimer)host._partnerResizeTimer=setTimeout(()=>{host._partnerResizeTimer=null;render(host,source,options);},80);
                }else update();
            });
            host._partnerResize.observe(group);
            host._partnerResize.observe(host);
        }
    }
    window.VisitaLojaPartnerMarquee={normalize,httpsUrl,contrast,render,defaults:DEFAULTS};
    const publicHost=doc.getElementById('partnerMarquee');
    if(publicHost){
        const originalNext=publicHost.nextElementSibling;
        let current=null,configLoaded=false,existingPlaces=[];
        function showPublic(){
            if(!configLoaded)return;
            const placement=current?normalize(current).placement:DEFAULTS.placement;
            if(placement==='afterPlaces')doc.getElementById('establecimientos')?.after(publicHost);
            else if(originalNext&&publicHost.nextElementSibling!==originalNext)originalNext.before(publicHost);
            // The public locales listener supplies published businesses already present on the site.
            // This preview needs no extra Firestore document or test write.
            const brands=existingPlaces.map(place=>({name:place.title,nameEn:place.titleEn||'',detail:place.tag||'',detailEn:place.tagEn||'',imageUrl:place.customLogoUrl||place.gallery?.[0]?.img||''}));
            if(current){const config=normalize(current);render(publicHost,{...config,brands:config.source==='manual'?config.brands:brands});return;}
            render(publicHost,{...DEFAULTS,enabled:true,brands});
        }
        window.VisitaLojaPartnerMarquee.setPlaces=places=>{existingPlaces=Array.isArray(places)?places:[];showPublic();};
        try {
            const app=firebase.app('viveLojaPublic');
            app.firestore().collection('siteContent').doc('partnerMarquee').onSnapshot(snapshot=>{current=snapshot.exists?snapshot.data():null;configLoaded=true;showPublic();},error=>{publicHost.hidden=true;console.warn('No se pudo cargar la franja de marcas:',error);});
            new MutationObserver(showPublic).observe(doc.documentElement,{attributes:true,attributeFilter:['lang']});
        } catch(error){publicHost.hidden=true;console.warn('No se pudo iniciar la franja de marcas:',error);}
    }
})();
