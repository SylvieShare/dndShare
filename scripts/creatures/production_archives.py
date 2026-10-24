"""Queue archive stages shared by native-only and full production runs."""
from creature_archive import archive_inputs, pack_archive, publish_archive
from miniature_mcp import MiniatureMCP, configured_token
from model_build_queue import file_hash


class NativeArchiveStop(RuntimeError):
    pass


def archive_stage(queue, entry, stage_name, server_token):
    folder = queue.root/entry['slug']
    inputs = {name:file_hash(path) for name,path in archive_inputs(folder,stage_name).items()}
    changed = queue.stage(entry,'archive-'+stage_name,inputs,lambda:pack_archive(folder,stage_name))
    if server_token:
        def upload():
            if not hasattr(queue,'mcp'):
                queue.mcp = MiniatureMCP(configured_token(True))
            return [publish_archive(folder,stage_name,queue.mcp)]
        changed |= queue.stage(entry,'archive-'+stage_name+'-published',
            {'descriptor':file_hash(folder/'archives'/(stage_name+'-archive.json'))},upload)
    return changed


def archive_native(queue, entry, server_token):
    try:
        return archive_stage(queue,entry,'native',server_token)
    except Exception as error:
        # Do not accumulate more paid generations while source backup is broken.
        raise NativeArchiveStop('Native backup failed; batch stopped before the next model') from error
