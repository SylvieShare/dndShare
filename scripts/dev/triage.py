"""Explain failures without relaxing exit codes or rewriting raw reports."""
import json
from pathlib import Path


def classify(file, title, project, registry=None):
    registry = registry or Path(__file__).with_name('known-failures.json')
    for entry in json.loads(Path(registry).read_text())['entries']:
        if (entry['file'], entry['title'], entry['project']) == (file, title, project):
            return dict(entry, known=True, passes=False)
    return dict(known=False, passes=False)


def repeated_failure(directory, signature):
    """Two consecutive matching failures call for a minimal repro, not a broad rerun."""
    rows = []
    for path in sorted(Path(directory).glob('*/receipt.json'), reverse=True):
        row = json.loads(path.read_text())
        failed = [s for s in row.get('stages', []) if s.get('status') == 'failed']
        if failed:
            rows.append(failed[-1].get('signature'))
        if len(rows) == 2:
            break
    return rows == [signature, signature]


def browser_failures(report):
    failures = []
    def visit(suites, inherited_file=''):
        for suite in suites:
            file = suite.get('file', inherited_file)
            for spec in suite.get('specs', []):
                for test in spec.get('tests', []):
                    if test.get('status') == 'unexpected':
                        path = spec.get('file', file).replace('\\', '/')
                        if not path.startswith('tests/'):
                            path = 'tests/' + path
                        title, project = spec['title'], test['projectName']
                        failures.append(dict(file=path, title=title, project=project, classification=classify(path, title, project)))
            visit(suite.get('suites', []), file)
    visit(report.get('suites', []))
    return failures
