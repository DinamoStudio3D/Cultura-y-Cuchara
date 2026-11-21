#!/usr/bin/env python3
"""Sign a CI APK with the owner's stable preview key, kept outside git.

Usage: python3 android/sign-preview.py INPUT.apk OUTPUT.apk PRIVATE_BACKUP.zip APKSIGNER.jar
The backup must be recovered from the existing private VisitaLoja preview signing backup.
Never create a new key to sign an update of an already distributed package.
"""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import zipfile


def main():
    if len(sys.argv) != 5:
        raise SystemExit(__doc__)
    source, output, backup, signer = [Path(p).resolve() for p in sys.argv[1:]]
    if source == output:
        raise SystemExit("Use a separate output path; retain the original CI artifact.")
    with zipfile.ZipFile(backup) as archive, tempfile.TemporaryDirectory(prefix="vl-sign-") as directory:
        private = Path(directory)
        config = json.loads(archive.read("signing.json"))
        key = private / "preview.p12"
        key.write_bytes(archive.read("visitaloja-preview.p12"))
        key.chmod(0o600)
        certificate = archive.read("preview-certificate.der")
        environment = dict(os.environ, VISITALOJA_PREVIEW_SIGN_PASSWORD=config["password"])
        subprocess.run(["java", "-jar", str(signer), "sign", "--ks", str(key), "--ks-key-alias", config["alias"],
            "--ks-pass", "env:VISITALOJA_PREVIEW_SIGN_PASSWORD", "--key-pass", "env:VISITALOJA_PREVIEW_SIGN_PASSWORD",
            "--out", str(output), str(source)], env=environment, check=True)
        result = subprocess.run(["java", "-jar", str(signer), "verify", "--verbose", "--print-certs", str(output)],
            check=True, capture_output=True, text=True)
        expected = hashlib.sha256(certificate).hexdigest()
        if f"certificate SHA-256 digest: {expected}" not in result.stdout:
            output.unlink(missing_ok=True)
            raise SystemExit("Unexpected signing certificate. Output removed.")
        print(result.stdout)
        print("APK SHA-256:", hashlib.sha256(output.read_bytes()).hexdigest())


if __name__ == "__main__":
    main()
