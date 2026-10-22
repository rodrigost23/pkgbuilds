#!/usr/bin/env python3
"""Validates packages-config.json: it matches its JSON schema, every configured
package has a PKGBUILD, and every variable the config sets (`vars`) is assigned
in that PKGBUILD (the update action fails at runtime otherwise).

Run from the repository root; needs the `jsonschema` package."""

import json
import re
import sys
from pathlib import Path

from jsonschema import Draft7Validator


def main() -> int:
    config = json.loads(Path("packages-config.json").read_text())
    schema = json.loads(Path("packages-config.schema.json").read_text())
    errors: list[str] = []

    Draft7Validator.check_schema(schema)
    for error in Draft7Validator(schema).iter_errors(config):
        location = "/".join(str(part) for part in error.absolute_path) or "(root)"
        errors.append(f"packages-config.json: {location}: {error.message}")

    for name, package in config.get("packages", {}).items():
        pkgbuild = Path("packages") / name / "PKGBUILD"
        if not pkgbuild.is_file():
            errors.append(f"{name}: {pkgbuild} does not exist")
            continue

        text = pkgbuild.read_text()
        for var in package.get("vars", {}):
            if not re.search(rf"^{re.escape(var)}=", text, re.MULTILINE):
                errors.append(f"{name}: {var} is not assigned in {pkgbuild}")

    for error in errors:
        print(f"::error::{error}")
    if not errors:
        print(f"ok: {len(config.get('packages', {}))} packages")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
