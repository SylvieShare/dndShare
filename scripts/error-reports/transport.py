"""Authenticated MCP/SSE transport. Credentials never enter command arguments."""
import json
from pathlib import Path
import urllib.error
import urllib.parse
import urllib.request

KINDS = {'created', 'approved', 'answered', 'reopened', 'serious-approved', 'recovered'}


class ProtocolError(Exception):
    pass


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        raise ProtocolError('Unexpected HTTP redirect')


def load_config(path):
    data = json.loads(Path(path).read_text(encoding='utf-8-sig'))
    if data.get('version') != 1: raise ValueError('Unsupported dispatcher configuration')
    import uuid
    uuid.UUID(data['threadId'])
    url = urllib.parse.urlsplit(data['baseUrl'])
    local = url.scheme == 'http' and url.hostname in {'127.0.0.1', 'localhost'}
    if not url.hostname or (url.scheme != 'https' and not local) or url.username or url.password or url.query or url.fragment:
        raise ValueError('Use HTTPS or an isolated loopback test server')
    data['baseUrl'] = data['baseUrl'].rstrip('/')
    return data


def read_token(config):
    for line in Path(config['tokenEnvFile']).read_text(encoding='utf-8-sig').splitlines():
        key, separator, value = line.strip().partition('=')
        if separator and key.removeprefix('export ').strip() == 'MCP_AUTH_TOKEN':
            value = value.strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
                value = value[1:-1]
            if value and '\r' not in value and '\n' not in value:
                return value
    raise ProtocolError('MCP credential is unavailable')


class Client:
    def __init__(self, config):
        self.config = config
        self.opener = urllib.request.build_opener(NoRedirect())

    def open(self, path, data=None, accept='application/json'):
        headers = {'Authorization': 'Bearer ' + read_token(self.config), 'Accept': accept}
        if data is not None:
            headers['Content-Type'] = 'application/json'
            data = json.dumps(data, ensure_ascii=False).encode('utf-8')
        request = urllib.request.Request(self.config['baseUrl'] + path, data=data, headers=headers)
        return self.opener.open(request, timeout=40)

    def call(self, name, arguments=None):
        body = {'jsonrpc': '2.0', 'id': 1, 'method': 'tools/call',
                'params': {'name': name, 'arguments': arguments or {}}}
        with self.open('/mcp', body) as response:
            envelope = json.load(response)
        if envelope.get('error'):
            raise ProtocolError('MCP protocol rejected the request')
        result = envelope.get('result', {})
        if result.get('isError'):
            # Transport errors must not dump request headers or capability handles.
            raise ProtocolError('MCP operation failed: ' + name)
        return result

    def value(self, name, arguments=None):
        result = self.call(name, arguments)
        structured = result.get('structuredContent')
        if isinstance(structured, dict) and 'result' in structured:
            return structured['result']
        content = result.get('content', [])
        if len(content) == 1 and content[0].get('type') == 'text':
            return json.loads(content[0]['text'])
        raise ProtocolError('Expected a structured MCP result')

    def events(self, cursor):
        with self.open('/mcp/error-report-events?after=' + str(cursor), accept='text/event-stream') as response:
            if response.headers.get_content_type() != 'text/event-stream':
                raise ProtocolError('Expected an event stream')
            yield from parse_events(response)


def parse_events(lines):
    event_id, event_type, data = None, None, []
    size = 0
    for raw in lines:
        size += len(raw)
        if size > 65536:
            raise ProtocolError('Event frame is too large')
        line = raw.decode('utf-8').rstrip('\r\n')
        if not line:
            if data:
                event = json.loads('\n'.join(data))
                if event_type != 'error-report' or event.get('kind') not in KINDS:
                    raise ProtocolError('Unexpected event type')
                for key in ('id', 'reportId'):
                    if type(event.get(key)) is not int or event[key] <= 0:
                        raise ProtocolError('Invalid event identifier')
                if event_id != str(event['id']) or type(event.get('approved')) is not bool:
                    raise ProtocolError('Invalid event metadata')
                yield event
            else:
                yield None  # Heartbeats also allow the worker to check expired claims.
            event_id, event_type, data, size = None, None, [], 0
            continue
        field, _, value = line.partition(':')
        value = value.removeprefix(' ')
        if field == 'id': event_id = value
        elif field == 'event': event_type = value
        elif field == 'data': data.append(value)
