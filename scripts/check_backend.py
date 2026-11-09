"""Run isolated backend regressions without cloud credentials or live services.

Use a Python 3.12 environment with the CI dependencies documented in
`docs/testing.md`. Emulator integration is deliberately a separate opt-in suite.
"""
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
SUITES = (
    ('.', ['-m', 'unittest', 'discover', '-s', 'tests', '-p', 'test_firebase_core.py', '-v']),
    ('.', ['-m', 'unittest', 'discover', '-s', 'tests', '-p', 'test_local_services.py', '-v']),
    ('UserBase', ['manage.py', 'test', 'users.firebase_tests', '--settings=user_base.firebase_settings']),
    ('DishBoard', ['manage.py', 'test', 'restaurant.firebase_tests', '--settings=dish_board.firebase_settings']),
    ('OrderLine', ['-m', 'unittest', 'discover', '-s', 'tests', '-v']),
)


def main():
    environment = {**os.environ, 'PYTHONPATH': str(ROOT), 'PYTHON_DOTENV_DISABLED': '1'}
    for directory, arguments in SUITES:
        print(f'\n== {directory}: {" ".join(arguments)} ==', flush=True)
        subprocess.run([sys.executable, *arguments], cwd=ROOT / directory,
                       env=environment, check=True)


if __name__ == '__main__':
    main()
