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
    labels={'nearby-settings':'Paradas cercanas ·','nearby-enable':'Activar avisos en segundo plano','nearby-disable':'Desactivar avisos'}
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
adb('shell','cmd','location','set-location-enabled','true')
adb('emu','geo','fix','-79.201425','-4.005324')
adb('shell','am','start','-n',PKG+'/com.visitaloja.app.MainActivity');time.sleep(4)
tap(wait('nav-account'));time.sleep(2);tap(wait('nearby-settings'));time.sleep(1)
assert tagged('nearby-disable') is None,'Must be opt-in by default'
(OUT/'nearby-permissions.png').write_bytes(adb('exec-out','screencap','-p',binary=True))
tap(scroll_to('nearby-enable'))
registered=False
for _ in range(40):
    status=tagged('nearby-status')
    if status is not None and 'Activos' in status.get('text',''):registered=True;break
    time.sleep(1)
(OUT/'nearby-activated.png').write_bytes(adb('exec-out','screencap','-p',binary=True))
ET.ElementTree(tree()).write(OUT/'nearby-activation.xml',encoding='utf-8')
assert registered,'Geofencing registration not confirmed'
tap(scroll_to('nearby-disable'))
assert 'desactivados' in wait('nearby-status').get('text','').lower()
(OUT/'nearby-disabled.png').write_bytes(adb('exec-out','screencap','-p',binary=True))
(OUT/'nearby-summary.json').write_text(json.dumps({'opt_in':True,'play_services_registration':True,'disabled':True,'physical_background_delivery':'pending'},indent=2))
adb('shell','am','force-stop',PKG)
