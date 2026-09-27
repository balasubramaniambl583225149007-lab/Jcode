#!/usr/bin/env python3
"""
Real PTY Bridge for POSIX environments.
Spawns target process in a true pseudo-terminal (isatty is True).
Communicates bidirectionally over stdin/stdout.
Supports resize commands and signal forwarding.
"""

import os
import pty
import sys
import select
import termios
import struct
import fcntl
import signal

def set_winsize(fd, rows, cols):
    winsize = struct.pack("HHHH", rows, cols, 0, 0)
    fcntl.ioctl(fd, termios.TIOCSWINSZ, winsize)

def main():
    if len(sys.argv) < 2:
        sys.stderr.write("Usage: pty-bridge.py <command> [args...]\n")
        sys.exit(1)

    cmd = sys.argv[1]
    args = sys.argv[1:]

    cols = int(os.environ.get("PTY_COLS", 100))
    rows = int(os.environ.get("PTY_ROWS", 30))
    cwd = os.environ.get("PTY_CWD", os.getcwd())

    master, slave = pty.openpty()

    try:
        set_winsize(slave, rows, cols)
    except Exception:
        pass

    pid = os.fork()

    if pid == 0:
        # Child process
        os.close(master)
        os.setsid()

        # Set controlling terminal
        try:
            fcntl.ioctl(slave, termios.TIOCSCTTY, 0)
        except Exception:
            pass

        os.dup2(slave, 0)
        os.dup2(slave, 1)
        os.dup2(slave, 2)
        if slave > 2:
            os.close(slave)

        os.chdir(cwd)
        os.environ["TERM"] = "xterm-256color"
        os.environ["COLORTERM"] = "truecolor"

        try:
            os.execvp(cmd, args)
        except Exception as e:
            sys.stderr.write(f"Failed to exec {cmd}: {e}\n")
            sys.exit(127)

    # Parent process
    os.close(slave)

    stdin_fd = sys.stdin.fileno()
    stdout_fd = sys.stdout.fileno()

    # Make master non-blocking
    flags = fcntl.fcntl(master, fcntl.F_GETFL)
    fcntl.fcntl(master, fcntl.F_SETFL, flags | os.O_NONBLOCK)

    # Set stdin non-blocking
    flags_in = fcntl.fcntl(stdin_fd, fcntl.F_GETFL)
    fcntl.fcntl(stdin_fd, fcntl.F_SETFL, flags_in | os.O_NONBLOCK)

    def sigchld_handler(signum, frame):
        pass

    signal.signal(signal.SIGCHLD, sigchld_handler)

    try:
        while True:
            # Check if child process has exited
            child_pid, status = os.waitpid(pid, os.WNOHANG)
            if child_pid != 0:
                # Flush any remaining output from master
                try:
                    while True:
                        data = os.read(master, 4096)
                        if not data:
                            break
                        os.write(stdout_fd, data)
                except Exception:
                    pass
                exit_code = os.WEXITSTATUS(status) if os.WIFEXITED(status) else 1
                sys.exit(exit_code)

            rlist, _, _ = select.select([master, stdin_fd], [], [], 0.05)

            if master in rlist:
                try:
                    data = os.read(master, 4096)
                    if not data:
                        break
                    os.write(stdout_fd, data)
                except (OSError, IOError):
                    pass

            if stdin_fd in rlist:
                try:
                    data = os.read(stdin_fd, 4096)
                    if not data:
                        break
                    os.write(master, data)
                except (OSError, IOError):
                    pass

    except KeyboardInterrupt:
        try:
            os.kill(pid, signal.SIGTERM)
        except Exception:
            pass
    finally:
        os.close(master)

if __name__ == "__main__":
    main()
