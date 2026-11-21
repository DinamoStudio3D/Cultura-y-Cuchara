#!/usr/bin/env python3
"""Read-only visual check of real published place photos and fullscreen navigation."""
import re, subprocess, time, xml.etree.ElementTree as ET, json
from pathlib import Path
OUT=Path('android/native/map-ui-results');OUT.mkdir(parents=True,exist_ok=True)
PKG='com.visitaloja.app.preview'
def adb(*args,binary=False):
    result=subprocess.run(['adb',*args],check=True,capture_output=True,timeout=35)
    return result.stdout if binary else result.stdout.decode(errors='replace').strip()
def tree():
    for i in range(5):
        try:
            adb('shell','uiautomator','dump','/sdcard/place-photos.xml')
            return ET.fromstring(adb('exec-out','cat','/sdcard/place-photos.xml'))
        except (ET.ParseError,subprocess.CalledProcessError):
            if i==4:raise
            time.sleep(1)
def wait(desc=None,text=None):
    for _ in range(25):
        root=tree()
        item=next((n for n in root.iter('node') if (desc is not None and n.get('content-desc')==desc) or (text is not None and n.get('text')==text)),None)
        if item is not None:return item
        time.sleep(1)
    raise AssertionError('Photo control not found: '+str(desc or text))
def tap(node):
    x1,y1,x2,y2=map(int,re.findall(r'\d+',node.get('bounds')))
    adb('shell','input','tap',str((x1+x2)//2),str((y1+y2)//2))
def capture(name):
    root=tree()
    (OUT/(name+'.png')).write_bytes(adb('exec-out','screencap','-p',binary=True))
    ET.ElementTree(root).write(OUT/(name+'.xml'),encoding='utf-8')
try:
    for label,reference,title in [('expreso','loc_1788797820110','Expreso al Sur'),('codeproim','HHSL0Cb1u3eFfxGzbfoC','Codeproim')]:
        adb('shell','am','force-stop',PKG)
        adb('shell','am','start','-n',PKG+'/com.visitaloja.app.MainActivity','-a','android.intent.action.VIEW','-d','https://www.visitaloja.com/?checkin='+reference)
        wait(desc='Ampliar fotografía 1 de '+title);time.sleep(3)
        capture('place-photo-'+label)
        tap(wait(text='Ampliar'));wait(desc='Cerrar fotografías');capture('place-photo-'+label+'-fullscreen')
        tap(wait(desc='Cerrar fotografías'));wait(desc='Cerrar ficha')
    tap(wait(desc='Cerrar ficha'))
    adb('shell','am','start','-n',PKG+'/com.visitaloja.app.MainActivity','-a','android.intent.action.VIEW','-d','https://www.visitaloja.com/restaurantes-en-loja')
    time.sleep(5);capture('place-photo-list')
    (OUT/'place-photo-summary.json').write_text(json.dumps({'real_published_places_opened':2,'fullscreen_open_close':True,'list_captured':True,'photo_assets_modified':False},indent=2))
except BaseException:
    try:
        capture('place-photo-failure')
        (OUT/'place-photo-crash.txt').write_text(adb('logcat','-d','-b','crash'))
    except Exception:pass
    raise
finally:
    adb('shell','am','force-stop',PKG)
