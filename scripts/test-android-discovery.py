#!/usr/bin/env python3
"""Read-only public discovery smoke test on the same disposable Android emulator."""
import json
import re
import subprocess
import time
import xml.etree.ElementTree as ET
from pathlib import Path

OUT = Path('android/native/map-ui-results')
PKG = 'com.visitaloja.app.preview'
checks = []

def adb(*args, binary=False):
    p = subprocess.run(['adb', *args], check=True, capture_output=True, timeout=35)
    return p.stdout if binary else p.stdout.decode(errors='replace').strip()

def tree():
    adb('shell', 'uiautomator', 'dump', '/sdcard/discovery-ui.xml')
    return ET.fromstring(adb('exec-out', 'cat', '/sdcard/discovery-ui.xml'))

def find(root, tag=None, desc=None):
    return next((n for n in root.iter('node') if (tag and n.get('resource-id', '').split(':id/')[-1] == tag) or (desc and n.get('content-desc') == desc)), None)

def wait(tag=None, desc=None, seconds=35):
    end = time.monotonic() + seconds
    while time.monotonic() < end:
        node = find(tree(), tag, desc)
        if node is not None: return node
        time.sleep(1)
    raise AssertionError('Missing ' + str(tag or desc))

def tap(node):
    x1, y1, x2, y2 = map(int, re.findall(r'\d+', node.get('bounds')))
    adb('shell', 'input', 'tap', str((x1+x2)//2), str((y1+y2)//2))

def capture(name):
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / (name + '.png')).write_bytes(adb('exec-out', 'screencap', '-p', binary=True))
    ET.ElementTree(tree()).write(OUT / (name + '.xml'), encoding='utf-8')
    checks.append(name)

def home_card(tag):
    for _ in range(7):
        node = find(tree(), tag=tag)
        if node is not None:
            tap(node); return
        adb('shell', 'input', 'swipe', '360', '1180', '360', '550', '350')
        time.sleep(1)
    raise AssertionError('Home discovery card missing: ' + tag)

try:
    adb('shell', 'settings', 'put', 'system', 'font_scale', '1.0')
    adb('shell', 'am', 'force-stop', PKG)
    adb('shell', 'am', 'start', '-n', PKG + '/com.visitaloja.app.MainActivity')
    time.sleep(4)
    # Receive public links without opening a browser, authenticating, or writing user data.
    resolvers=adb('shell','cmd','package','query-activities','--brief','-a','android.intent.action.SEND','-t','text/plain')
    assert PKG in resolvers,'App is not registered to receive shared text'
    adb('shell','am','force-stop',PKG)
    adb('shell','am','start','-a','android.intent.action.VIEW','-d','https://www.visitaloja.com/?checkin=loc_1788797820110','-n',PKG+'/com.visitaloja.app.MainActivity')
    wait(desc='Cerrar ficha',seconds=50);capture('discovery-link-place-cold')
    assert 'expreso' in ' '.join(n.get('text','') for n in tree().iter('node')).lower()
    adb('shell','input','keyevent','KEYCODE_BACK');time.sleep(1)
    adb('shell','am','start','-a','android.intent.action.SEND','-t','text/plain','--es','android.intent.extra.TEXT','https://visitaloja.com/#loja-en-video','-n',PKG+'/com.visitaloja.app.MainActivity')
    wait(tag='videos-screen');capture('discovery-link-share-warm')
    adb('shell','am','start','-a','android.intent.action.VIEW','-d','https://visitaloja.com/','-n',PKG+'/com.visitaloja.app.MainActivity')
    wait(tag='home-sections');time.sleep(1)
    tap(wait(tag='open-sections'))
    wait(tag='sections-screen');capture('discovery-sections')
    tap(wait(tag='open-link'));tap(wait(tag='native-link-input'))
    adb('shell','input','text','https://evil.example/')
    adb('shell','input','keyevent','KEYCODE_BACK');tap(wait(tag='native-link-confirm'))
    wait(tag='native-link-invalid');capture('discovery-link-invalid')
    adb('shell','input','keyevent','KEYCODE_BACK');time.sleep(1)

    tap(wait(tag='sections-search'));adb('shell','input','text','postales')
    adb('shell','input','keyevent','KEYCODE_BACK');time.sleep(1)
    tap(wait(tag='section-postcards'));wait(tag='postcards-screen')
    tap(wait(desc='Volver a Secciones'));wait(tag='sections-screen')
    assert find(tree(),tag='section-postcards') is not None,'Section search was lost on return'
    tap(wait(desc='Borrar búsqueda de secciones'))
    tap(wait(tag='sections-search'));adb('shell','input','text','zzzzzz')
    adb('shell','input','keyevent','KEYCODE_BACK');wait(tag='sections-reset');capture('discovery-sections-empty')
    tap(wait(tag='sections-reset'));wait(tag='sections-screen')
    tap(wait(tag='sections-search'));adb('shell','input','text','promociones')
    adb('shell','input','keyevent','KEYCODE_BACK');tap(wait(tag='section-promotions'))
    wait(tag='promotions-screen');time.sleep(5);capture('discovery-promotions')
    words=' '.join(n.get('text','') for n in tree().iter('node'))
    assert 'Conéctate para consultar' not in words,'Promotion directory failed to refresh'
    promotion_card=next((n for n in tree().iter('node') if n.get('resource-id','').startswith('promotion-')),None)
    promotion_check={'screen_verified':True,'published_offer_found':promotion_card is not None,'detail_verified':False,'external_action_opened':False}
    if promotion_card is not None:
        tap(promotion_card);time.sleep(2);capture('discovery-promotion-detail')
        for _ in range(5):
            if find(tree(),tag='place-promotion') is not None:break
            adb('shell','input','swipe','360','1180','360','600','300');time.sleep(1)
        assert find(tree(),tag='place-promotion') is not None,'Active promotion missing from place'
        promotion_check['detail_verified']=True
        adb('shell','input','keyevent','KEYCODE_BACK');time.sleep(1)
    (OUT/'promotion-summary.json').write_text(json.dumps(promotion_check,indent=2))
    tap(wait(desc='Volver a Secciones'));wait(tag='sections-screen');tap(wait(desc='Borrar búsqueda de secciones'))
    culture_check={}
    for route,query,screen,prefix,close_label in [('stories','historias','stories-screen','story-card-','Cerrar historia'),('enterprises','emprendedores','enterprises-screen','enterprise-card-','Cerrar emprendimiento')]:
        tap(wait(tag='sections-search'));adb('shell','input','text',query)
        adb('shell','input','keyevent','KEYCODE_BACK');tap(wait(tag='section-'+route))
        wait(tag=screen);time.sleep(4);capture('discovery-'+route)
        card=next((n for n in tree().iter('node') if n.get('resource-id','').startswith(prefix)),None)
        culture_check[route]={'screen_verified':True,'published_item_found':card is not None,'detail_verified':False}
        if card is not None:
            tap(card);wait(desc=close_label);capture('discovery-'+route+'-detail')
            culture_check[route]['detail_verified']=True;tap(wait(desc=close_label))
        tap(wait(desc='Volver a Secciones'));wait(tag='sections-screen')
        tap(wait(desc='Borrar búsqueda de secciones'))
    (OUT/'culture-summary.json').write_text(json.dumps(culture_check,indent=2))

    tap(wait(desc='Volver a Inicio'))
    home_card('open-postcards')
    wait(tag='postcards-screen');tap(wait(tag='postcard-preview-tab'))
    wait(tag='postcard-image',seconds=50);time.sleep(2);capture('discovery-postcard-preview')
    for _ in range(12):
        share=find(tree(),tag='postcard-share')
        if share is not None and share.get('enabled')=='true':
            tap(share);break
        if share is None:adb('shell','input','swipe','360','1180','360','700','350')
        time.sleep(1)
    else:raise AssertionError('Postcard share never became available')
    time.sleep(3)
    # The chooser is opened only; never select a recipient or send the image.
    filenames=adb('shell','run-as',PKG,'ls','cache/postcards').splitlines()
    filename=next(name for name in filenames if name.startswith('postal-') and name.endswith('.png'))
    png=adb('exec-out','run-as',PKG,'cat','cache/postcards/'+filename,binary=True)
    assert png[:8]==b'\x89PNG\r\n\x1a\n','Export is not a PNG'
    import struct
    width,height=struct.unpack('>II',png[16:24])
    assert (width,height)==(1080,1920),(width,height)
    (OUT/'postcard-export.png').write_bytes(png)
    (OUT/'postcard-summary.json').write_text(json.dumps({'png_export_verified':True,'width':width,'height':height,'recipient_selected':False},indent=2))
    adb('shell','input','keyevent','KEYCODE_BACK');time.sleep(1)
    tap(wait(desc='Volver a Inicio'))
    home_card('open-shop')
    wait(tag='shop-screen');time.sleep(3);capture('discovery-shop')
    tap(wait(tag='shop-cart'));capture('discovery-shop-cart')
    assert 'Tu pedido está vacío.' in ' '.join(n.get('text','') for n in tree().iter('node'))
    tap(wait(desc='Volver a Inicio'))
    home_card('open-notices')
    wait(tag='push-screen');capture('discovery-notices')
    assert find(tree(),tag='push-enable') is None,'Guest can subscribe without an account'
    home_card('push-local-test');time.sleep(2)
    allow=find(tree(),tag='permission_allow_button')
    if allow is not None:tap(allow)
    time.sleep(3)
    adb('shell','cmd','statusbar','expand-notifications');time.sleep(2);capture('discovery-local-notification')
    local_notice=next((n for n in tree().iter('node') if n.get('text')=='VisitaLoja · Prueba local'),None)
    assert local_notice is not None,'Android did not show the local notification'
    tap(local_notice);wait(tag='push-screen');capture('discovery-notification-open')
    tap(wait(desc='Volver a Inicio'))
    home_card('open-itinerary')
    wait(tag='itinerary-screen');capture('discovery-itinerary')
    assert 'Tu próxima aventura empieza aquí' in ' '.join(n.get('text','') for n in tree().iter('node'))
    # Public menu smoke: no account or document writes; catalogue availability is reported explicitly.
    explore = next(n for n in tree().iter('node') if n.get('text') == 'Explorar paradas')
    tap(explore); tap(wait(tag='explore-search'))
    adb('shell','input','text','Sport');adb('shell','input','keyevent','KEYCODE_BACK');time.sleep(4)
    card = next((n for n in tree().iter('node') if n.get('resource-id','').startswith('place-card-')),None)
    menu_verified = False
    if card is not None:
        tap(card);wait(desc='Cerrar ficha');time.sleep(5)
        capture('discovery-menu-place')
        info_verified = False
        for _ in range(6):
            root = tree()
            text = ' '.join(n.get('text','') for n in root.iter('node'))
            if 'Horario de atención' in text and any(label in text for label in ['Dentro del horario general','Fuera del horario general','Horario por confirmar','Consulta el horario publicado','Horario guardado']):
                capture('discovery-place-information');info_verified = True;break
            adb('shell','input','swipe','360','1150','360','950','350');time.sleep(1)
        assert info_verified,'Place opening-hours information did not render'

        for _ in range(7):
            root=tree()
            menu_button=find(root,tag='open-digital-menu') or next((n for n in root.iter('node') if n.get('text')=='Ver menú'),None)
            if menu_button is not None:break
            adb('shell','input','swipe','360','1150','360','950','350');time.sleep(1)
        if menu_button is not None:
            tap(menu_button);wait(desc='Cerrar menú');time.sleep(4);capture('discovery-digital-menu')
            tap(wait(desc='Ampliar menú'));capture('discovery-digital-menu-zoom')
            tap(wait(desc='Cerrar menú'));menu_verified=True
        # Back may collapse an expanded Material sheet first; then close its visible header.
        for _ in range(3):
            current=tree()
            if find(current,tag='explore-search') is not None or find(current,tag='home-sections') is not None:break
            close_sheet=find(current,desc='Cerrar ficha')
            if close_sheet is not None:
                tap(close_sheet);time.sleep(1);break
            adb('shell','input','keyevent','KEYCODE_BACK');time.sleep(1)

    (OUT/'menu-summary.json').write_text(json.dumps({'viewer_verified':menu_verified,'note':'Published Sport menu opened' if menu_verified else 'No available published menu in the current Sport search'},indent=2))
    # Only inspect public media controls; never change a business publication or entitlement.
    field=wait(tag='explore-search');tap(field)
    adb('shell','input','keyevent','KEYCODE_MOVE_END')
    for _ in range(8):adb('shell','input','keyevent','KEYCODE_DEL')
    adb('shell','input','text','Expreso');adb('shell','input','keyevent','KEYCODE_BACK');time.sleep(4)
    public_card=next((n for n in tree().iter('node') if n.get('resource-id','').startswith('place-card-')),None)
    media_check={'published_place_found':public_card is not None,'spanish_control':False,'english_control':False,'video_control':False,'playback_verified':False}
    if public_card is not None:
        tap(public_card);wait(desc='Cerrar ficha');time.sleep(2)
        for _ in range(10):
            root=tree();text=' '.join(n.get('text','') for n in root.iter('node'))
            media_check['spanish_control'] |= 'Escuchar en español' in text
            media_check['english_control'] |= 'Escuchar en inglés' in text
            media_check['video_control'] |= 'Conoce este lugar por video' in text
            if media_check['spanish_control'] and media_check['english_control']:
                capture('discovery-place-media');break
            adb('shell','input','swipe','360','1180','360','850','350');time.sleep(1)
        for _ in range(3):
            current=tree()
            if find(current,tag='explore-search') is not None or find(current,tag='home-sections') is not None:break
            close_sheet=find(current,desc='Cerrar ficha')
            if close_sheet is not None:tap(close_sheet);time.sleep(1);break
            adb('shell','input','keyevent','KEYCODE_BACK');time.sleep(1)
    (OUT/'place-media-summary.json').write_text(json.dumps(media_check,indent=2))
    back_home=find(tree(),desc='Volver a Inicio')
    if back_home is not None:tap(back_home)
    else:assert find(tree(),tag='home-sections') is not None,'Neither Explore nor Home after closing the place sheet'
    home_card('open-missions')
    wait(tag='missions-screen');time.sleep(3);capture('discovery-missions')
    texts=' '.join(n.get('text','') for n in tree().iter('node'))
    assert 'Guarda tu aventura' in texts or 'Ingresar a mi cuenta' in texts,texts
    # Public guest flow: no account, preferences, points or reward writes.
    card=next((n for n in tree().iter('node') if n.get('resource-id','').startswith('mission-') and not n.get('resource-id','').startswith('missions-') and n.get('resource-id')!='mission-search' and n.get('clickable')=='true'),None)
    for _ in range(3):
        if card is not None:break
        adb('shell','input','swipe','360','1180','360','650','350');time.sleep(1)
        card=next((n for n in tree().iter('node') if n.get('resource-id','').startswith('mission-') and n.get('clickable')=='true' and n.get('resource-id')!='mission-search'),None)
    if card is not None:
        tap(card);time.sleep(2);capture('discovery-mission-detail')
        adb('shell','input','keyevent','KEYCODE_BACK');time.sleep(1)
    tap(wait(tag='missions-tab-1'));time.sleep(1);capture('discovery-mission-adventure')
    assert find(tree(),desc='Guardar preferencia') is None
    tap(wait(tag='missions-tab-2'));time.sleep(2);capture('discovery-mission-ranking')
    root=tree()
    assert find(root,tag='mission-ranking-preference') is None,'Guest can edit ranking'
    tap(wait(desc='Volver a Inicio'))
    home_card('open-photos')
    wait(tag='photos-screen')
    time.sleep(3)
    capture('discovery-photos')
    root = tree()
    photo = next((n for n in root.iter('node') if n.get('resource-id', '').startswith('photo-') and n.get('clickable') == 'true'), None)
    if photo is not None:
        tap(photo); wait(desc='Cerrar fotografías'); capture('discovery-photo-viewer')
        tap(wait(desc='Cerrar fotografías'))
    tap(wait(desc='Volver a Inicio'))
    def open_strip_card(tag):
        for _ in range(7):
            root = tree()
            visible = next((find(root, tag=t) for t in ['open-photos','open-time','open-videos','open-podcast'] if find(root,tag=t) is not None), None)
            if visible is not None: break
            adb('shell','input','swipe','360','1180','360','550','350')
            time.sleep(1)
        assert visible is not None, 'Discovery strip missing'
        for _ in range(6):
            root = tree(); node = find(root,tag=tag)
            if node is not None:
                x1,y1,x2,y2=map(int,re.findall(r'\d+',node.get('bounds')))
                if x2-x1 > 150:
                    tap(node); return
            visible=next(find(root,tag=t) for t in ['open-photos','open-time','open-videos','open-podcast'] if find(root,tag=t) is not None)
            x1,y1,x2,y2=map(int,re.findall(r'\d+',visible.get('bounds')))
            y=(y1+y2)//2
            adb('shell','input','swipe','630',str(y),'120',str(y),'350')
            time.sleep(1)
        raise AssertionError('Unable to open '+tag)
    open_strip_card('open-time')
    wait(tag='time-screen'); time.sleep(3); capture('discovery-time')
    tap(wait(desc='Volver a Inicio'))
    open_strip_card('open-videos')
    wait(tag='videos-screen'); time.sleep(3); capture('discovery-videos')
    youtube = None
    for _ in range(5):
        root = tree()
        youtube = next((n for n in root.iter('node') if n.get('resource-id','').startswith('youtube-open-')), None)
        if youtube is not None: break
        if any('Pronto, más miradas' in n.get('text','') for n in root.iter('node')): break
        adb('shell','input','swipe','360','1180','360','650','350')
        time.sleep(1)
    video_check = {'published_youtube_found':youtube is not None,'playing_verified':False}
    if youtube is not None:
        tap(youtube); wait(desc='Cerrar video')
        end = time.monotonic()+45
        while time.monotonic()<end:
            root=tree()
            texts=' '.join(n.get('text','') for n in root.iter('node'))
            if 'Pulsa ▶' in texts or 'no permite' in texts or 'no está disponible' in texts or 'no pudo' in texts or 'Reintentar' in texts: break
            time.sleep(1)
        capture('discovery-youtube')
        assert any(message in texts for message in ['Pulsa ▶','Reproduciendo en la app','no permite','no está disponible','no pudo','No se pudo']),texts
        assert 'YouTube no pudo verificar' not in texts, texts
        assert 'YouTube está tardando' not in texts, texts
        if 'Pulsa ▶' in texts:
            frame=next((n for n in root.iter('node') if n.get('class')=='android.webkit.WebView'),None)
            assert frame is not None,'YouTube WebView missing'
            x1,y1,x2,y2=map(int,re.findall(r'\d+',frame.get('bounds')))
            assert x2-x1>=400 and y2-y1>=400,'YouTube viewport below minimum'
            tap(frame)
            end=time.monotonic()+30
            while time.monotonic()<end:
                texts=' '.join(n.get('text','') for n in tree().iter('node'))
                if 'Reproduciendo en la app' in texts:
                    video_check['playing_verified']=True;break
                if 'no permite' in texts or 'no está disponible' in texts:break
                time.sleep(1)
            capture('discovery-youtube-play')
            if video_check['playing_verified']:
                adb('shell','input','keyevent','KEYCODE_HOME');time.sleep(2)
                adb('shell','am','start','-n',PKG+'/com.visitaloja.app.MainActivity')
                end=time.monotonic()+20
                while time.monotonic()<end:
                    texts=' '.join(n.get('text','') for n in tree().iter('node'))
                    if 'Pulsa ▶' in texts:break
                    time.sleep(1)
                assert 'Reproduciendo en la app' not in texts,'Video resumed without a tap'
                capture('discovery-youtube-paused')
        video_check['last_status']=texts
        # A 320 dp wide phone must still get the official minimum 200 dp height.
        adb('shell','wm','size','640x1600');time.sleep(5)
        wait(desc='Cerrar video')
        narrow=tree()
        frame=next((n for n in narrow.iter('node') if n.get('class')=='android.webkit.WebView'),None)
        assert frame is not None
        x1,y1,x2,y2=map(int,re.findall(r'\d+',frame.get('bounds')))
        assert y2-y1>=400,('Small-phone player too short',frame.get('bounds'))
        capture('discovery-youtube-small-phone')
        adb('shell','wm','size','720x1600');time.sleep(5)
        tap(wait(desc='Cerrar video'))
    (OUT/'video-summary.json').write_text(json.dumps(video_check,indent=2,ensure_ascii=False))
    tap(wait(desc='Volver a Inicio'))
    open_strip_card('open-podcast')
    wait(tag='podcast-screen'); time.sleep(3); capture('discovery-podcast')
    # Only public, admin-published audio. No accounts, writes, or invented recordings.
    play = find(tree(), tag='podcast-play')
    if play is not None and play.get('enabled') == 'true':
        tap(play); wait(tag='audio-player'); time.sleep(8); capture('discovery-player')
        text=' '.join(n.get('text','') for n in tree().iter('node'))
        assert 'Audio no disponible' not in text, text
        # Pause on background, including buffering; returning must not autoplay.
        adb('shell','input','keyevent','KEYCODE_HOME'); time.sleep(2)
        adb('shell','am','start','-n',PKG+'/com.visitaloja.app.MainActivity')
        wait(desc='Reproducir audio')
        capture('discovery-player-paused')
    (OUT/'discovery-summary.json').write_text(json.dumps({'passed':True,'screens':checks},indent=2))
except BaseException:
    try:
        capture('discovery-failure')
        (OUT/'discovery-logcat.txt').write_text(adb('logcat','-d','-t','400'))
    except Exception:
        pass
    raise
finally:
    adb('shell','am','force-stop',PKG)
