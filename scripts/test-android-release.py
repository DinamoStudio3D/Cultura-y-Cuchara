#!/usr/bin/env python3
"""Configuration regressions with synthetic clients; no cloud access or real keys."""
import copy
import importlib.util
from pathlib import Path
import tempfile
import unittest
import xml.etree.ElementTree as ET
spec = importlib.util.spec_from_file_location('release_config', Path(__file__).resolve().parents[1] / 'android/prepare-release.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def fixture():
    return {'project_info': {'project_id': 'cultura-y-cuchara', 'project_number': '123'}, 'client': [
        {'client_info': {'android_client_info': {'package_name': 'com.visitaloja.app'}, 'mobilesdk_app_id': '1:123:android:synthetic'},
         'api_key': [{'current_key': 'synthetic&public<key'}], 'oauth_client': [{'client_type': 3, 'client_id': 'synthetic.apps.googleusercontent.com'}]}]}


class ReleaseConfigTest(unittest.TestCase):
    def test_selects_production_client_even_with_preview_first(self):
        config = fixture()
        preview = copy.deepcopy(config['client'][0])
        preview['client_info']['android_client_info']['package_name'] += '.preview'
        preview['api_key'][0]['current_key'] = 'preview-key'
        config['client'].insert(0, preview)
        self.assertEqual('synthetic&public<key', module.resources(config)['google_api_key'])

    def test_rejects_other_project_preview_only_and_missing_oauth(self):
        for mutate in [lambda c: c['project_info'].update(project_id='other'),
                       lambda c: c['client'][0]['client_info']['android_client_info'].update(package_name='com.visitaloja.app.preview'),
                       lambda c: c['client'][0].update(oauth_client=[]),
                       lambda c: c['client'][0]['client_info'].update(mobilesdk_app_id='1:999:android:other')]:
            config = fixture(); mutate(config)
            with self.assertRaises(ValueError): module.resources(config)

    def test_escapes_xml_and_invalid_input_preserves_existing_output(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / 'firebase.xml'
            module.write_resources(fixture(), path)
            self.assertEqual('synthetic&public<key', ET.parse(path).find("string[@name='google_api_key']").text)
            previous = path.read_bytes()
            with self.assertRaises(ValueError): module.write_resources({}, path)
            self.assertEqual(previous, path.read_bytes())


if __name__ == '__main__': unittest.main()
