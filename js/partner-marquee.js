/* Shared renderer for the public page and the administrator preview. */
(function () {
    'use strict';
    const doc = document;
    const DEFAULTS = {enabled:false,title:'Marcas que ya trabajan con nosotros',titleEn:'Brands working with us',subtitle:'Conoce a quienes forman parte de Visita Loja.',subtitleEn:'Discover the businesses working with Visita Loja.',logoSize:76,speed:40,direction:'left',brands:[]};
    function httpsUrl(value) {
        if (!value) return '';
        try { const url = new URL(String(value).trim()); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; }
        catch (_) { return ''; }
    }
    function bounded(value, min, max, fallback) { const number=Number(value); return Number.isFinite(number) ? Math.max(min,Math.min(max,Math.round(number))) : fallback; }
    function normalize(source) {
        const data=source && typeof source==='object' ? source : {};
        return {
            enabled:data.enabled===true,
            title:String(data.title||DEFAULTS.title).slice(0,100),titleEn:String(data.titleEn||DEFAULTS.titleEn).slice(0,100),
            subtitle:String(data.subtitle||DEFAULTS.subtitle).slice(0,180),subtitleEn:String(data.subtitleEn||DEFAULTS.subtitleEn).slice(0,180),
            logoSize:bounded(data.logoSize,48,140,76),speed:bounded(data.speed,15,120,40),direction:data.direction==='right'?'right':'left',
            brands:(Array.isArray(data.brands)?data.brands:[]).slice(0,40).map(item=>({name:String(item?.name||'').trim().slice(0,100),nameEn:String(item?.nameEn||'').trim().slice(0,100),detail:String(item?.detail||'').trim().slice(0,110),detailEn:String(item?.detailEn||'').trim().slice(0,110),imageUrl:httpsUrl(item?.imageUrl),linkUrl:httpsUrl(item?.linkUrl)})).filter(item=>item.name && item.imageUrl)
        };
    }
    function el(tag, className, textValue) {const node=doc.createElement(tag);if(className)node.className=className;if(textValue!==undefined)node.textContent=textValue;return node;}
    function render(host, source, options={}) {
        if (!host) return;
        if (host._partnerResize) { host._partnerResize.disconnect();host._partnerResize=null; }
        const data=normalize(source),preview=options.preview===true,english=doc.documentElement.lang?.toLowerCase().startsWith('en');
        host.replaceChildren();host.hidden=!preview && (!data.enabled || !data.brands.length);
        if(host.hidden)return;
        host.style.setProperty('--partner-size',data.logoSize+'px');host.dataset.direction=data.direction;
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
        if(typeof ResizeObserver!=='undefined'){host._partnerResize=new ResizeObserver(update);host._partnerResize.observe(group);}
    }
    window.VisitaLojaPartnerMarquee={normalize,httpsUrl,render,defaults:DEFAULTS};
    const publicHost=doc.getElementById('partnerMarquee');
    if(publicHost){
        let current=null;
        try {
            const app=firebase.app('viveLojaPublic');
            app.firestore().collection('siteContent').doc('partnerMarquee').onSnapshot(snapshot=>{current=snapshot.exists?snapshot.data():null;render(publicHost,current);},error=>{publicHost.hidden=true;console.warn('No se pudo cargar la franja de marcas:',error);});
            new MutationObserver(()=>{if(current)render(publicHost,current);}).observe(doc.documentElement,{attributes:true,attributeFilter:['lang']});
        } catch(error){publicHost.hidden=true;console.warn('No se pudo iniciar la franja de marcas:',error);}
    }
})();
