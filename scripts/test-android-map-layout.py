#!/usr/bin/env python3
"""Real APK / emulator regression for the 360 x 800 dp reported screen.
Public guest map only. Coordinates are injected into a disposable emulator;
this is not a physical satellite/GPS accuracy test. No account sign-in/writes.
"""
import json
import re
import struct
import subprocess
import threading
import time
import xml.etree.ElementTree as ET
from pathlib import Path

OUTPUT = Path("android/native/map-ui-results")
PACKAGE = "com.visitaloja.app.preview"
OUTPUT.mkdir(parents=True, exist_ok=True)
checks = []
stop = threading.Event()


def adb(*args, binary=False):
    result = subprocess.run(["adb", *args], check=True, capture_output=True, timeout=35)
    return result.stdout if binary else result.stdout.decode(errors="replace").strip()


def hierarchy(dismissed=False):
    adb("shell", "uiautomator", "dump", "/sdcard/visitaloja-ui.xml")
    root = ET.fromstring(adb("exec-out", "cat", "/sdcard/visitaloja-ui.xml"))
    if not dismissed and dismiss_entry_announcement(root): return hierarchy(dismissed=True)
    return root



def dismiss_entry_announcement(root):
    # Only the branded entry announcement, never a commerce confirmation or OS prompt.
    nodes=list(root.iter('node'))
    words={n.get('text','') for n in nodes}
    if not {'VisitaLoja', 'Consultar disponibilidad', 'Cerrar'}.issubset(words): return False
    close=next(n for n in nodes if n.get('text')=='Cerrar')
    OUTPUT.mkdir(parents=True,exist_ok=True)
    (OUTPUT/'map-entry-announcement.png').write_bytes(adb('exec-out','screencap','-p',binary=True))
    ET.ElementTree(root).write(OUTPUT/'map-entry-announcement.xml',encoding='utf-8')
    (OUTPUT/'entry-announcement-summary.json').write_text(json.dumps({'published_announcement_verified':True,'branding_verified':True,'close_verified':True,'contact_opened':False},indent=2))
    tap(close);time.sleep(1)
    adb('shell','uiautomator','dump','/sdcard/announcement-closed.xml')
    after=ET.fromstring(adb('exec-out','cat','/sdcard/announcement-closed.xml'))
    assert not {'VisitaLoja','Consultar disponibilidad','Cerrar'}.issubset({n.get('text','') for n in after.iter('node')}),'Entry announcement did not close'
    return True


def rect(node):
    return tuple(map(int, re.findall(r"\d+", node.attrib["bounds"])))


def find(tree, tag=None, text=None, desc=None):
    for node in tree.iter("node"):
        if tag and node.attrib.get("resource-id", "").split(":id/")[-1] == tag:
            return node
        if text is not None and node.attrib.get("text") == text:
            return node
        if desc is not None and node.attrib.get("content-desc") == desc:
            return node
    return None


def wait_for(predicate, seconds=40):
    deadline = time.monotonic() + seconds
    last = None
    while time.monotonic() < deadline:
        try:
            tree = hierarchy()
            value = predicate(tree)
            if value is not None and value is not False:
                return value
        except (subprocess.SubprocessError, ET.ParseError) as error:
            last = str(error)
        time.sleep(1)
    raise AssertionError("UI condition not reached: " + str(last))


def tap(node):
    left, top, right, bottom = rect(node)
    adb("shell", "input", "tap", str((left + right) // 2), str((top + bottom) // 2))


def text_inside(node):
    return " ".join(item.attrib.get("text", "") for item in node.iter()).strip()


def capture(name):
    image = adb("exec-out", "screencap", "-p", binary=True)
    (OUTPUT / (name + ".png")).write_bytes(image)
    tree = hierarchy()
    ET.ElementTree(tree).write(OUTPUT / (name + ".xml"), encoding="utf-8")
    width, height = struct.unpack(">II", image[16:24])
    return tree, width, height


def geometry(name, gps=False):
    tree, width, height = capture(name)
    canvas = find(tree, tag="map-canvas")
    assert canvas is not None, "Missing map canvas semantics"
    left, top, right, bottom = rect(canvas)
    ratio = (bottom - top) / height
    assert ratio >= (0.70 if height > width else 0.60), ("Map too small", name, ratio)
    control = find(tree, tag="map-location-control")
    assert control is not None, "GPS control missing"
    x1, y1, x2, y2 = rect(control)
    assert left <= x1 < x2 <= right and top <= y1 < y2 <= bottom, ("GPS control clipped", rect(control), rect(canvas))
    assert x2 - x1 >= 96 and y2 - y1 >= 96, ("GPS touch target clipped", rect(control))
    if gps:
        status = find(tree, tag="map-location-status")
        assert status is not None, "GPS indicator missing"
        assert rect(status)[3] - rect(status)[1] <= 112, ("GPS panel too tall", rect(status))
    checks.append({"screen": name, "size": [width, height], "map_ratio": round(ratio, 3), "gps_control": rect(control)})
    (OUTPUT / "progress.json").write_text(json.dumps({"checks": checks}, indent=2))
    return tree


def gps_updates():
    while not stop.wait(2):
        # A stable simulated outdoor fix in Loja; real hardware remains a separate test.
        try:
            adb("emu", "geo", "fix", "-79.20422", "-3.99313")
        except subprocess.SubprocessError:
            return


try:
    assert adb("shell", "getprop", "ro.kernel.qemu") == "1", "Only run on a disposable Android emulator"
    adb("shell", "cmd", "location", "set-location-enabled", "true")
    adb("emu", "geo", "fix", "-79.20422", "-3.99313")
    threading.Thread(target=gps_updates, daemon=True).start()
    adb("shell", "am", "start", "-n", PACKAGE + "/com.visitaloja.app.MainActivity")
    tap(wait_for(lambda tree: find(tree, text="Mapa")))
    wait_for(lambda tree: find(tree, tag="map-canvas"))
    time.sleep(4)
    initial = geometry("portrait-map")
    tap(wait_for(lambda tree: (node if (node := find(tree, tag="map-location-control")) is not None and node.attrib.get("enabled") == "true" else None), seconds=60))
    wait_for(lambda tree: find(tree, tag="map-location-status"))
    geometry("portrait-gps-search", gps=True)
    wait_for(lambda tree: (node if (node := find(tree, tag="map-location-status")) is not None and "Siguiendo" in text_inside(node) else None), seconds=70)
    active = geometry("portrait-gps-active", gps=True)
    zoom = find(active, desc="Acercar")
    assert zoom is not None
    tap(zoom)
    time.sleep(2)
    active = hierarchy()
    assert "Siguiendo" in text_inside(find(active, tag="map-location-status")), "Zoom must not stop following"
    canvas = rect(find(active, tag="map-canvas"))
    x = (canvas[0] + canvas[2]) // 2
    y = (canvas[1] + canvas[3]) // 2
    adb("shell", "input", "swipe", str(x), str(y), str(x + 140), str(y), "500")
    wait_for(lambda tree: (node if (node := find(tree, tag="map-location-status")) is not None and "Mi ubicación" in text_inside(node) else None))
    tree = hierarchy()
    tap(find(tree, tag="map-location-control"))
    wait_for(lambda tree: (node if (node := find(tree, tag="map-location-status")) is not None and "Siguiendo" in text_inside(node) else None))
    adb("shell", "cmd", "location", "set-location-enabled", "false")
    # Google Play Services may put a system warning above the app when GPS is disabled.
    # Dismiss its observed Close button so the activity can resume and show its own state.
    for _ in range(4):
        tree = hierarchy()
        if find(tree, text="No location access") is not None:
            close = find(tree, tag="button2")
            if close is not None:
                tap(close)
                break
        time.sleep(1)
    wait_for(lambda tree: (node if (node := find(tree, tag="map-location-status")) is not None and "Activar GPS" in text_inside(node) else None))
    geometry("portrait-gps-disabled", gps=True)
    adb("shell", "cmd", "location", "set-location-enabled", "true")
    wait_for(lambda tree: (node if (node := find(tree, tag="map-location-status")) is not None and "Siguiendo" in text_inside(node) else None), seconds=60)
    adb("shell", "settings", "put", "system", "accelerometer_rotation", "0")
    adb("shell", "settings", "put", "system", "user_rotation", "1")
    time.sleep(5)
    geometry("landscape-gps", gps=True)
    adb("shell", "settings", "put", "system", "user_rotation", "0")
    adb("shell", "settings", "put", "system", "font_scale", "1.3")
    time.sleep(5)
    geometry("portrait-large-text", gps=True)
    (OUTPUT / "summary.json").write_text(json.dumps({"ok": True, "checks": checks}, indent=2))
    print(json.dumps({"ok": True, "checks": checks}, ensure_ascii=False))
except BaseException:
    try:
        capture("failure")
        (OUTPUT / "logcat.txt").write_text(adb("logcat", "-d", "-t", "500"))
    except Exception:
        pass
    raise
finally:
    stop.set()
    adb("shell", "am", "force-stop", PACKAGE)
