#!/usr/bin/env python3
"""Run with python3 scripts/docker-entrypoint-test.py. No Docker daemon is used.

The complete entrypoint runs under /bin/sh with disposable paths and mocked OS
commands. Socket fixtures bind a path but never listen or serve requests. Actual
BusyBox/su-exec credentials must also be checked in an isolated Linux container.
"""

import json
import os
from pathlib import Path
import shlex
import shutil
import socket
import subprocess
import tempfile
import unittest


MOCK_TOOL = r'''#!/usr/bin/env python3
import json
import os
from pathlib import Path
import sys

name = Path(sys.argv[0]).name
args = sys.argv[1:]
with Path(os.environ['ZPANEL_TEST_EVENTS']).open('a') as events:
    events.write(json.dumps([name, args]) + '\n')
failure = os.environ.get('ZPANEL_TEST_FAILURE', '')
group_file = Path(os.environ['ZPANEL_TEST_GROUP_FILE'])
if name == 'chown':
    sys.exit(42 if failure == 'chown' else 0)
if name == 'zpanel':
    assert args == ['-config'], args
    if failure == 'config':
        sys.exit(43)
    (Path(__file__).parent / 'conf' / 'conf.ini').write_text('generated config')
    sys.exit(0)
if name == 'su-exec':
    sys.exit(0)
if name == 'stat':
    if failure == 'stat':
        sys.exit(1)
    assert args[:2] == ['-c', '%g'], args
    print(os.environ['ZPANEL_TEST_SOCKET_GID'])
    sys.exit(0)
if name == 'awk':
    if failure == 'awk':
        sys.exit(1)
    os.execv(os.environ['ZPANEL_TEST_AWK'], ['awk'] + args)
rows = [row.split(':') for row in group_file.read_text().splitlines()]
if name == 'id':
    if failure == 'id':
        sys.exit(1)
    if args == ['-G']:
        print(os.environ['ZPANEL_TEST_START_GROUPS'])
    else:
        assert args == ['-G', 'zpanel'], args
        groups = [row[2] for row in rows if row[0] == 'zpanel' or 'zpanel' in row[3].split(',')]
        print(' '.join(dict.fromkeys(groups)))
elif name == 'addgroup':
    if failure == 'addgroup':
        sys.exit(1)
    if args[:2] == ['-S', '-g']:
        # Alpine 3.22 BusyBox has CONFIG_LAST_ID=256000. Keep this old-path
        # behavior so the regression catches numeric addgroup creation again.
        gid, group = args[2:]
        if int(gid) > 256000:
            sys.exit(1)
        rows.append([group, 'x', gid, ''])
    else:
        user, group = args
        # BusyBox's membership branch looks up the existing group by name;
        # it does not apply the numeric addgroup -g limit to that group's GID.
        target = next(row for row in rows if row[0] == group)
        members = list(filter(None, target[3].split(',')))
        if user not in members:
            target[3] = ','.join(members + [user])
    group_file.write_text(''.join(':'.join(row) + '\n' for row in rows))
else:
    raise AssertionError(name)
'''


@unittest.skipUnless(os.name == 'posix' and hasattr(socket, 'AF_UNIX'), 'requires a POSIX shell')
class DockerEntrypointTest(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix='zpanel entrypoint ')
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.app = self.root / 'app'
        self.bin = self.root / 'bin'
        self.app.mkdir()
        self.bin.mkdir()
        (self.app / 'conf').mkdir()
        self.config = self.app / 'conf' / 'conf.ini'
        self.config.write_text('original config')
        self.groups = self.root / 'group'
        self.groups.write_text('root:x:0:\nzpanel:x:101:\n')
        self.socket_path = self.root / 'docker.sock'
        self.events = self.root / 'events'
        helper = self.bin / 'mock-tool'
        helper.write_text(MOCK_TOOL)
        helper.chmod(0o755)
        for name in ('id', 'stat', 'awk', 'addgroup', 'chown', 'su-exec'):
            (self.bin / name).symlink_to(helper)
        (self.app / 'zpanel').symlink_to(helper)
        self.env = {
            **os.environ,
            'PATH': str(self.bin) + os.pathsep + os.environ['PATH'],
            'ZPANEL_TEST_EVENTS': str(self.events),
            'ZPANEL_TEST_GROUP_FILE': str(self.groups),
            'ZPANEL_TEST_AWK': shutil.which('awk') or '/usr/bin/awk',
            'ZPANEL_TEST_START_GROUPS': '0 984 777',
            'ZPANEL_TEST_SOCKET_GID': '984',
            'ZPANEL_TEST_FAILURE': '',
        }
        source = (Path(__file__).resolve().parent.parent / 'docker-entrypoint.sh').read_text()
        for original, replacement in (
            ('/app', self.app),
            ('/var/run/docker.sock', self.socket_path),
            ('/etc/group', self.groups),
        ):
            source = source.replace(original, shlex.quote(str(replacement)))
        self.entrypoint = self.root / 'entrypoint.sh'
        self.entrypoint.write_text(source)

    def mount_socket(self, gid='984', startup_groups=None):
        fixture = socket.socket(socket.AF_UNIX)
        self.addCleanup(fixture.close)
        fixture.bind(str(self.socket_path))
        self.env['ZPANEL_TEST_SOCKET_GID'] = gid
        self.env['ZPANEL_TEST_START_GROUPS'] = startup_groups or f'0 {gid} 777'

    def run_entrypoint(self):
        return subprocess.run(
            ['/bin/sh', str(self.entrypoint), './zpanel', '--test-argument'],
            cwd=self.app, env=self.env, capture_output=True, text=True, timeout=5,
        )

    def calls(self, name):
        if not self.events.exists():
            return []
        return [args for tool, args in map(json.loads, self.events.read_text().splitlines()) if tool == name]

    def assert_starts(self, result, warning=False):
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.calls('su-exec')[-1], ['zpanel', './zpanel', '--test-argument'])
        self.assertEqual('warning:' in result.stderr, warning, result.stderr)

    def assert_membership(self, gid):
        rows = [line.split(':') for line in self.groups.read_text().splitlines()]
        self.assertTrue(any(row[2] == gid and 'zpanel' in row[3].split(',') for row in rows), rows)
        self.assertFalse(any(row[2] == '777' and 'zpanel' in row[3].split(',') for row in rows), rows)

    def test_no_socket_leaves_groups_unchanged(self):
        before = self.groups.read_text()
        self.assert_starts(self.run_entrypoint())
        self.assertEqual(self.groups.read_text(), before)

    def test_regular_file_is_not_a_socket(self):
        self.socket_path.write_text('not a socket')
        before = self.groups.read_text()
        self.assert_starts(self.run_entrypoint())
        self.assertEqual(self.groups.read_text(), before)

    def test_requires_exact_startup_group(self):
        self.mount_socket(startup_groups='0 1984 777')
        before = self.groups.read_text()
        self.assert_starts(self.run_entrypoint())
        self.assertEqual(self.groups.read_text(), before)

    def test_default_socket_group_is_preserved(self):
        self.mount_socket()
        self.assert_starts(self.run_entrypoint())
        self.assert_membership('984')

    def test_large_gid_bypasses_busybox_numeric_limit(self):
        self.mount_socket('300000')
        self.assert_starts(self.run_entrypoint())
        self.assert_membership('300000')
        self.assertEqual(self.calls('addgroup'), [['zpanel', 'zpanel-docker-300000']])

    def test_maximum_valid_linux_gid(self):
        self.mount_socket('4294967294')
        self.assert_starts(self.run_entrypoint())
        self.assert_membership('4294967294')

    def test_existing_large_gid_group_is_reused(self):
        self.groups.write_text(self.groups.read_text() + 'host-docker:x:300000:\n')
        self.mount_socket('300000')
        self.assert_starts(self.run_entrypoint())
        self.assert_membership('300000')
        self.assertEqual(self.calls('addgroup'), [['zpanel', 'host-docker']])
        self.assertNotIn('zpanel-docker-', self.groups.read_text())

    def test_group_name_collisions_keep_existing_groups(self):
        initial = self.groups.read_text() + 'zpanel-docker-300000:x:888:\nzpanel-docker-300000-1:x:889:\n'
        self.groups.write_text(initial)
        self.mount_socket('300000')
        self.assert_starts(self.run_entrypoint())
        self.assertTrue(self.groups.read_text().startswith(initial))
        self.assertEqual(self.calls('addgroup'), [['zpanel', 'zpanel-docker-300000-2']])

    def test_existing_membership_needs_no_changes(self):
        initial = self.groups.read_text() + 'docker:x:300000:zpanel\n'
        self.groups.write_text(initial)
        self.mount_socket('300000')
        self.assert_starts(self.run_entrypoint())
        self.assertEqual(self.groups.read_text(), initial)
        self.assertEqual(self.calls('addgroup'), [])

    def test_repeated_startup_is_idempotent(self):
        self.mount_socket('300000')
        self.assert_starts(self.run_entrypoint())
        before = self.groups.read_text()
        self.events.write_text('')
        self.assert_starts(self.run_entrypoint())
        self.assertEqual(self.groups.read_text(), before)
        self.assertEqual(self.calls('addgroup'), [])

    def test_optional_initialization_failures_warn_and_continue(self):
        self.mount_socket('300000')
        for failure in ('stat', 'id', 'awk', 'addgroup'):
            with self.subTest(failure=failure):
                self.groups.write_text('root:x:0:\nzpanel:x:101:\n')
                self.events.write_text('')
                self.env['ZPANEL_TEST_FAILURE'] = failure
                self.assert_starts(self.run_entrypoint(), warning=True)
                self.assertEqual(self.config.read_text(), 'original config')

    def test_invalid_gid_warns_without_changing_groups(self):
        self.mount_socket()
        before = self.groups.read_text()
        for gid in ('', 'bad:gid', '4294967295'):
            with self.subTest(gid=gid):
                self.env['ZPANEL_TEST_SOCKET_GID'] = gid
                self.events.write_text('')
                self.assert_starts(self.run_entrypoint(), warning=True)
                self.assertEqual(self.groups.read_text(), before)

    def test_group_record_write_failure_warns_and_continues(self):
        self.mount_socket('300000')
        before = self.groups.read_text()
        # Inject a failure into the three-argument group-record printf only;
        # warning output keeps using the real shell builtin.
        self.entrypoint.write_text(
            'printf() { [ "$#" -ne 3 ] || return 1; command printf "$@"; }\n'
            + self.entrypoint.read_text()
        )
        self.assert_starts(self.run_entrypoint(), warning=True)
        self.assertEqual(self.groups.read_text(), before)
        self.assertEqual(self.calls('addgroup'), [])

    def test_fresh_config_initialization_still_runs(self):
        self.config.unlink()
        self.assert_starts(self.run_entrypoint())
        self.assertEqual(self.config.read_text(), 'generated config')

    def test_config_initialization_failure_still_stops_startup(self):
        self.config.unlink()
        self.env['ZPANEL_TEST_FAILURE'] = 'config'
        result = self.run_entrypoint()
        self.assertEqual(result.returncode, 43, result.stderr)
        self.assertEqual(self.calls('su-exec'), [])

    def test_directory_ownership_failure_still_stops_startup(self):
        self.env['ZPANEL_TEST_FAILURE'] = 'chown'
        result = self.run_entrypoint()
        self.assertEqual(result.returncode, 42, result.stderr)
        self.assertEqual(self.calls('su-exec'), [])


if __name__ == '__main__':
    unittest.main(verbosity=2)
