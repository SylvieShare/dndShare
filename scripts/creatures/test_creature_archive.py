import gzip
import hashlib
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch

from creature_archive import pack_archive, restore_archive


class SourceArchiveTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name)
        self.files={'recipe.json':b'{"itemId":1692,"modelId":"c0000000-0000-4000-8000-000000000001"}',
            'inputs/miniature-reference.png':b'image','native/generated-original.glb':b'native mesh'}

    def fixture(self,mutate=lambda m,f:None,link=False):
        files=dict(self.files)
        manifest={'schema':1,'itemId':1692,'modelId':'c0000000-0000-4000-8000-000000000001','stage':'native',
            'files':[{'path':n,'size':len(d),'sha256':hashlib.sha256(d).hexdigest()} for n,d in files.items()]}
        mutate(manifest,files)
        output=self.root/'source.tar.gz'
        with tarfile.open(output,'w:gz',format=tarfile.USTAR_FORMAT) as archive:
            data=json.dumps(manifest).encode(); header=tarfile.TarInfo('archive-manifest.json'); header.size=len(data)
            archive.addfile(header,io.BytesIO(data))
            for name,data in files.items():
                header=tarfile.TarInfo(name); header.size=len(data)
                if link: header.type=tarfile.SYMTYPE; header.linkname='/outside'; header.size=0
                archive.addfile(header,None if link else io.BytesIO(data))
        return output

    def test_restore_validates_and_restores_exact_sources(self):
        destination=self.root/'restored'
        manifest=restore_archive(self.fixture(),destination)
        self.assertEqual(manifest['itemId'],1692)
        for name,data in self.files.items(): self.assertEqual((destination/name).read_bytes(),data)
        with self.assertRaisesRegex(ValueError,'must not exist'): restore_archive(self.root/'source.tar.gz',destination)

    def test_restore_failure_leaves_no_partial_directory(self):
        cases=[lambda m,f:f.update({'unlisted.txt':b'no'}),
            lambda m,f:f.update({'recipe.json':b'changed'}),
            lambda m,f:m['files'].append(m['files'][0]),
            lambda m,f:m['files'][0].update(path='../outside.txt'),
            lambda m,f:f.pop('native/generated-original.glb')]
        for mutate in cases:
            with self.subTest(mutate=mutate), self.assertRaises(ValueError):
                restore_archive(self.fixture(mutate),self.root/'bad')
            self.assertFalse((self.root/'bad').exists())
            self.assertEqual(list(self.root.glob('.miniature-restore-*')),[])
        with self.assertRaises(ValueError): restore_archive(self.fixture(link=True),self.root/'bad')

    def test_pack_is_deterministic_and_only_includes_explicit_sources(self):
        folder=self.root/'wolf'; folder.mkdir()
        inputs={}
        for name,data in self.files.items():
            p=folder/name; p.parent.mkdir(parents=True,exist_ok=True); p.write_bytes(data); inputs[name]=p
        (folder/'secret.env').write_text('must stay local')
        (folder/'trellis-checkpoint.json').write_text('{"session":"private"}')
        with patch('creature_archive.archive_inputs',return_value=inputs),patch('creature_archive.subprocess.check_output',return_value='commit\n'),patch('creature_archive.subprocess.run') as git:
            git.return_value.returncode=0
            file,descriptor=pack_archive(folder,'native')
            data=file.read_bytes()
            self.assertEqual(pack_archive(folder,'native')[0].read_bytes(),data)
        self.assertEqual(json.loads(descriptor.read_text())['sha256'],hashlib.sha256(data).hexdigest())
        with tarfile.open(file) as archive:
            self.assertEqual(set(archive.getnames()),set(self.files)|{'archive-manifest.json'})
        restore_archive(file,self.root/'restored')


if __name__=='__main__': unittest.main()
