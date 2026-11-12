"""Durable local delivery cursors and a process lifetime singleton lock."""
from contextlib import contextmanager
import json
import os
from pathlib import Path
import sqlite3
import time


class State:
    def __init__(self, directory):
        self.directory = Path(directory)
        self.directory.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(self.directory / 'delivery.sqlite3')
        self.db.execute('PRAGMA journal_mode=WAL')
        self.db.execute('PRAGMA synchronous=FULL')
        self.db.executescript('''
            CREATE TABLE IF NOT EXISTS delivery (
                event_key TEXT PRIMARY KEY, report_id INTEGER NOT NULL,
                message_id TEXT NOT NULL, queued_at REAL NOT NULL);
            CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        ''')

    @property
    def cursor(self):
        row = self.db.execute("SELECT value FROM metadata WHERE key='cursor'").fetchone()
        return int(row[0]) if row else 0

    def delivered(self, key):
        return self.db.execute('SELECT message_id FROM delivery WHERE event_key=?', (key,)).fetchone() is not None

    def acknowledge(self, key, report_id, message_id, cursor=None):
        with self.db:
            self.db.execute('INSERT OR IGNORE INTO delivery VALUES(?,?,?,?)', (key, report_id, message_id, time.time()))
            if cursor is not None:
                self.db.execute("INSERT INTO metadata VALUES('cursor',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", (str(max(cursor, self.cursor)),))

    def close(self):
        self.db.close()


def write_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    with temporary.open('w', encoding='utf-8') as output:
        json.dump(value, output, ensure_ascii=False, indent=2)
        output.flush()
        os.fsync(output.fileno())
    os.replace(temporary, path)


@contextmanager
def singleton(directory):
    path = Path(directory) / 'worker.lock'
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('a+b') as handle:
        if handle.tell() == 0:
            handle.write(b'0'); handle.flush()
        handle.seek(0)
        if os.name == 'nt':
            import msvcrt
            msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        try: yield
        finally:
            handle.seek(0)
            if os.name == 'nt': msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
            else: fcntl.flock(handle, fcntl.LOCK_UN)
