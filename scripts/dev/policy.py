"""Explicit broad-run opt-in. Flags record human intent, never grant agent permission."""
from .common import UIError


def check_scope(args):
    full = getattr(args, 'full', False)
    if args.command == 'verify' and not full:
        raise UIError('Full verification requires a direct user request and --full. Use focus for scoped checks.')
    if args.command == 'focus' and args.kind in {'webunit', 'browser'} and not args.file and not full:
        raise UIError('Choose at least one --file. An unbounded suite requires a direct user request and --full.')
    if args.command == 'review' and not full and not args.scenario and not args.state:
        raise UIError('Choose --scenario form-lifecycle or affected --state values. The complete report requires --full.')
