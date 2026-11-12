"""Register a native HTTP MCP connection without copying credentials into TOML."""
import argparse
import json
import os
import re
from pathlib import Path
import shutil
import sys
import time
import tomllib

SERVER = 'dndshare_reports'
TOOLS = ['error_reports_list', 'error_report_get', 'error_report_screenshot',
         'error_report_lock_acquire', 'error_report_lock_renew', 'error_report_lock_release',
         'error_reports_claim', 'error_report_title_set', 'error_report_question_create',
         'error_report_serious_change_request', 'error_report_resolve', 'error_report_phase_set']


def configure(destination, dispatcher_config, python_executable, helper):
    destination = Path(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    raw = destination.read_text(encoding='utf-8-sig') if destination.exists() else ''
    parsed = tomllib.loads(raw)
    settings = json.loads(Path(dispatcher_config).read_text(encoding='utf-8-sig'))
    command = ' '.join(json.dumps(str(part).replace('\\', '/'), ensure_ascii=False)
                       for part in [python_executable, '-X', 'utf8', helper, '--config', dispatcher_config])
    existing = parsed.get('mcp_servers', {}).get(SERVER)
    expected = {'url': settings['baseUrl'].rstrip('/') + '/mcp', 'http_headers_helper': command,
                'enabled_tools': TOOLS, 'enabled': True, 'startup_timeout_sec': 20,
                'tool_timeout_sec': 60, 'default_tools_approval_mode': 'auto'}
    if existing is not None:
        previous = dict(expected, enabled_tools=TOOLS[:-1])
        if existing == expected:
            return False
        if existing != previous:
            raise ValueError('An MCP entry with this name already has different settings; preserve it for review')
    addition = '\n\n[mcp_servers.' + SERVER + ']\n'
    for key, value in expected.items():
        addition += key + ' = ' + json.dumps(value, ensure_ascii=False) + '\n'
    if existing is not None:
        pattern = r'(?ms)^\[mcp_servers\.dndshare_reports\]\s*\n.*?(?=^\[|\Z)'
        updated, count = re.subn(pattern, lambda _: addition.lstrip(), raw)
        if count != 1: raise ValueError('The managed MCP section could not be identified')
    else:
        updated = raw.rstrip() + addition
    tomllib.loads(updated)
    if destination.exists():
        shutil.copy2(destination, destination.with_name(destination.name + '.before-dndshare-' + str(time.time_ns()) + '.bak'))
    temporary = destination.with_name(destination.name + '.dndshare.tmp')
    temporary.write_text(updated, encoding='utf-8')
    os.replace(temporary, destination)
    return True


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--codex-config', required=True)
    parser.add_argument('--dispatcher-config', required=True)
    parser.add_argument('--helper', required=True)
    args = parser.parse_args()
    changed = configure(args.codex_config, args.dispatcher_config, sys.executable, args.helper)
    print(json.dumps({'server': SERVER, 'configured': True, 'changed': changed}))
