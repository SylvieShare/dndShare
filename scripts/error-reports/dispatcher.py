"""Keep one outbound stream open and queue each event into one local Codex chat."""
import argparse
import hashlib
import json
import logging
from logging.handlers import RotatingFileHandler
import os
from pathlib import Path
import re
import secrets
import shutil
import socket
import subprocess
import time
import urllib.error

from state import State, singleton, write_json
from transport import Client, ProtocolError, load_config

AGENT_PROCEDURE = 'md/features/error-report-agent.md'

def resolve_codex(config):
    configured = config.get('codexExecutable')
    if configured and Path(configured).is_file(): return configured
    found = shutil.which('codex')
    if found: return found
    # Desktop updates may replace the versioned package directory.
    command = "Get-AppxPackage -Name OpenAI.Codex | Select-Object -First 1 -ExpandProperty InstallLocation"
    result = subprocess.run(['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', command],
                            capture_output=True, text=True, timeout=15, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    path = Path(result.stdout.strip()) / 'app/resources/codex.exe'
    if path.is_file(): return str(path)
    raise RuntimeError('Codex CLI is unavailable')


def message_for(event, config):
    labels = {'created': 'Новый багрепорт', 'approved': 'Одобрена обработка багрепорта',
              'answered': 'Получен ответ на вопрос по багрепорту', 'reopened': 'Багрепорт возвращён в работу',
              'serious-approved': 'Подтверждено изменение по багрепорту', 'recovered': 'Восстановлен прерванный багрепорт'}
    key = event_key(event)
    procedure = config.get('agentProcedure', AGENT_PROCEDURE)
    approval = 'Обработка одобрена.' if event['approved'] else 'Заявка пока ожидает одобрения ADMIN.'
    return (f"{labels[event['kind']]} №{event['reportId']}. {approval}\n"
            f"Событие: {key}.\n"
            f"Проверь актуальный статус и обработай по {procedure} из origin/main.")


def event_key(event):
    # Bootstrap and the live 'created' event share this key, even across restarts.
    return f"created:{event['reportId']}" if event['kind'] == 'created' else f"event:{event['id']}"


def enqueue(event, config):
    command = [resolve_codex(config), 'queue', '--thread', config['threadId'],
               '--message', message_for(event, config), '--resume']
    env = dict(os.environ, CODEX_HOME=config['codexHome'])
    endpoint = config.get('_resume_endpoint')
    if endpoint:
        command.extend(['--remote', endpoint, '--remote-auth-token-env', 'SHARE_REPORT_RESUME_TOKEN'])
        env['SHARE_REPORT_RESUME_TOKEN'] = config['_resume_token']
    else:
        command.extend(['-C', config['projectDirectory']])
    result = subprocess.run(command,
                            capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=30,
                            env=env,
                            creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    accepted = re.search(r'Queued message ([a-f0-9-]{36}) for thread ([a-f0-9-]{36})\.', result.stdout)
    if result.returncode or not accepted or accepted[2] != config['threadId']:
        raise RuntimeError('Codex did not confirm message queueing')
    if endpoint and 'could not resume thread' in result.stderr:
        raise RuntimeError('Private Codex server did not resume the chat')
    return accepted[1]


def start_private_server(config):
    # The app uses this socket only on the owner's machine. The token is
    # ephemeral, and the child receives its hash rather than the secret.
    with socket.socket() as probe:
        probe.bind(('127.0.0.1', 0))
        address = probe.getsockname()
    endpoint = f'ws://127.0.0.1:{address[1]}'
    token = secrets.token_urlsafe(32)
    process = subprocess.Popen([
        resolve_codex(config), 'app-server', '--listen', endpoint,
        '--ws-auth', 'capability-token', '--ws-token-sha256',
        hashlib.sha256(token.encode()).hexdigest(),
    ], cwd=config['projectDirectory'], env=dict(os.environ, CODEX_HOME=config['codexHome']),
        stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    try:
        deadline = time.monotonic() + 12
        while time.monotonic() < deadline and process.poll() is None:
            try:
                with socket.create_connection(address, timeout=.3):
                    return process, dict(config, _resume_endpoint=endpoint, _resume_token=token)
            except OSError:
                time.sleep(.1)
        raise RuntimeError('Private Codex server did not become ready')
    except BaseException:
        terminate_server(process)
        raise


def terminate_server(process):
    if process is None or process.poll() is not None:
        return
    process.terminate()
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=5)


def deliver(state, event, config, queue=enqueue):
    key = event_key(event)
    cursor = event.get('id')
    if state.delivered(key):
        state.acknowledge(key, event['reportId'], '', cursor)
        return False
    message_id = queue(event, config)
    state.acknowledge(key, event['reportId'], message_id, cursor)
    logging.info('queued report=%s kind=%s message=%s', event['reportId'], event['kind'], message_id)
    return True


def bootstrap(state, client, config):
    offset = 0
    while True:
        result = client.value('error_reports_list', {'limit': 500, 'offset': offset, 'compact': True})
        reports = result['reports']
        for report in reversed(reports):
            deliver(state, {'kind': 'created', 'reportId': report['id'], 'approved': True}, config)
        if len(reports) < 500: break
        offset += 500


def run(config):
    directory = Path(config['stateDirectory'])
    directory.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s',
                        handlers=[RotatingFileHandler(directory / 'worker.log', maxBytes=1048576, backupCount=2, encoding='utf-8')])
    with singleton(directory):
        state = State(directory)
        client = Client(config)
        delay = 1
        runtime = config
        server = None

        def connected():
            status = {'status': 'connected', 'pid': os.getpid(), 'cursor': state.cursor, 'time': time.time()}
            if server is not None:
                status['resumeServerPid'] = server.pid
            write_json(directory / 'health.json', status)

        try:
            while True:
                try:
                    if config.get('privateAppServer') and (server is None or server.poll() is not None):
                        server, runtime = start_private_server(config)
                    bootstrap(state, client, runtime)
                    connected()
                    logging.info('connected cursor=%s', state.cursor)
                    last_probe = time.monotonic()
                    for event in client.events(state.cursor):
                        if server is not None and server.poll() is not None:
                            raise RuntimeError('Private Codex server exited')
                        if event is not None: deliver(state, event, runtime)
                        # Queue reads recover expired claims; the DB trigger emits their event.
                        if time.monotonic() - last_probe >= 30:
                            client.value('error_reports_list', {'summaryOnly': True})
                            last_probe = time.monotonic()
                        connected()
                        delay = 1
                except (OSError, ValueError, RuntimeError, KeyError, ProtocolError) as error:
                    code = error.code if isinstance(error, urllib.error.HTTPError) else None
                    logging.warning('reconnecting type=%s http=%s', type(error).__name__, code)
                    write_json(directory / 'health.json', {'status': 'reconnecting', 'pid': os.getpid(), 'errorType': type(error).__name__, 'httpStatus': code, 'cursor': state.cursor, 'time': time.time()})
                except Exception as error:
                    # No traceback: protocol payloads and credentials must not reach logs.
                    logging.error('reconnecting type=%s', type(error).__name__)
                time.sleep(delay)
                delay = min(15, delay * 2)
        finally:
            terminate_server(server)
            state.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', required=True)
    arguments = parser.parse_args()
    run(load_config(arguments.config))
