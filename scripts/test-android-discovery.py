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
    adb('shell', 'am', 'force-stop', PKG)
    adb('shell', 'am', 'start', '-n', PKG + '/com.visitaloja.app.MainActivity')
    time.sleep(4)
    home_card('open-photos')
    wait(tag='photos-screen')
    time.sleep(3)
    capture('discovery-photos')
    root = tree()
    photo = next((n for n in root.iter('node') if n.get('resource-id', '').startswith('photo-') and n.get('clickable') == 'true'), None)
    if photo is not None:
        tap(photo); wait(tag='photo-viewer'); capture('discovery-photo-viewer')
        tap(wait(desc='Cerrar fotografías'))
    tap(wait(desc='Volver a Inicio'))
    def open_strip_card(tag):
        for _ in range(7):
            root = tree()
            visible = next((find(root, tag=t) for t in ['open-photos','open-time','open-podcast'] if find(root,tag=t) is not None), None)
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
            visible=next(find(root,tag=t) for t in ['open-photos','open-time','open-podcast'] if find(root,tag=t) is not None)
            x1,y1,x2,y2=map(int,re.findall(r'\d+',visible.get('bounds')))
            y=(y1+y2)//2
            adb('shell','input','swipe','630',str(y),'120',str(y),'350')
            time.sleep(1)
        raise AssertionError('Unable to open '+tag)
    open_strip_card('open-time')
    wait(tag='time-screen'); time.sleep(3); capture('discovery-time')
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
finally:
    adb('shell','am','force-stop',PKG)
