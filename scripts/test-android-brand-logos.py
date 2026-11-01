#!/usr/bin/env python3
"""Focused public map regression. No accounts, location requests or writes."""
import json,re,subprocess,time,xml.etree.ElementTree as ET
from pathlib import Path
OUT=Path('android/native/map-ui-results');OUT.mkdir(parents=True,exist_ok=True)
PKG='com.visitaloja.app.preview'
def adb(*args,binary=False):
    p=subprocess.run(['adb',*args],check=True,capture_output=True,timeout=35)
    return p.stdout if binary else p.stdout.decode(errors='replace').strip()
def tree():
    for attempt in range(5):
        try:
            adb('shell','uiautomator','dump','/sdcard/logo-qa.xml')
            root=ET.fromstring(adb('exec-out','cat','/sdcard/logo-qa.xml'))
            words={n.get('text','') for n in root.iter('node')}
            if {'VisitaLoja','Consultar disponibilidad','Cerrar'}.issubset(words):
                tap(next(n for n in root.iter('node') if n.get('text')=='Cerrar'));continue
            return root
        except (ET.ParseError,subprocess.CalledProcessError):
            if attempt==4:raise
            time.sleep(1)
def node(tag):
    return next((n for n in tree().iter('node') if n.get('resource-id','').split(':id/')[-1]==tag),None)
def wait(tag):
    for _ in range(20):
        n=node(tag)
        if n is not None:return n
        time.sleep(1)
    raise AssertionError('Missing '+tag)
def tap(n):
    x1,y1,x2,y2=map(int,re.findall(r'\d+',n.get('bounds')))
    adb('shell','input','tap',str((x1+x2)//2),str((y1+y2)//2))
try:
    adb('logcat','-c');adb('shell','am','start','-n',PKG+'/com.visitaloja.app.MainActivity');time.sleep(4)
    tap(wait('nav-map'));wait('map-canvas');tap(wait('map-search-bar'))
    adb('shell','input','text','Codeproim');adb('shell','input','keyevent','KEYCODE_BACK');time.sleep(8)
    (OUT/'codeproim-focused.png').write_bytes(adb('exec-out','screencap','-p',binary=True))
    logs=adb('logcat','-d','-t','1000');(OUT/'logo-logcat.txt').write_text(logs)
    traces=[]
    for line in logs.splitlines():
        if 'VisitaLojaLogos' in line and '{' in line:
            try:traces.append(json.loads(line[line.index('{'):]))
            except json.JSONDecodeError:pass
    (OUT/'logo-render-summary.json').write_text(json.dumps(traces,indent=2))
    assert traces,'No marker renderer diagnostics'
    last=traces[-1]
    assert last['logoLoaded'] and last['imagePresent'],last
    assert last['pinCount']>0 and last['inView'],last
finally:
    adb('shell','am','force-stop',PKG)
