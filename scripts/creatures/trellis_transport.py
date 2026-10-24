"""Gradio's public REST/SSE protocol: persist event IDs before collecting results."""
import json
import mimetypes
import struct
import time
from urllib.parse import quote, urljoin, urlsplit

from trellis_checkpoint import TerminalJobError, atomic_write

BASE_URL = 'https://microsoft-trellis-2.hf.space/'


def events(lines):
    kind, data = None, []
    for line in lines:
        if not line:
            if data:
                yield kind or 'message', json.loads('\n'.join(data))
            kind, data = None, []
        elif line.startswith('event:'):
            kind = line[6:].strip()
        elif line.startswith('data:'):
            data.append(line[5:].strip())


def job_error(output):
    message = str(output).lower()
    if any(word in message for word in ['quota', 'exceeded', 'gpu duration', 'rate limit']):
        return 'quota'
    if any(word in message for word in ['nonetype', 'state', 'session']):
        return 'session-unavailable'
    return 'provider-error'


def validate_glb(data):
    if len(data) < 20 or struct.unpack('<4sII', data[:12]) != (b'glTF', 2, len(data)):
        raise ValueError('Downloaded file is not a complete GLB v2')
    size, kind = struct.unpack('<II', data[12:20])
    if kind != 0x4e4f534a or size > len(data)-20:
        raise ValueError('Invalid GLB JSON chunk')
    json.loads(data[20:20+size])


class TrellisRemote:
    def __init__(self, session_hash, token=False, timeout=600):
        import httpx
        self.session_hash, self.timeout = session_hash, timeout
        self.client = httpx.Client(headers={'Authorization': 'Bearer '+token} if token else {},
                                   timeout=30, follow_redirects=False)
        try:
            response = self.client.get(urljoin(BASE_URL, 'gradio_api/info'))
            response.raise_for_status()
            self.info = response.json()['named_endpoints']
            response = self.client.get(urljoin(BASE_URL, 'config'))
            response.raise_for_status()
            config = response.json()
            self.components = {c['id']: c['type'] for c in config['components']}
            self.dependencies = {d['api_name']: d for d in config['dependencies'] if d.get('api_name')}
        except BaseException:
            self.client.close()
            raise

    def close(self):
        self.client.close()

    def contract(self):
        return {name: {'parameters': [{key: p.get(key) for key in ['parameter_name', 'parameter_has_default', 'parameter_default']}
                       for p in self.info['/'+name]['parameters']],
                       'inputTypes': [self.components[i] for i in self.dependencies[name]['inputs']],
                       'outputTypes': [self.components[i] for i in self.dependencies[name]['outputs']]}
                for name in ['start_session', 'preprocess_image', 'image_to_3d', 'extract_glb']}

    def payload(self, name, arguments):
        parameters = self.info['/'+name]['parameters']
        names = {p['parameter_name'] for p in parameters}
        if set(arguments)-names:
            raise ValueError('Provider API parameters changed: '+name)
        data = []
        for parameter in parameters:
            key = parameter['parameter_name']
            if key in arguments:
                data.append(arguments[key])
            elif parameter.get('parameter_has_default'):
                data.append(parameter['parameter_default'])
            else:
                raise ValueError('Missing provider parameter: '+key)
        dependency = self.dependencies[name]
        if sum(self.components[i] != 'state' for i in dependency['inputs']) != len(data):
            raise ValueError('Provider input component count changed')
        values = iter(data)
        full_data = [None if self.components[i] == 'state' else next(values) for i in dependency['inputs']]
        return {'data': full_data, 'fn_index': dependency['id'], 'session_hash': self.session_hash}

    def submit(self, name, arguments):
        payload = self.payload(name, arguments)
        print('Submit '+name, flush=True)
        response = self.client.post(urljoin(BASE_URL, 'gradio_api/queue/join'),
                                    json=payload)
        if response.status_code in [400, 401, 403, 404, 422, 429]:
            raise TerminalJobError('request-rejected')
        response.raise_for_status()
        return response.json()['event_id']

    def result(self, name, event_id):
        # GET reconnects only to the existing event. It cannot submit a GPU job.
        print('Collect '+name+' (existing event)', flush=True)
        url = urljoin(BASE_URL, 'gradio_api/queue/data?session_hash='+quote(self.session_hash, safe=''))
        start = time.monotonic()
        with self.client.stream('GET', url, timeout=35) as response:
            if response.status_code == 404:
                raise RuntimeError('Provider no longer has this event/session; generation was not restarted')
            response.raise_for_status()
            for kind, output in events(response.iter_lines()):
                if kind == 'message' and output.get('event_id') == event_id and output.get('msg') == 'process_completed':
                    if not output.get('success'):
                        raise TerminalJobError(job_error(output.get('output')))
                    values = output['output']['data']
                    indices = self.dependencies[name]['outputs']
                    if len(values) != len(indices):
                        raise ValueError('Provider output component count changed')
                    return [v for v, i in zip(values, indices) if self.components[i] != 'state']
                if time.monotonic()-start > self.timeout:
                    raise TimeoutError('Wait limit reached; resume the same output folder')
        raise RuntimeError('Event stream ended without a result; checkpoint preserved')

    def upload(self, image):
        with image.open('rb') as source:
            response = self.client.post(urljoin(BASE_URL, 'gradio_api/upload'),
                                        files={'files': (image.name, source, mimetypes.guess_type(image.name)[0] or 'application/octet-stream')})
        response.raise_for_status()
        return {'path': response.json()[0], 'meta': {'_type': 'gradio.FileData'}}

    def file_url(self, value):
        if isinstance(value, str):
            value = {'path': value, **({'url': value} if value.startswith('https://') else {})}
        if not isinstance(value, dict) or not value.get('path'):
            raise ValueError('Provider returned no file reference')
        url = urljoin(BASE_URL, value.get('url') or 'gradio_api/file='+quote(value['path'], safe='/'))
        expected, actual = urlsplit(BASE_URL), urlsplit(url)
        if (expected.scheme, expected.netloc) != (actual.scheme, actual.netloc) or not actual.path.startswith('/gradio_api/file='):
            raise ValueError('Refusing to send credentials to a different file origin')
        return url

    def download(self, reference, target, glb=False):
        # Keep the remote reference in a durable receipt before downloading.
        # A network failure here needs only a GET on the next run.
        with self.client.stream('GET', self.file_url(reference)) as response:
            response.raise_for_status()
            data = bytearray()
            for chunk in response.iter_bytes():
                data.extend(chunk)
                if len(data) > 256*1024*1024:
                    raise ValueError('Provider file exceeds 256 MiB')
        if glb:
            validate_glb(data)
        atomic_write(target, data)
