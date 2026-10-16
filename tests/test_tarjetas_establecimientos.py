#!/usr/bin/env python3
"""Comprobaciones estaticas de regresion de tarjetas publicas.
Ejecutar desde cualquier directorio: python3 tests/test_tarjetas_establecimientos.py
No sustituye pruebas visuales en navegadores.
"""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
CSS = (ROOT / "css/discovery-cards.css").read_text(encoding="utf-8")
HTML = (ROOT / "index.html").read_text(encoding="utf-8")


class TarjetasEstablecimientos(unittest.TestCase):
    def test_directorio_existe(self):
        self.assertRegex(HTML, r'id=["\']localesGrid["\']')
        self.assertRegex(HTML, r'id=["\']establecimientos["\']')

    def test_estilos_cargados_con_version(self):
        self.assertRegex(HTML, r'css/discovery-cards\.css\?v=\d+')

    def test_una_tarjeta_no_se_extiende_indefinidamente(self):
        self.assertRegex(CSS, r'#establecimientos\s+#localesGrid\s*>\s*\.local-item:not\(\.hidden-item\)\s*\{[^}]*max-width:\s*400px\s*!important', re.S)
        self.assertIn('justify-self:start!important', CSS)

    def test_movil_no_impone_400px(self):
        self.assertRegex(CSS, r'@media\(max-width:639px\)\s*\{\s*#establecimientos\s+#localesGrid\s*>\s*\.local-item:not\(\.hidden-item\)\s*\{max-width:100%\s*!important', re.S)

    def test_tablet_dos_columnas(self):
        self.assertIn('@media(min-width:640px) and (max-width:1023px)', CSS)
        self.assertIn('grid-template-columns:repeat(2,minmax(0,1fr))!important', CSS)

    def test_imagenes_y_logos_tienen_ajustes_distintos(self):
        self.assertIn('object-fit:var(--vl-card-image-fit,cover)!important', CSS)
        self.assertIn('.vl17-media.vl17-partner-media > img{object-fit:contain!important', CSS)

    def test_textos_y_acciones_responsivos(self):
        self.assertIn('overflow-wrap:anywhere', CSS)
        self.assertIn('.vl18-quicklinks', CSS)
        self.assertIn('min-height:44px', CSS)


if __name__ == "__main__":
    unittest.main()
