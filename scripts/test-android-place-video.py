#!/usr/bin/env python3
"""Read-only check of the published Expreso video, portrait frame and close."""
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
    raise AssertionError('Video control not found: '+str(desc or text))
def video_button(root):
    """The label can be a 40px TextView inside the actual 96px tap target."""
    parents={child:parent for parent in root.iter() for child in parent}
    for node in root.iter('node'):
        if not (node.get('resource-id','').split(':id/')[-1]=='place-video' or
                node.get('text') in ['Conoce este lugar por video','Discover this place on video'] or
                node.get('content-desc') in ['Conoce este lugar por video','Discover this place on video']):
            continue
        target=node
        while target is not None:
            if target.get('clickable')=='true' and target.get('enabled','true')=='true':
                return target
            target=parents.get(target)
    return None

def tap(node):
    x1,y1,x2,y2=map(int,re.findall(r'\d+',node.get('bounds')))
    adb('shell','input','tap',str((x1+x2)//2),str((y1+y2)//2))
def capture(name):
    root=tree()
    (OUT/(name+'.png')).write_bytes(adb('exec-out','screencap','-p',binary=True))
    ET.ElementTree(root).write(OUT/(name+'.xml'),encoding='utf-8')
try:
    adb('shell','am','force-stop',PKG)
    adb('shell','am','start','-n',PKG+'/com.visitaloja.app.MainActivity','-a','android.intent.action.VIEW','-d','https://www.visitaloja.com/?checkin=loc_1788797820110')
    wait(desc='Cerrar ficha')
    for _ in range(25):
        root=tree()
        button=video_button(root)
        if button is not None:
            bounds=list(map(int,re.findall(r'\d+',button.get('bounds'))))
            if bounds[3]-bounds[1]>=50 and bounds[1]>=96 and bounds[3]<1500:
                tap(button);break
        if button is not None and bounds[1]<96 and bounds[3]>bounds[1]:
            adb('shell','input','swipe','370','700','370','1050','350')
        else:adb('shell','input','swipe','370','1200','370','880','350')
        time.sleep(.5)
    else:raise AssertionError('Missing place video entry')
    wait(desc='Cerrar video')
    for _ in range(35):
        root=tree()
        stage=next((n for n in root.iter('node') if n.get('resource-id','').split(':id/')[-1]=='file-video-stage'),None)
        if stage is not None:
            x1,y1,x2,y2=map(int,re.findall(r'\d+',stage.get('bounds')))
            if y2-y1>(x2-x1)*1.3:break
        time.sleep(1)
    else:raise AssertionError('Expreso MP4 did not acquire a tall stage')
    capture('expreso-vertical-video')
    assert y2<=1550 and y1>=48,(x1,y1,x2,y2)
    tap(wait(desc='Cerrar video'));wait(desc='Cerrar ficha')
    (OUT/'place-video-summary.json').write_text(json.dumps({'live_place':'Expreso al Sur','portrait_stage':True,'bounds':[x1,y1,x2,y2],'close_returns_to_place':True}))
except BaseException:
    try:capture('place-video-failure')
    except Exception:pass
    raise
finally:
    adb('shell','am','force-stop',PKG)
