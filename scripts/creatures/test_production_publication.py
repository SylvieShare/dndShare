import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import production_stages


class PublicationResumeTests(unittest.TestCase):
    def test_new_publication_authenticates_after_cached_archives(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            folder=root/'wolf';final=folder/'final';final.mkdir(parents=True)
            (folder/'recipe.json').write_text(json.dumps({
                'referenceDiameter':.9,'materialProfile':'dielectric'}))
            (final/'model-review.json').write_text('{}')
            entry={'slug':'wolf','itemId':1692,'size':1,'height':.72,'lodTriangles':16000}
            queue=SimpleNamespace(root=root)
            publications=[]

            def stage(entry,name,inputs,action):
                if name!='published' or publications:return False
                outputs=action()
                self.assertEqual(outputs,[final/'publication.json'])
                publications.append(name)
                return True

            def execute(command,log,env):
                self.assertIn('--publish',command)
                self.assertEqual(env['MCP_AUTH_TOKEN'],'offline-test-credential')
                (final/'publication.json').write_text('{"verified":true}')

            queue.stage=stage
            with patch('production_stages.file_hash',return_value='hash'), \
                patch('production_stages.scripts_hash',return_value={}), \
                patch('production_stages.review_base',return_value=(root/'base.glb',{'referenceDiameter':.9,'surfaceHeight':.06})), \
                patch('production_stages.placement_context',return_value={}), \
                patch('production_stages.require_review',return_value={'approved':True}), \
                patch('production_stages.archive_stage',return_value=False) as archives, \
                patch('production_stages.execute',side_effect=execute) as runner, \
                patch('production_archives.configured_token',return_value='offline-test-credential') as credential:
                self.assertFalse(hasattr(queue,'mcp'))
                self.assertTrue(production_stages.process(queue,entry,'published',True))
                self.assertEqual(publications,['published'])
                credential.assert_called_once_with(True)
                runner.assert_called_once()
                # Model a fresh worker: cached publication must not authenticate
                # even without the client created by the first run.
                del queue.mcp
                self.assertFalse(production_stages.process(queue,entry,'published',True))
                self.assertFalse(hasattr(queue,'mcp'))
                credential.assert_called_once()
                runner.assert_called_once()
                self.assertEqual(archives.call_count,2)


if __name__=='__main__':unittest.main()
