"""Process-controller regression tests; no real processes are signalled."""
import importlib.util
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def load_controller():
    spec = importlib.util.spec_from_file_location('foodlink_local_services', ROOT / 'scripts/local_services.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class LocalServicesTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.controller = load_controller()

    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        patcher = patch.object(self.controller, 'STATE_DIR', Path(self.temporary.name))
        patcher.start()
        self.addCleanup(patcher.stop)

    def record(self, pid=12345, port=3000):
        return {'pid': pid, 'pgid': pid, 'started': 'Wed Oct 28 10:00:00 2026',
                'command': '/usr/bin/python3 -m service', 'port': port}

    def test_reused_pid_is_not_signalled(self):
        service = self.controller
        record = self.record()
        for changes in ({'started': 'Thu Oct 29 10:00:00 2026'},
                        {'pgid': 99999}):
            with self.subTest(changes=changes):
                state = {'frontend': dict(record)}
                with patch.object(service, 'process_identity', return_value={**record, **changes}), \
                        patch.object(service.os, 'killpg') as signal_group:
                    self.assertFalse(service.is_managed(record))
                    service.stop_service('frontend', state)
                    signal_group.assert_not_called()

    def test_exec_command_transition_preserves_process_identity(self):
        service = self.controller
        record = self.record()
        with patch.object(service, 'process_identity', return_value={**record, 'command': '/usr/bin/node react-scripts start'}):
            self.assertTrue(service.is_managed(record))

    def test_missing_process_is_not_signalled(self):
        service = self.controller
        state = {'frontend': self.record()}
        with patch.object(service, 'process_identity', return_value=None), \
                patch.object(service.os, 'killpg') as signal_group:
            service.stop_service('frontend', state)
            signal_group.assert_not_called()

    def test_start_of_verified_running_service_is_idempotent(self):
        service = self.controller
        record = self.record()
        state = {'frontend': record}
        with patch.object(service, 'is_managed', return_value=True), \
                patch.object(service, 'port_open', return_value=True), \
                patch.object(service.subprocess, 'Popen') as spawn:
            self.assertEqual(service.start_service('frontend', state), record)
            self.assertEqual(state, {'frontend': record})
            spawn.assert_not_called()

    def test_stopping_absent_service_preserves_other_service(self):
        service = self.controller
        state = {'manager': self.record(12346, 3002)}
        before = dict(state)
        with patch.object(service.os, 'killpg') as signal_group:
            service.stop_service('frontend', state)
            service.stop_service('frontend', state)
            self.assertEqual(state, before)
            signal_group.assert_not_called()

    def test_managed_stop_is_idempotent_and_preserves_other_service(self):
        service = self.controller
        record = self.record()
        other = self.record(12346, 3002)
        state = {'frontend': record, 'manager': other}
        with patch.object(service, 'process_identity', return_value=record), \
                patch.object(service, 'process_members', return_value=[]), \
                patch.object(service.os, 'killpg') as signal_group, \
                patch.object(service.os, 'kill') as signal_pid:
            self.assertTrue(service.stop_service('frontend', state))
            self.assertFalse(service.stop_service('frontend', state))
            signal_group.assert_called_once_with(record['pgid'], service.signal.SIGTERM)
            signal_pid.assert_not_called()
            self.assertEqual(state, {'manager': other})

    def test_failed_group_start_rolls_back_only_new_services(self):
        service = self.controller
        running = self.record()
        state = {'frontend': running}
        stopped = []

        def start(name, current):
            if name == 'orderline':
                raise RuntimeError('Startup failed')
            if name not in current:
                current[name] = self.record(12346, 3002)
            return current[name]

        def stop(name, current):
            stopped.append(name)
            current.pop(name, None)
            return True

        with patch.object(service, 'start_service', side_effect=start), \
                patch.object(service, 'stop_service', side_effect=stop), \
                patch.object(service, 'is_managed', side_effect=lambda record: bool(record)), \
                patch.object(service, 'port_open', return_value=False), \
                patch.object(service, 'command_for', return_value=(['stub'], ROOT, {})):
            with self.assertRaises(RuntimeError):
                service.start_services(['frontend', 'manager', 'orderline'], state)
        self.assertEqual(stopped, ['manager'])
        self.assertEqual(state, {'frontend': running})

    def test_port_conflict_prevents_entire_group_start(self):
        service = self.controller
        state = {}
        with patch.object(service, 'port_open', side_effect=lambda port: port == 3002), \
                patch.object(service, 'command_for', return_value=(['stub'], ROOT, {})), \
                patch.object(service, 'start_service') as start, \
                patch.object(service.os, 'killpg') as signal_group:
            with self.assertRaisesRegex(RuntimeError, 'occupied'):
                service.start_services(['frontend', 'manager'], state)
            start.assert_not_called()
            signal_group.assert_not_called()
            self.assertEqual(state, {})

    def test_failed_readiness_stops_new_service_and_reraises(self):
        service = self.controller
        state = {}
        process = Mock(pid=12345)
        record = self.record()
        stopped = []

        def stop(name, current):
            stopped.append(name)
            current.pop(name, None)

        with patch.object(service, 'port_open', return_value=False), \
                patch.object(service, 'command_for', return_value=(['stub'], ROOT, {})), \
                patch.object(service, 'process_identity', return_value=record), \
                patch.object(service.subprocess, 'Popen', return_value=process), \
                patch.object(service, 'wait_ready', side_effect=RuntimeError('Readiness failed')), \
                patch.object(service, 'stop_service', side_effect=stop):
            with self.assertRaisesRegex(RuntimeError, 'Readiness failed'):
                service.start_service('frontend', state)
        self.assertEqual(stopped, ['frontend'])
        self.assertEqual(state, {})


if __name__ == '__main__':
    unittest.main()
