#!/usr/bin/env python3
"""Cold-open the Android festival schedule, then follow its link to the principal map."""
import re
import subprocess
import time
import xml.etree.ElementTree as ET
from pathlib import Path

PKG = "com.visitaloja.app.preview"
OUT = Path("android/native/map-ui-results")
OUT.mkdir(parents=True, exist_ok=True)

def adb(*args):
    return subprocess.check_output(["adb", *args], timeout=30)

def wait_for(tag, text=None):
    deadline = time.monotonic() + 50
    while time.monotonic() < deadline:
        try:
            adb("shell", "rm", "-f", "/sdcard/fiavl-ui.xml")
            adb("shell", "uiautomator", "dump", "/sdcard/fiavl-ui.xml")
            root = ET.fromstring(adb("exec-out", "cat", "/sdcard/fiavl-ui.xml"))
            for node in root.iter("node"):
                if tag and node.get("resource-id", "").split(":id/")[-1] == tag or text and node.get("text") == text:
                    return node
        except (subprocess.CalledProcessError, ET.ParseError):
            pass
        time.sleep(0.5)
    raise AssertionError(f"Missing festival UI: {tag or text}")

adb("shell", "am", "force-stop", PKG)
try:
    adb("shell", "am", "start", "-n", PKG + "/com.visitaloja.app.MainActivity",
        "-a", "android.intent.action.VIEW", "-d", "https://www.visitaloja.com/programacion-fiavl-2026")
    wait_for("festival-agenda")
    wait_for("festival-event")
    node = wait_for(None, "Ver eventos en el mapa")
    x1, y1, x2, y2 = map(int, re.findall(r"\d+", node.get("bounds")))
    adb("shell", "input", "tap", str((x1+x2)//2), str((y1+y2)//2))
    wait_for("map-root")
    # Historical runs after the festival should keep the agenda and omit expired pins.
    if time.time() < 1795409999:
        wait_for("map-festival-toggle")
    (OUT / "festival-map.png").write_bytes(adb("exec-out", "screencap", "-p"))
except Exception:
    (OUT / "festival-failure.log").write_bytes(adb("logcat", "-d", "-b", "crash"))
    raise

finally:
    adb("shell", "am", "force-stop", PKG)
