#!/usr/bin/env python3
"""Refuse any Foundry toolchain other than the one deps.lock pins.

Every foundry-toolchain step under .github/workflows must pin FOUNDRY_VERSION, and the forge, cast and anvil on PATH
must report FOUNDRY_VERSION and FOUNDRY_COMMIT. install_deps.sh runs this before it touches lib/.
"""
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def lock_value(name):
    for line in (ROOT / "deps.lock").read_text().splitlines():
        if line.startswith(name + "="):
            return line.split("=", 1)[1].strip()
    sys.exit(f"deps.lock has no {name}")


def workflow_pins():
    """Yield (file, line, version) for each foundry-toolchain step; version is None when the step pins nothing."""
    for path in sorted((ROOT / ".github" / "workflows").glob("*.yml")):
        lines = path.read_text().splitlines()
        for index, line in enumerate(lines):
            if "foundry-rs/foundry-toolchain@" not in line:
                continue
            version = None
            for following in lines[index + 1:index + 6]:
                stripped = following.strip()
                if stripped.startswith("- "):
                    break
                match = re.match(r"version:\s*(\S+)", stripped)
                if match:
                    version = match.group(1)
                    break
            yield path.relative_to(ROOT), index + 1, version


def main():
    version = lock_value("FOUNDRY_VERSION")
    commit = lock_value("FOUNDRY_COMMIT")
    errors = []
    pins = list(workflow_pins())
    if not pins:
        errors.append("no foundry-toolchain step found under .github/workflows")
    for path, line, pinned in pins:
        if pinned != version:
            errors.append(f"{path}:{line} pins Foundry {pinned}, deps.lock pins {version}")
    for tool in ("forge", "cast", "anvil"):
        binary = shutil.which(tool)
        if binary is None:
            errors.append(f"{tool} is not installed")
            continue
        report = subprocess.run([binary, "--version"], capture_output=True, text=True, check=False).stdout
        if f"Version: {version.lstrip('v')}" not in report or f"Commit SHA: {commit}" not in report:
            first = report.strip().splitlines()[0] if report.strip() else "no version output"
            errors.append(f"{tool} reports '{first}', deps.lock pins {version} ({commit})")
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    print(f"Foundry {version} ({commit[:10]}) pinned in {len(pins)} workflow steps and installed", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
