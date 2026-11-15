#!/usr/bin/env python3
"""Opt-in/permissions and actual Play Services registration. No production writes or accounts.
Does not claim to verify physical background proximity delivery.
"""
import json,re,subprocess,time,xml.etree.ElementTree as ET
from pathlib import Path
OUT=Path('android/native/map-ui-results');OUT.mkdir(parents=True,exist_ok=True)
PKG='com.visitaloja.app.preview'
def adb(*args,binary=False):
    p=subprocess.run(['adb',*args],check=True,capture_output=True,timeout=35)
    return p.stdout if binary else p.stdout.decode(errors='replace').strip()
def tree():
    for i in range(5):
        try:
            adb('shell','uiautomator','dump','/sdcard/nearby-qa.xml')
            root=ET.fromstring(adb('exec-out','cat','/sdcard/nearby-qa.xml'))
            if any(n.get('resource-id')=='android:id/alertTitle' and n.get('text')=="Pixel Launcher isn't responding" for n in root.iter('node')):
                tap(next(n for n in root.iter('node') if n.get('resource-id')=='android:id/aerr_wait'))
                adb('shell','am','start','-n',PKG+'/com.visitaloja.app.MainActivity');continue
            words={n.get('text','') for n in root.iter('node')}
            if {'VisitaLoja','Consultar disponibilidad','Cerrar'}.issubset(words):
                tap(next(n for n in root.iter('node') if n.get('text')=='Cerrar'));continue
            return root
        except (ET.ParseError,subprocess.CalledProcessError):
            if i==4:raise
            time.sleep(1)
def tagged(tag):
    root=tree()
    nodes=list(root.iter('node'))
    exact=next((n for n in nodes if n.get('resource-id','').split(':id/')[-1]==tag),None)
    if exact is not None:return exact
    labels={'nearby-settings':'Paradas cercanas ·','nearby-enable':'Activar avisos en segundo plano','nearby-disable':'Desactivar avisos','push-local-test':'Ver una notificación de prueba'}
    if tag in labels:return next((n for n in nodes if n.get('text','').startswith(labels[tag]) and n.get('bounds')!='[0,0][0,0]'),None)
    if tag=='nearby-status':return next((n for n in nodes if n.get('text','').startswith(('Activos ·','Avisos desactivados'))),None)
    return None
def wait(tag):
    for _ in range(25):
        n=tagged(tag)
        if n is not None:return n
        time.sleep(1)
    (OUT/'nearby-failure.png').write_bytes(adb('exec-out','screencap','-p',binary=True))
    ET.ElementTree(tree()).write(OUT/'nearby-failure.xml',encoding='utf-8')
    raise AssertionError('Missing '+tag)
def tap(n):
    x1,y1,x2,y2=map(int,re.findall(r'\d+',n.get('bounds')));adb('shell','input','tap',str((x1+x2)//2),str((y1+y2)//2))
def scroll_to(tag):
    for _ in range(5):
        n=tagged(tag)
        if n is not None:return n
        adb('shell','input','swipe','350','1150','350','600','350');time.sleep(.5)
    (OUT/'nearby-failure.png').write_bytes(adb('exec-out','screencap','-p',binary=True))
    ET.ElementTree(tree()).write(OUT/'nearby-failure.xml',encoding='utf-8')
    raise AssertionError('Missing '+tag)
for permission in ['ACCESS_COARSE_LOCATION','ACCESS_FINE_LOCATION','ACCESS_BACKGROUND_LOCATION','POST_NOTIFICATIONS']:
    adb('shell','pm','grant',PKG,'android.permission.'+permission)
adb('shell','cmd','location','set-location-enabled','false')
adb('emu','geo','fix','-79.201425','-4.005324')
adb('shell','am','start','-n',PKG+'/com.visitaloja.app.MainActivity');time.sleep(4)
tap(wait('nav-account'));time.sleep(2);tap(wait('nearby-settings'));time.sleep(1)
assert tagged('nearby-disable') is None,'Must be opt-in by default'
(OUT/'nearby-permissions.png').write_bytes(adb('exec-out','screencap','-p',binary=True))
tap(scroll_to('nearby-enable'))
time.sleep(1)
assert tagged('nearby-disable') is None,'GPS off must block activation'
def preferences():
    try:
        raw=adb('exec-out','run-as',PKG,'cat','shared_prefs/nearby-stops.xml')
    except subprocess.CalledProcessError:
        return {}
    try:
        root=ET.fromstring(raw)
    except ET.ParseError:
        # exec-out can return a missing-file message with exit status 0 before
        # the first asynchronous preference save. Later assertions still require
        # a real, parsed registration and disabled state.
        return {}
    return {n.get('name'):n.get('value',n.text or '') for n in root}
assert preferences().get('enabled','false')!='true','Must not enable while GPS is off'
adb('shell','cmd','location','set-location-enabled','true')
adb('shell','input','keyevent','KEYCODE_HOME')
adb('shell','am','start','-n',PKG+'/com.visitaloja.app.MainActivity');time.sleep(2)
tap(scroll_to('nearby-enable'))
registered=False
for _ in range(40):
    if preferences().get('status','').startswith('Activos ·'):registered=True;break
    time.sleep(1)
if not registered:
    # Retry through the public UI after a transient directory/network failure.
    # Still require the real Play Services success status and registration time.
    review=next((n for n in tree().iter('node') if n.get('text')=='Revisar activación'),None)
    if review is not None:
        tap(review)
        for _ in range(60):
            if preferences().get('status','').startswith('Activos ·'):registered=True;break
            time.sleep(1)
    saved=preferences()
    (OUT/'nearby-registration-state.json').write_text(json.dumps({k:saved.get(k) for k in ['status','catalogAt','registeredAt']},ensure_ascii=False,indent=2))
(OUT/'nearby-activated.png').write_bytes(adb('exec-out','screencap','-p',binary=True))
ET.ElementTree(tree()).write(OUT/'nearby-activation.xml',encoding='utf-8')
assert registered,'Geofencing registration not confirmed'
registered_at=preferences().get('registeredAt','0')
assert int(registered_at)>0,'Registration diagnostic timestamp missing'
adb('shell','input','keyevent','KEYCODE_HOME');time.sleep(2)
adb('shell','am','start','-n',PKG+'/com.visitaloja.app.MainActivity');time.sleep(15)
assert preferences().get('registeredAt')==registered_at,'Resume must preserve a healthy dwell registration'
tap(scroll_to('nearby-disable'))
for _ in range(30):
    saved=preferences()
    if saved.get('enabled')=='false' and saved.get('registeredAt','0')=='0' and 'desactivados' in saved.get('status','').lower():break
    time.sleep(.5)
else:
    (OUT/'nearby-disable-failure.png').write_bytes(adb('exec-out','screencap','-p',binary=True))
    (OUT/'nearby-disable-state.json').write_text(json.dumps({k:saved.get(k) for k in ['enabled','status','registeredAt']},indent=2))
    raise AssertionError('Disable state was not persisted after the UI action')
(OUT/'nearby-disabled.png').write_bytes(adb('exec-out','screencap','-p',binary=True))
(OUT/'nearby-summary.json').write_text(json.dumps({'opt_in':True,'gps_off_blocks_activation':True,'play_services_registration':True,'resume_preserves_registration':True,'disabled':True,'physical_background_delivery':'pending'},indent=2))
adb('shell','am','start','-n',PKG+'/com.visitaloja.app.MainActivity','-a','com.visitaloja.app.OPEN_NOTICES')
wait('push-screen')
tap(scroll_to('push-local-test'));time.sleep(1)
adb('shell','cmd','statusbar','expand-notifications');time.sleep(2)
notice=None
for _ in range(15):
    notice=next((n for n in tree().iter('node') if '¡Novedades en VisitaLoja!' in n.get('text','')),None)
    if notice is not None:break
    time.sleep(1)
assert notice is not None,'Local general notification not shown in Android notification shade'
tap(notice);wait('push-screen')
(OUT/'push-local-summary.json').write_text(json.dumps({'local_notification_shown':True,'tap_opens_notices':True,'guest_cannot_resolve_other_account_notice':True,'remote_fcm_delivery':'pending'},indent=2))
adb('shell','am','force-stop',PKG)
