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
adb('logcat','-c')
log_file=(OUT/'logo-tag-logcat.txt').open('w')
log_process=subprocess.Popen(['adb','logcat','-v','brief','VisitaLojaLogos:V','*:S'],stdout=log_file,stderr=subprocess.STDOUT)
try:
    adb('shell','am','start','-n',PKG+'/com.visitaloja.app.MainActivity');time.sleep(4)
    tap(wait('nav-map'));wait('map-canvas');tap(wait('map-query-input'))
    adb('shell','input','text','Codeproim');adb('shell','input','keyevent','KEYCODE_BACK');wait('map-query-input')
    deadline=time.monotonic()+90
    retries=0
    while time.monotonic()<deadline:
        records=[]
        for line in (OUT/'logo-tag-logcat.txt').read_text().splitlines():
            if 'VisitaLojaLogos' in line and '{' in line:
                try:record=json.loads(line[line.index('{'):])
                except json.JSONDecodeError:continue
                if 'pinCount' in record:records.append(record)
        if records:
            current=records[-1]
            if current.get('logoLoaded') and current.get('imagePresent') and current.get('pinCount',0)>0 and current.get('inView'):break
        root=tree()
        retry=next((n for n in root.iter('node') if n.get('text') in ['Reintentar paradas','Sin conexión · Actualizar']),None)
        if retry is not None and retries<2:
            tap(retry);retries+=1;time.sleep(2)
        time.sleep(1)
    (OUT/'codeproim-focused.png').write_bytes(adb('exec-out','screencap','-p',binary=True))
    logs=adb('logcat','-d');(OUT/'logo-logcat.txt').write_text(logs)
    log_process.terminate();log_process.wait(timeout=10);log_file.close()
    logs=(OUT/'logo-tag-logcat.txt').read_text()
    traces=[]
    for line in logs.splitlines():
        if 'VisitaLojaLogos' in line and '{' in line:
            try:traces.append(json.loads(line[line.index('{'):]))
            except json.JSONDecodeError:pass
    (OUT/'logo-render-summary.json').write_text(json.dumps(traces,indent=2))
    ET.ElementTree(tree()).write(OUT/'logo-final-ui.xml',encoding='utf-8')
    assert traces,'No marker renderer diagnostics'
    records=[r for r in traces if 'pinCount' in r]
    assert records,traces
    last=records[-1]
    assert last['logoLoaded'] and last['imagePresent'],last
    assert last['pinCount']>0 and last['inView'],last
finally:
    if log_process.poll() is None:log_process.terminate();log_process.wait(timeout=10)
    log_file.close()
    adb('shell','am','force-stop',PKG)
