"""Run the three Firebase APIs locally; optionally start isolated demo emulators."""
import argparse
import json
import os
from pathlib import Path
import signal
import socket
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
SERVICES = {'userbase': ('UserBase', 8001, 'user_base.firebase_settings'),
            'dishboard': ('DishBoard', 8002, 'dish_board.firebase_settings'),
            'orderline': ('OrderLine', 8003, None)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--emulators', action='store_true', help='Use demo-foodlink, never the real project')
    args = parser.parse_args()
    environment = dict(os.environ)
    project = 'demo-foodlink' if args.emulators else environment.get('FIREBASE_PROJECT_ID', json.loads((ROOT/'.firebaserc').read_text())['projects']['default'])
    environment.update(FIREBASE_PROJECT_ID=project, GOOGLE_CLOUD_PROJECT=project,
                       PYTHONPATH=str(ROOT)+os.pathsep+environment.get('PYTHONPATH',''))
    environment.setdefault('CORS_ALLOWED_ORIGINS', 'http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001,http://localhost:3002,http://127.0.0.1:3002')
    if args.emulators:
        environment.update(FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099', FIRESTORE_EMULATOR_HOST='127.0.0.1:8080')
    elif environment.get('FIREBASE_AUTH_EMULATOR_HOST') or environment.get('FIRESTORE_EMULATOR_HOST'):
        parser.error('Unset emulator hosts for cloud mode, or use --emulators explicitly.')
    required_ports = [value[1] for value in SERVICES.values()] + ([9099,8080,4000,4400,4500,9150] if args.emulators else [])
    for port in required_ports:
        with socket.socket() as check:
            if check.connect_ex(('127.0.0.1',port)) == 0:
                parser.error(f'Port {port} is in use. Stop the previous local stack before starting this one.')
    for directory,_,_ in SERVICES.values():
        if not (ROOT/directory/'venv/bin/python').exists():
            parser.error(f'Create {directory}/venv and install requirements.firebase.txt first.')
    children=[]
    def start(command,cwd=ROOT,env=environment):
        child=subprocess.Popen(command,cwd=cwd,env=env,start_new_session=True)
        children.append(child)
        return child
    try:
        if args.emulators:
            emulator=start(['firebase','emulators:start','--project',project,'--only','auth,firestore'])
            deadline=time.monotonic()+90
            while True:
                if emulator.poll() is not None: raise RuntimeError('Firebase emulator startup failed.')
                ready=True
                for port in (9099,8080):
                    with socket.socket() as check:
                        ready = ready and check.connect_ex(('127.0.0.1',port)) == 0
                if ready: break
                if time.monotonic()>deadline: raise RuntimeError('Firebase emulators did not become ready.')
                time.sleep(0.25)
        for name,(directory,port,settings) in SERVICES.items():
            python=str(ROOT/directory/'venv/bin/python')
            if settings:
                start([python,'manage.py','runserver',f'127.0.0.1:{port}','--noreload'],ROOT/directory,{**environment,'DJANGO_SETTINGS_MODULE':settings})
            else:
                start([python,'-m','uvicorn','firebase_main:app','--host','127.0.0.1','--port',str(port)],ROOT/directory)
        print(f'FoodLink APIs started for {project}. Press Ctrl-C to stop only this stack.',flush=True)
        while all(child.poll() is None for child in children): time.sleep(0.5)
        raise RuntimeError('A service exited; stopping the remaining stack.')
    except KeyboardInterrupt:
        pass
    finally:
        for child in reversed(children):
            if child.poll() is None: os.killpg(child.pid,signal.SIGTERM)
        for child in reversed(children):
            try: child.wait(timeout=10)
            except subprocess.TimeoutExpired:
                os.killpg(child.pid,signal.SIGKILL);child.wait()


if __name__=='__main__':
    main()
