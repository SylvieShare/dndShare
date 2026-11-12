"""Select the repository's pinned Windows Node for direct test commands."""
import os
from pathlib import Path


def project_environment(root, base=None):
    env = dict(os.environ if base is None else base)
    if os.name == 'nt':
        version = (Path(root)/'.node-version').read_text(encoding='utf8').strip()
        directory = Path('C:/Tools/NodeJS')/f'node-v{version}-win-x64'
        if not (directory/'node.exe').is_file():
            raise RuntimeError(f'Install pinned Node {version} in {directory}')
        env['PATH'] = str(directory)+os.pathsep+env.get('PATH','')
    return env
