"""Credential helper consumed privately by Codex's native HTTP MCP client."""
import argparse
import json
import sys

from transport import load_config, read_token


def headers(config):
    return {'Authorization': 'Bearer ' + read_token(config)}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', required=True)
    args = parser.parse_args()
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        print(json.dumps(headers(load_config(args.config))))
    except Exception:
        print('MCP credential is unavailable', file=sys.stderr)
        sys.exit(1)
