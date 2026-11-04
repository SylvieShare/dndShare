import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';

export const wikiPath = (root, name) => path.join(root, '.contextshare/wiki', name);

export function writeWikiDocument(root, name, previous, content) {
  const command = process.env.CONTEXTSHARE_BIN || 'contextshare';
  const request = { path: name, content };
  if (previous !== undefined)
    request.expected_sha256 = createHash('sha256').update(previous, 'utf8').digest('hex');

  return new Promise((resolve, reject) => {
    const child = spawn(command, ['local', '--project', root, 'wiki', 'write'],
      { cwd: root, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '', diagnostics = '';
    child.stdout.setEncoding('utf8').on('data', chunk => { output += chunk; });
    child.stderr.setEncoding('utf8').on('data', chunk => { diagnostics += chunk; });
    child.once('error', error => reject(new Error('Configure CONTEXTSHARE_BIN for wiki writes', { cause: error })));
    child.stdin.on('error', reject);
    child.once('close', code => {
      if (code !== 0) {
        reject(new Error(diagnostics.trim() || 'ContextShare rejected the wiki write'));
        return;
      }
      try {
        resolve(JSON.parse(output));
      } catch (error) {
        reject(error);
      }
    });
    child.stdin.end(JSON.stringify(request));
  });
}
