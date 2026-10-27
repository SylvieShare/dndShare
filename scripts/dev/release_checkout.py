"""One clean release checkout; ignored compiler outputs survive commit switches."""
from contextlib import contextmanager
from pathlib import Path
import shutil

from .common import UIError, capture
from .dependencies import check_packages, link_modules
from .runner import lock


def primary_repository(source):
    return Path(capture(['git', 'rev-parse', '--path-format=absolute', '--git-common-dir'], cwd=source)).parent


def require_clean(checkout):
    if capture(['git', 'status', '--porcelain', '--untracked-files=all'], cwd=checkout):
        raise UIError('Release checkout has source changes; preserve them before retrying: ' + str(checkout))


@contextmanager
def prepared_release(source, commit):
    primary = primary_repository(source)
    sha = capture(['git', 'rev-parse', '--verify', commit + '^{commit}'], cwd=source)
    with lock(primary / '.git/ui-locks/release.lock'):
        checkout = primary / 'build/ui-release/current'
        if not checkout.exists():
            checkout.parent.mkdir(parents=True, exist_ok=True)
            capture(['git', 'clone', '--shared', '--no-checkout', str(primary), str(checkout)], timeout=120)
        else:
            require_clean(checkout)
        capture(['git', 'fetch', str(primary), sha], cwd=checkout, timeout=120)
        capture(['git', '-c', 'core.autocrlf=false', 'checkout', '--detach', sha], cwd=checkout, timeout=120)
        require_clean(checkout)
        if capture(['git', 'rev-parse', 'HEAD'], cwd=checkout) != sha:
            raise UIError('Release commit does not match the requested revision')
        try:
            yield checkout, sha, primary
        finally:
            require_clean(checkout)


def ensure_web_dependencies(checkout, config):
    modules = Path(config['node_modules'])
    check_packages(checkout, modules)
    destination = checkout / 'frontend/node_modules'
    if destination.exists():
        try:
            check_packages(checkout, destination)
            return
        except UIError:
            if destination.is_symlink():
                destination.unlink()
            else:
                shutil.rmtree(destination)
    hot = checkout / 'build/vite-cache'
    hot.mkdir(parents=True, exist_ok=True)
    link_modules(modules, destination, hot)
