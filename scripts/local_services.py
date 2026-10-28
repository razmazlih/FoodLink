#!/usr/bin/env python3
"""Manage FoodLink development services without touching untracked processes."""
import argparse
from contextlib import contextmanager
import fcntl
import http.client
import json
import os
from pathlib import Path
import shutil
import signal
import socket
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
STATE_DIR = ROOT / '.local-services'
SERVICES = {
    'userbase': {'directory': 'UserBase', 'port': 8001, 'settings': 'user_base.firebase_settings'},
    'dishboard': {'directory': 'DishBoard', 'port': 8002, 'settings': 'dish_board.firebase_settings'},
    'orderline': {'directory': 'OrderLine', 'port': 8003},
    'frontend': {'directory': 'frontend', 'port': 3000, 'web': True},
    'manager': {'directory': 'manager-front', 'port': 3002, 'web': True},
}


def process_identity(pid):
    """Read identity from the OS, including creation time and full command."""
    if type(pid) is not int or pid <= 1:
        return None
    result = subprocess.run(['ps', '-p', str(pid), '-o', 'pgid=', '-o', 'lstart=', '-o', 'command='],
                            capture_output=True, text=True, check=False)
    fields = result.stdout.strip().split(None, 6)
    if result.returncode or len(fields) < 7:
        return None
    try:
        return {'pid': pid, 'pgid': int(fields[0]), 'started': ' '.join(fields[1:6]), 'command': fields[6]}
    except ValueError:
        return None


def is_managed(record):
    if not isinstance(record, dict):
        return False
    current = process_identity(record.get('pid'))
    # Python shims and reload launchers can legitimately exec after Popen;
    # exec preserves process birth time and group but changes its command.
    return bool(current and current['pgid'] == current['pid'] and
                all(current.get(key) == record.get(key) for key in ('pid', 'pgid', 'started')))


def same_process(record):
    current = process_identity(record['pid'])
    return bool(current and all(current.get(key) == record.get(key) for key in ('pid', 'pgid', 'started')))


def port_open(port):
    with socket.socket() as connection:
        connection.settimeout(0.2)
        return connection.connect_ex(('127.0.0.1', port)) == 0


def load_state():
    path = STATE_DIR / 'state.json'
    if not path.exists():
        return {}
    try:
        state = json.loads(path.read_text())
        if not isinstance(state, dict) or any(name not in SERVICES for name in state):
            raise ValueError('Unknown services in state')
        return state
    except (ValueError, OSError) as error:
        raise RuntimeError(f'Cannot read {path}; refusing to guess process ownership: {error}') from error


def save_state(state):
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    temporary = STATE_DIR / 'state.tmp'
    temporary.write_text(json.dumps(state, indent=2) + '\n')
    os.chmod(temporary, 0o600)
    temporary.replace(STATE_DIR / 'state.json')


@contextmanager
def state_lock():
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    with (STATE_DIR / 'lock').open('a') as handle:
        try:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as error:
            raise RuntimeError('Another ./foodlink command is running; try again when it finishes.') from error
        try:
            yield
        finally:
            fcntl.flock(handle, fcntl.LOCK_UN)


def command_for(name):
    spec = SERVICES[name]
    cwd = ROOT / spec['directory']
    environment = dict(os.environ)
    if environment.get('FIREBASE_AUTH_EMULATOR_HOST') or environment.get('FIRESTORE_EMULATOR_HOST'):
        raise RuntimeError('Unset Firebase emulator host variables: ./foodlink runs the cloud Firebase configuration.')
    project = environment.get('FIREBASE_PROJECT_ID') or json.loads((ROOT / '.firebaserc').read_text())['projects']['default']
    if project.startswith('demo-'):
        raise RuntimeError('A demo- Firebase project needs emulators; use scripts/run_firebase.py --emulators.')
    environment.update(FIREBASE_PROJECT_ID=project, GOOGLE_CLOUD_PROJECT=project,
                       PYTHONPATH=str(ROOT) + os.pathsep + environment.get('PYTHONPATH', ''),
                       PYTHONUNBUFFERED='1')
    environment.setdefault('CORS_ALLOWED_ORIGINS', 'http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001,http://localhost:3002,http://127.0.0.1:3002')
    if spec.get('web'):
        node = shutil.which('node')
        if not node or not (cwd / 'node_modules/react-scripts/bin/react-scripts.js').exists():
            raise RuntimeError(f'{name}: install Node.js and run npm ci in {cwd}.')
        environment.update(HOST='127.0.0.1', PORT=str(spec['port']), BROWSER='none',
                           REACT_APP_USE_FIREBASE_EMULATORS='false')
        return [node, str(cwd / 'node_modules/react-scripts/bin/react-scripts.js'), 'start'], cwd, environment
    python = cwd / 'venv/bin/python'
    if not python.exists():
        raise RuntimeError(f'{name}: create {cwd}/venv and install requirements.firebase.txt.')
    if 'settings' in spec:
        environment['DJANGO_SETTINGS_MODULE'] = spec['settings']
        command = [str(python), 'manage.py', 'runserver', f"127.0.0.1:{spec['port']}"]
    else:
        command = [str(python), '-m', 'uvicorn', 'firebase_main:app', '--host', '127.0.0.1',
                   '--port', str(spec['port']), '--reload', '--reload-dir', str(cwd),
                   '--reload-dir', str(ROOT / 'foodlink_core')]
    return command, cwd, environment


def wait_ready(name, process, record):
    deadline = time.monotonic() + (120 if SERVICES[name].get('web') else 60)
    while time.monotonic() < deadline:
        if process.poll() is not None or not is_managed(record):
            raise RuntimeError(f'{name} exited during startup; inspect ./foodlink logs {name}.')
        # An HTTP reply confirms the reload child is accepting requests. Merely
        # connecting to uvicorn's inherited listening socket is insufficient.
        if port_open(record['port']):
            connection = http.client.HTTPConnection('127.0.0.1', record['port'], timeout=0.7)
            try:
                connection.request('GET', '/')
                response = connection.getresponse()
                if response.status < 500:
                    return
            except (OSError, http.client.HTTPException):
                pass
            finally:
                connection.close()
        time.sleep(0.2)
    raise RuntimeError(f'{name} was not ready before timeout; inspect ./foodlink logs {name}.')


def process_members(pgid):
    result = subprocess.run(['ps', '-axo', 'pid=', '-o', 'pgid='], capture_output=True, text=True, check=False)
    members = []
    for line in result.stdout.splitlines():
        fields = line.split()
        if len(fields) == 2 and fields[1] == str(pgid):
            identity = process_identity(int(fields[0]))
            if identity and identity['pgid'] == pgid:
                members.append(identity)
    return members


def stop_service(name, state):
    record = state.get(name)
    if not is_managed(record):
        if record:
            print(f'{name}: stale identity; no process was signalled.')
            state.pop(name, None)
            save_state(state)
        else:
            print(f'{name}: already stopped.')
        return False
    members = process_members(record['pgid'])
    # Verify once more immediately before signalling the tracked process group.
    if not is_managed(record):
        raise RuntimeError(f'{name}: process identity changed; refusing to signal.')
    try:
        os.killpg(record['pgid'], signal.SIGTERM)
    except ProcessLookupError:
        pass
    deadline = time.monotonic() + 8
    while time.monotonic() < deadline:
        remaining = [member for member in members if same_process(member)]
        if not remaining:
            break
        time.sleep(0.1)
    # After the leader exits, never signal its old process group. Escalate only
    # exact individual identities captured before graceful shutdown.
    for member in members:
        if same_process(member):
            try:
                os.kill(member['pid'], signal.SIGKILL)
            except ProcessLookupError:
                pass
    state.pop(name, None)
    save_state(state)
    print(f'{name}: stopped.')
    return True


def start_service(name, state):
    existing = state.get(name)
    if is_managed(existing):
        if not port_open(SERVICES[name]['port']):
            raise RuntimeError(f'{name}: tracked process is running but its port is unavailable; use restart {name} or inspect logs.')
        print(f"{name}: already running at http://127.0.0.1:{SERVICES[name]['port']}.")
        return existing
    if port_open(SERVICES[name]['port']):
        raise RuntimeError(f"{name}: port {SERVICES[name]['port']} is occupied by an untracked listener. Stop it using its original launcher; no process was killed.")
    command, cwd, environment = command_for(name)
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    with (STATE_DIR / f'{name}.log').open('ab') as log:
        log.write(f'\n--- {time.strftime("%Y-%m-%d %H:%M:%S")} starting {name} ---\n'.encode())
        log.flush()
        process = subprocess.Popen(command, cwd=cwd, env=environment, stdin=subprocess.DEVNULL,
                                   stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
    record = process_identity(process.pid)
    if not record or record['pgid'] != process.pid:
        process.terminate()
        raise RuntimeError(f'{name}: could not verify the new process identity; inspect its log.')
    record['port'] = SERVICES[name]['port']
    state[name] = record
    try:
        save_state(state)  # Preserve ownership even if this CLI is interrupted.
        wait_ready(name, process, record)
    except BaseException:
        stop_service(name, state)
        raise
    print(f"{name}: ready at http://127.0.0.1:{record['port']} (PID {record['pid']}).", flush=True)
    return record


def start_services(names, state):
    started = []
    try:
        # Check all requested ports and prerequisites before starting anything.
        for name in names:
            if not is_managed(state.get(name)):
                if port_open(SERVICES[name]['port']):
                    raise RuntimeError(f"{name}: port {SERVICES[name]['port']} is occupied by an untracked listener; no process was killed.")
                command_for(name)
        for name in names:
            already_running = is_managed(state.get(name))
            start_service(name, state)
            if not already_running:
                started.append(name)
    except BaseException:
        for name in reversed(started):
            stop_service(name, state)
        raise


def stop_services(names, state):
    for name in reversed(names):
        stop_service(name, state)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=('start', 'stop', 'restart', 'status', 'logs'))
    parser.add_argument('service', nargs='?', default='all', choices=('all', *SERVICES))
    parser.add_argument('--lines', type=int, default=60, help='Log lines per service (default 60)')
    args = parser.parse_args(argv)
    names = list(SERVICES) if args.service == 'all' else [args.service]
    try:
        with state_lock():
            state = load_state()
            if args.command == 'logs':
                if args.lines < 1:
                    parser.error('--lines must be positive')
                from collections import deque
                for name in names:
                    print(f'=== {name} ===')
                    path = STATE_DIR / f'{name}.log'
                    if path.exists():
                        with path.open(errors='replace') as handle:
                            print(''.join(deque(handle, maxlen=args.lines)), end='')
                    else:
                        print('No log yet.')
            elif args.command == 'status':
                for name in names:
                    managed = is_managed(state.get(name))
                    listening = port_open(SERVICES[name]['port'])
                    status = ('running' if listening else 'running; port not ready') if managed else ('untracked listener' if listening else 'stopped')
                    print(f"{name}: {status} — http://127.0.0.1:{SERVICES[name]['port']}")
            else:
                if args.command in ('stop', 'restart'):
                    stop_services(names, state)
                if args.command in ('start', 'restart'):
                    start_services(names, state)
        return 0
    except (RuntimeError, OSError, ValueError, KeyError) as error:
        print(f'FoodLink: {error}', file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print('FoodLink: interrupted; newly started services were stopped.', file=sys.stderr)
        return 130


if __name__ == '__main__':
    sys.exit(main())
