"""Migration linter — catches banned patterns in Alembic migration files.

Runs automatically as part of the standard pytest suite.
See docs/epics/E62_migration_linter.md for rationale.

Banned patterns:
- sa.CHAR(36) → use sa.Uuid()
- sa.String(36) → use sa.Uuid() (unless # noqa: migration-lint)
- server_default="0" or "1" on Boolean columns → use sa.text("false") / sa.text("true")
- Missing ondelete on ForeignKey constraints
- Numeric server_default="0" on Integer columns → use sa.text("0")
- ForeignKey / ForeignKeyConstraint without explicit name= parameter (E127)
"""

import re
from pathlib import Path

VERSIONS_DIR = Path(__file__).parent.parent / "alembic" / "versions"


def _migration_files() -> list[Path]:
    """Return all .py migration files, excluding __pycache__."""
    return sorted(VERSIONS_DIR.glob("*.py"))


def _non_comment_lines(filepath: Path) -> list[tuple[int, str]]:
    """Return (line_number, line) pairs, skipping comment-only lines."""
    results = []
    for i, line in enumerate(filepath.read_text().splitlines(), start=1):
        stripped = line.strip()
        if stripped.startswith("#"):
            continue
        results.append((i, line))
    return results


def test_no_char36_in_migrations():
    """Migrations must use sa.Uuid() instead of sa.CHAR(36)."""
    violations = []
    for f in _migration_files():
        for lineno, line in _non_comment_lines(f):
            if "# noqa: migration-lint" in line:
                continue
            if re.search(r"sa\.CHAR\(\s*36\s*\)", line):
                violations.append(f"{f.name}:{lineno}: {line.strip()}")
    assert not violations, "Found sa.CHAR(36) in migrations — use sa.Uuid() instead:\n" + "\n".join(
        violations
    )


def test_no_string36_in_migrations():
    """Migrations must use sa.Uuid() instead of sa.String(36)."""
    violations = []
    for f in _migration_files():
        for lineno, line in _non_comment_lines(f):
            if "# noqa: migration-lint" in line:
                continue
            if re.search(r"sa\.String\(\s*36\s*\)", line):
                violations.append(f"{f.name}:{lineno}: {line.strip()}")
    assert not violations, (
        "Found sa.String(36) in migrations — use sa.Uuid() instead:\n" + "\n".join(violations)
    )


def test_no_bad_boolean_defaults():
    """Boolean columns must use sa.text('false')/sa.text('true'), not '0'/'1'."""
    # Match lines that have Boolean AND server_default="0" or "1"
    violations = []
    for f in _migration_files():
        for lineno, line in _non_comment_lines(f):
            if "# noqa: migration-lint" in line:
                continue
            if re.search(r"Boolean", line) and re.search(
                r'server_default\s*=\s*["\']([01])["\']', line
            ):
                violations.append(f"{f.name}:{lineno}: {line.strip()}")
    assert not violations, (
        'Found Boolean column with server_default="0"/"1" — '
        'use sa.text("false")/sa.text("true") instead:\n' + "\n".join(violations)
    )


def test_no_numeric_string_defaults():
    """Integer/Numeric columns should use sa.text('0'), not server_default='0'."""
    # Match lines with Integer or Numeric AND a bare string server_default of digits
    violations = []
    for f in _migration_files():
        for lineno, line in _non_comment_lines(f):
            if "# noqa: migration-lint" in line:
                continue
            if re.search(r"(Integer|Numeric)", line) and re.search(
                r'server_default\s*=\s*"(\d+)"', line
            ):
                violations.append(f"{f.name}:{lineno}: {line.strip()}")
    assert not violations, (
        "Found Integer/Numeric column with bare string server_default — "
        'use sa.text("0") instead:\n' + "\n".join(violations)
    )


def test_no_missing_ondelete_on_foreignkey():
    """All ForeignKey constraints should have an explicit ondelete policy."""
    violations = []
    for f in _migration_files():
        for lineno, line in _non_comment_lines(f):
            if "# noqa: migration-lint" in line:
                continue
            # Match sa.ForeignKey(...) or ForeignKeyConstraint without ondelete
            if re.search(r"sa\.ForeignKey\(", line) or re.search(r"ForeignKeyConstraint\(", line):
                # Check if ondelete is present anywhere on this line
                if "ondelete" not in line:
                    # For ForeignKeyConstraint, the ondelete may be on a different line.
                    # Read the full file and check a window around this line.
                    all_lines = f.read_text().splitlines()
                    # Look at next 3 lines for multi-line FK definitions
                    context = " ".join(all_lines[lineno - 1 : min(lineno + 3, len(all_lines))])
                    if "ondelete" not in context:
                        violations.append(f"{f.name}:{lineno}: {line.strip()}")
    assert not violations, (
        "Found ForeignKey without ondelete policy — "
        "add ondelete='CASCADE'/'SET NULL'/'RESTRICT':\n" + "\n".join(violations)
    )


def test_explicit_fk_constraint_names():
    """All ForeignKey / ForeignKeyConstraint calls must have an explicit name= parameter."""
    violations = []
    for f in _migration_files():
        for lineno, line in _non_comment_lines(f):
            if "# noqa: migration-lint" in line:
                continue
            # Match sa.ForeignKey(...) or ForeignKeyConstraint(...)
            if re.search(r"sa\.ForeignKey\(", line) or re.search(r"ForeignKeyConstraint\(", line):
                # Check if name= is present on this line or in the surrounding context
                all_lines = f.read_text().splitlines()
                context = " ".join(all_lines[lineno - 1 : min(lineno + 3, len(all_lines))])
                if "name=" not in context:
                    violations.append(f"{f.name}:{lineno}: {line.strip()}")
    assert not violations, (
        "Found ForeignKey without explicit name= parameter — "
        "add name='fk_{table}_{column}':\n" + "\n".join(violations)
    )
