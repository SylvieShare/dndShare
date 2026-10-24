"""Project MCP access with credentials kept in process memory."""
import json
import os
from pathlib import Path
import shlex
import subprocess
import urllib.request


def configured_token(server_token=False):
    token = os.environ.get('MCP_AUTH_TOKEN')
    if not token and server_token:
        code = "import pathlib,shlex; v=[l.partition('=')[2] for l in pathlib.Path.home().joinpath('dndshare.env').read_text().splitlines() if l.startswith('MCP_AUTH_TOKEN=')]; assert len(v)==1; print(shlex.split(v[0])[0])"
        token = subprocess.check_output(['ssh','-i',str(Path.home()/'.ssh/dndshare'),
            'sylvieshare@72.56.16.183','python3 -c '+shlex.quote(code)],text=True).strip()
    if not token:
        raise RuntimeError('Configured project MCP token required')
    return token


class MiniatureMCP:
    def __init__(self,token):
        self.token = token

    def call(self,name,arguments):
        payload = json.dumps({'jsonrpc':'2.0','id':1,'method':'tools/call',
            'params':{'name':name,'arguments':arguments}}).encode()
        request = urllib.request.Request('https://dndshare.ru/mcp',data=payload,
            headers={'Content-Type':'application/json','Authorization':'Bearer '+self.token})
        with urllib.request.urlopen(request,timeout=300) as response:
            value = json.load(response)
        if value.get('error') or value.get('result',{}).get('isError'):
            raise RuntimeError('MCP operation failed: '+name)
        return value['result']['structuredContent']['result']
