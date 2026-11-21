#!/usr/bin/env python3
"""Create Android release resources from the owner's Firebase public client config.
Never creates accounts, credentials, signing keys or production data.
"""
import argparse
import json
from pathlib import Path
import xml.etree.ElementTree as ET

PACKAGE = 'com.visitaloja.app'
PROJECT = 'cultura-y-cuchara'


def resources(config):
    project = config.get('project_info', {})
    if project.get('project_id') != PROJECT:
        raise ValueError('El archivo debe pertenecer al proyecto Firebase cultura-y-cuchara.')
    clients = [c for c in config.get('client', []) if c.get('client_info', {}).get('android_client_info', {}).get('package_name') == PACKAGE]
    if len(clients) != 1:
        raise ValueError('Registra com.visitaloja.app en Firebase y descarga su google-services.json; el cliente .preview no sirve para producción.')
    client = clients[0]
    oauth = client.get('oauth_client', []) + client.get('services', {}).get('appinvite_service', {}).get('other_platform_oauth_client', [])
    web = list(dict.fromkeys(c.get('client_id') for c in oauth if c.get('client_type') == 3 and c.get('client_id')))
    if len(web) != 1:
        raise ValueError('La configuración debe incluir un único cliente OAuth web para el acceso con Google.')
    keys = [row.get('current_key') for row in client.get('api_key', []) if row.get('current_key')]
    values = {
        'google_app_id': client.get('client_info', {}).get('mobilesdk_app_id'),
        'google_api_key': keys[0] if len(keys) == 1 else None,
        'project_id': project.get('project_id'),
        'gcm_defaultSenderId': project.get('project_number'),
        'default_web_client_id': web[0],
        'visitaloja_firebase_package': PACKAGE,
    }
    if not all(isinstance(value, str) and value.strip() for value in values.values()):
        raise ValueError('Faltan valores públicos de Firebase. Descarga de nuevo la configuración completa.')
    if not values['google_app_id'].startswith('1:' + values['gcm_defaultSenderId'] + ':android:'):
        raise ValueError('El identificador de la app no coincide con el proyecto de Firebase.')
    if project.get('storage_bucket'):
        values['google_storage_bucket'] = project['storage_bucket']
    return values


def write_resources(config, destination):
    values = resources(config)  # Validate before touching an existing file.
    root = ET.Element('resources')
    for key, value in values.items():
        ET.SubElement(root, 'string', {'name': key, 'translatable': 'false'}).text = value
    ET.indent(root, space='    ')
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix('.xml.tmp')
    ET.ElementTree(root).write(temporary, encoding='utf-8', xml_declaration=True)
    temporary.replace(destination)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('google_services', type=Path)
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parent / 'native/app/src/release/res/values/firebase.xml')
    args = parser.parse_args()
    try:
        config = json.loads(args.google_services.read_text())
        write_resources(config, args.output)
    except (ValueError, OSError) as error:
        parser.exit(1, str(error) + '\n')
    print('Configuración pública de producción preparada para com.visitaloja.app. Falta validar acceso Google, FCM y la firma definitiva en dispositivo.')


if __name__ == '__main__':
    main()
