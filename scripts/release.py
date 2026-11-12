#!/usr/bin/env python3
"""Windows/WSL bridge to the single immutable-artifact publication queue."""
import argparse
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys


def windows_path(path):
    if os.name=='nt': return str(path)
    return subprocess.check_output(['wslpath','-w',str(path)],text=True).strip()


def main(argv=None,source=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--commit',required=True)
    parser.add_argument('--web',action='store_true')
    parser.add_argument('--native',action='store_true')
    parser.add_argument('--phone',help='explicit authorized ADB serial')
    parser.add_argument('--browser-file',action='append',default=[])
    args=parser.parse_args(argv)
    if not (args.web or args.native or args.phone): parser.error('Choose --web, --native or --phone')
    source=Path(source or Path(__file__).resolve().parents[1]).resolve()
    shell=shutil.which('pwsh.exe') or shutil.which('powershell.exe')
    if not shell: parser.error('Windows PowerShell is required; publication runs through release-windows.ps1')
    entry=windows_path(source/'scripts/release-windows.ps1')
    base=[shell,'-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',entry]
    command=base+['-Mode','Prepare','-Commit',args.commit]
    if args.native or args.phone:command+=['-Android']
    # The PowerShell producer resolves branch names once. All later operations
    # use the returned immutable SHA, never a moving HEAD/main reference.
    result=subprocess.run(command,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,errors='replace')
    print(result.stdout,end='',flush=True)
    if result.returncode:return result.returncode
    match=re.search(r'^Prepared immutable artifact ([0-9a-f]{40}) at (.+)$',result.stdout,re.MULTILINE)
    if not match:raise RuntimeError('Producer did not identify its artifact')
    sha,directory=match.group(1),match.group(2).strip()
    for specification in args.browser_file:
        check=base+['-Mode','Prepare','-Commit',sha,'-BrowserFile',specification]
        subprocess.run(check,check=True)
    if args.web:subprocess.run(base+['-Mode','Publish','-Commit',sha],check=True)
    if args.phone:
        install=windows_path(source/'scripts/native/install.ps1')
        subprocess.run([shell,'-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',install,
                        '-Serial',args.phone,'-ReleaseManifest',directory+'\\android\\release.json'],check=True)
    return 0


if __name__=='__main__':raise SystemExit(main())
