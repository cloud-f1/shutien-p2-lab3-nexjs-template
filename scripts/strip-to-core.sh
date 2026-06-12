#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# strip-to-core.sh — Remove optional template files, keep auth + dashboard
#
# Usage:  ./scripts/strip-to-core.sh              (interactive)
#         ./scripts/strip-to-core.sh --yes        (skip confirmation)
#         ./scripts/strip-to-core.sh --all        (non-interactive, strip everything)
#         ./scripts/strip-to-core.sh -y --strip-seo --strip-themes
#         ./scripts/strip-to-core.sh -y --strip-epics
#
# Idempotent: safe to run on an already-stripped repo.
# Creates .stripped-manifest.json recording what was removed.
# ──────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MANIFEST="$ROOT/.stripped-manifest.json"
AUTO_YES=false
STRIP_SEO=false
STRIP_THEMES=false
STRIP_EPICS=false

# ── Parse args ──
for arg in "$@"; do
  case "$arg" in
    --yes|-y) AUTO_YES=true ;;
    --strip-seo) STRIP_SEO=true ;;
    --strip-themes) STRIP_THEMES=true ;;
    --strip-epics) STRIP_EPICS=true ;;
    --all) AUTO_YES=true; STRIP_SEO=true; STRIP_THEMES=true; STRIP_EPICS=true ;;
    *) echo "Unknown argument: $arg"; exit 1 ;;
  esac
done

# ── Portable sed -i ──
sedi() {
  if [[ "$(uname)" == "Darwin" ]]; then
    sed -i '' "$@"
  else
    sed -i "$@"
  fi
}

# ── Manifest helpers ──
manifest_group_stripped() {
  local group="$1"
  if [ -f "$MANIFEST" ]; then
    # Check if group is already marked as stripped
    grep -q "\"$group\".*\"stripped\": true" "$MANIFEST" 2>/dev/null && return 0
  fi
  return 1
}

# Track removals per group
declare -A GROUP_FILES_REMOVED
declare -A GROUP_STRIPPED
declare -A GROUP_REASON

init_group() {
  GROUP_FILES_REMOVED[$1]=0
  GROUP_STRIPPED[$1]=false
  GROUP_REASON[$1]="not_applicable"
}

for g in legal landing getting-started dev-docs guides examples seo extra-themes epics; do
  init_group "$g"
done

# Count a removed file/dir
count_removal() {
  local group="$1"
  local count="${2:-1}"
  GROUP_FILES_REMOVED[$group]=$(( ${GROUP_FILES_REMOVED[$group]} + count ))
}

safe_rm() {
  local group="$1"
  shift
  for path in "$@"; do
    if [ -f "$path" ]; then
      rm "$path"
      count_removal "$group"
    elif [ -d "$path" ]; then
      local file_count
      file_count=$(find "$path" -type f 2>/dev/null | wc -l | tr -d ' ')
      rm -rf "$path"
      count_removal "$group" "$file_count"
    fi
  done
}

# ── Confirmation ──
if [ "$AUTO_YES" = false ]; then
  echo ""
  echo "================================================================"
  echo "  Strip-to-Core — Remove optional template files"
  echo "================================================================"
  echo ""
  echo "  This will remove:"
  echo "    1. Legal pages (Privacy, Terms)"
  echo "    2. Landing page (redirect / to /signin)"
  echo "    3. Getting-started page"
  echo "    4. Dev-docs app"
  echo "    5. Bilingual guides (docs/guides/)"
  echo "    6. Example domains (docs/examples/)"
  echo ""
  echo "  Core features KEPT: auth, dashboard, API, themes, SEO"
  echo ""
  read -p "  Strip optional template files? This cannot be undone. [y/N] " confirm
  if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "  Aborted."
    exit 0
  fi

  echo ""
  read -p "  Also strip SEO component (<Seo> tags from all pages)? [y/N] " seo_confirm
  if [[ "$seo_confirm" =~ ^[Yy]$ ]]; then
    STRIP_SEO=true
  fi

  read -p "  Also strip extra themes (keep dark only)? [y/N] " theme_confirm
  if [[ "$theme_confirm" =~ ^[Yy]$ ]]; then
    STRIP_THEMES=true
  fi
  echo ""
fi

echo ">>> Starting strip-to-core..."

# ════════════════════════════════════════════════════════
# GROUP 1 — Legal pages
# ════════════════════════════════════════════════════════
if manifest_group_stripped "legal"; then
  echo "  [skip] Legal pages already stripped"
else
  echo "  [1/6] Stripping legal pages..."

  safe_rm legal \
    "client/src/pages/legal/PrivacyPage.tsx" \
    "client/src/pages/legal/TermsPage.tsx" \
    "client/src/pages/legal/LegalLayout.tsx" \
    "client/src/pages/legal/Legal.css" \
    "client/src/pages/legal/__tests__/LegalPages.test.tsx"

  # Remove directories if empty
  rmdir "client/src/pages/legal/__tests__" 2>/dev/null || true
  rmdir "client/src/pages/legal" 2>/dev/null || true

  # Edit App.tsx — remove legal imports and routes
  if [ -f "client/src/App.tsx" ]; then
    if grep -q 'PrivacyPage' "client/src/App.tsx"; then
      sedi '/import PrivacyPage/d' "client/src/App.tsx"
      sedi '/import TermsPage/d' "client/src/App.tsx"
      sedi '/<Route path="\/privacy"/d' "client/src/App.tsx"
      sedi '/<Route path="\/terms"/d' "client/src/App.tsx"
    fi
  fi

  # Edit DashboardLayout.tsx — remove legal links from dropdown
  if [ -f "client/src/components/DashboardLayout.tsx" ]; then
    if grep -q 'to="/terms"' "client/src/components/DashboardLayout.tsx"; then
      python3 -c "
import re

with open('client/src/components/DashboardLayout.tsx', 'r') as f:
    content = f.read()

# Remove the <Link ... to=\"/terms\" ...>...</Link> block
content = re.sub(
    r'\s*<Link\b[^>]*to=\"/terms\"[^>]*>.*?</Link>',
    '',
    content,
    flags=re.DOTALL
)

# Remove the <Link ... to=\"/privacy\" ...>...</Link> block
content = re.sub(
    r'\s*<Link\b[^>]*to=\"/privacy\"[^>]*>.*?</Link>',
    '',
    content,
    flags=re.DOTALL
)

with open('client/src/components/DashboardLayout.tsx', 'w') as f:
    f.write(content)
"
    fi
  fi

  GROUP_STRIPPED[legal]=true
  GROUP_REASON[legal]="stripped"
fi

# ════════════════════════════════════════════════════════
# GROUP 2 — Landing page
# ════════════════════════════════════════════════════════
if manifest_group_stripped "landing"; then
  echo "  [skip] Landing page already stripped"
else
  echo "  [2/6] Stripping landing page..."

  safe_rm landing \
    "client/src/pages/LandingPage.tsx" \
    "client/src/pages/LandingPage.css"

  # Remove LandingPage test
  safe_rm landing "client/src/pages/__tests__/LandingPage.test.tsx"
  rmdir "client/src/pages/__tests__" 2>/dev/null || true

  # Edit App.tsx — remove LandingPage import, change / route to redirect
  if [ -f "client/src/App.tsx" ]; then
    if grep -q 'import LandingPage' "client/src/App.tsx"; then
      sedi '/import LandingPage/d' "client/src/App.tsx"
    fi

    # Change the / route to Navigate redirect
    if grep -q 'element={<LandingPage' "client/src/App.tsx"; then
      sedi 's|<Route path="/" element={<LandingPage />} />|<Route path="/" element={<Navigate to="/signin" replace />} />|' "client/src/App.tsx"
    fi

    # Add Navigate import if not already present
    if ! grep -q 'Navigate' "client/src/App.tsx"; then
      sedi 's|import { Routes, Route }|import { Routes, Route, Navigate }|' "client/src/App.tsx"
    fi
  fi

  # Edit accessibility.test.tsx — remove LandingPage-specific tests
  if [ -f "client/src/tests/a11y/accessibility.test.tsx" ]; then
    if grep -q 'import LandingPage' "client/src/tests/a11y/accessibility.test.tsx"; then
      # Remove LandingPage import
      sedi '/import LandingPage/d' "client/src/tests/a11y/accessibility.test.tsx"

      # Remove LandingPage-specific tests using python3 with brace-counting
      # (regex with .*? fails on nested braces like forEach callbacks)
      python3 << 'PYEOF'
import re

def remove_block(content, start_pattern):
    """Remove a brace-delimited block starting at the line matching start_pattern.
    Handles nested braces correctly by counting { and }."""
    lines = content.split('\n')
    result = []
    i = 0
    while i < len(lines):
        if re.search(start_pattern, lines[i]):
            # Found start — count braces to find end
            brace_depth = 0
            started = False
            # Also remove preceding blank lines / comment lines for this block
            while result and result[-1].strip() == '':
                result.pop()
            while i < len(lines):
                brace_depth += lines[i].count('{') - lines[i].count('}')
                if lines[i].count('{') > 0:
                    started = True
                i += 1
                if started and brace_depth <= 0:
                    break
        else:
            result.append(lines[i])
            i += 1
    return '\n'.join(result)

with open('client/src/tests/a11y/accessibility.test.tsx', 'r') as f:
    content = f.read()

# Remove individual it() blocks that reference LandingPage inside ARIA landmarks describe
content = remove_block(content, r'^\s*it\("LandingPage has main')
content = remove_block(content, r'^\s*it\("LandingPage nav has')
content = remove_block(content, r'^\s*it\("LandingPage footer has')

# Remove the entire LandingPage Icon Accessibility section (comment + describe block)
# First remove the comment line
content = re.sub(r'\n*// ─── LandingPage Icon Accessibility ───\n*', '\n', content)
content = remove_block(content, r'^\s*describe\("LandingPage icon accessibility"')

# Clean up multiple blank lines
content = re.sub(r'\n{3,}', '\n\n', content)

with open('client/src/tests/a11y/accessibility.test.tsx', 'w') as f:
    f.write(content)
PYEOF
    fi
  fi

  GROUP_STRIPPED[landing]=true
  GROUP_REASON[landing]="stripped"
fi

# ════════════════════════════════════════════════════════
# Collateral — LogoMark.tsx (orphaned after groups 1+2)
# ════════════════════════════════════════════════════════
if [ -f "client/src/components/LogoMark.tsx" ]; then
  # Check if anything still imports it
  if ! grep -rq "import.*LogoMark" "client/src/" 2>/dev/null; then
    echo "  [+] Removing orphaned LogoMark.tsx..."
    rm "client/src/components/LogoMark.tsx"
  fi
fi

# ════════════════════════════════════════════════════════
# GROUP 3 — Getting-started page
# ════════════════════════════════════════════════════════
if manifest_group_stripped "getting-started"; then
  echo "  [skip] Getting-started page already stripped"
else
  echo "  [3/6] Stripping getting-started page..."

  safe_rm getting-started \
    "client/src/pages/getting-started/GettingStartedPage.tsx" \
    "client/src/pages/getting-started/GettingStarted.css" \
    "client/src/pages/getting-started/__tests__/GettingStartedPage.test.tsx"

  rmdir "client/src/pages/getting-started/__tests__" 2>/dev/null || true
  rmdir "client/src/pages/getting-started" 2>/dev/null || true

  # Edit App.tsx
  if [ -f "client/src/App.tsx" ]; then
    if grep -q 'import GettingStartedPage' "client/src/App.tsx"; then
      sedi '/import GettingStartedPage/d' "client/src/App.tsx"
    fi
    if grep -q 'getting-started' "client/src/App.tsx"; then
      sedi '/<Route path="\/getting-started"/d' "client/src/App.tsx"
    fi
  fi

  # Edit Makefile — remove getting-started references from go target
  if [ -f "Makefile" ]; then
    if grep -q 'getting-started' "Makefile"; then
      sedi '/getting-started/d' "Makefile"
    fi
  fi

  GROUP_STRIPPED[getting-started]=true
  GROUP_REASON[getting-started]="stripped"
fi

# ════════════════════════════════════════════════════════
# GROUP 4 — Dev-docs app
# ════════════════════════════════════════════════════════
if manifest_group_stripped "dev-docs"; then
  echo "  [skip] Dev-docs already stripped"
else
  echo "  [4/6] Stripping dev-docs app..."

  safe_rm dev-docs "dev-docs"

  # Edit pnpm-workspace.yaml — remove dev-docs entry
  if [ -f "pnpm-workspace.yaml" ]; then
    if grep -q 'dev-docs' "pnpm-workspace.yaml"; then
      sedi '/dev-docs/d' "pnpm-workspace.yaml"
    fi
  fi

  # Edit or remove build-web.sh
  if [ -f "scripts/build-web.sh" ]; then
    # The script primarily merges dev-docs into client dist.
    # After dev-docs removal, simplify it to just build client.
    cat > "scripts/build-web.sh" << 'BUILDEOF'
#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Installing dependencies..."
pnpm install --frozen-lockfile

echo "==> Building client..."
pnpm --filter client build

echo "==> Done! Output: client/dist/"
BUILDEOF
  fi

  # Edit Makefile — remove dev-docs targets and setup-dev-docs from setup
  if [ -f "Makefile" ]; then
    # Remove dev-docs: target
    if grep -q '^dev-docs:' "Makefile"; then
      sedi '/^dev-docs:/,/^$/d' "Makefile"
    fi
    # Remove setup-dev-docs: target
    if grep -q '^setup-dev-docs:' "Makefile"; then
      sedi '/^setup-dev-docs:/,/^$/d' "Makefile"
    fi
    # Remove setup-dev-docs from setup dependency list
    if grep -q 'setup-dev-docs' "Makefile"; then
      sedi 's/ setup-dev-docs//' "Makefile"
    fi
    # Remove setup-dev-docs from .PHONY line
    if grep -q 'setup-dev-docs' "Makefile"; then
      sedi 's/ setup-dev-docs//' "Makefile"
    fi
    # Remove dev-docs from .PHONY line
    if grep -q ' dev-docs' "Makefile"; then
      sedi 's/ dev-docs//' "Makefile"
    fi
  fi

  GROUP_STRIPPED[dev-docs]=true
  GROUP_REASON[dev-docs]="stripped"
fi

# ════════════════════════════════════════════════════════
# GROUP 5 — Bilingual guides
# ════════════════════════════════════════════════════════
if manifest_group_stripped "guides"; then
  echo "  [skip] Guides already stripped"
else
  echo "  [5/6] Stripping bilingual guides..."

  if [ -d "docs/guides" ]; then
    safe_rm guides "docs/guides"
  fi

  GROUP_STRIPPED[guides]=true
  GROUP_REASON[guides]="stripped"
fi

# ════════════════════════════════════════════════════════
# GROUP 6 — Example domains
# ════════════════════════════════════════════════════════
if manifest_group_stripped "examples"; then
  echo "  [skip] Examples already stripped"
else
  echo "  [6/6] Stripping example domains..."

  if [ -d "docs/examples" ]; then
    safe_rm examples "docs/examples"
  fi

  GROUP_STRIPPED[examples]=true
  GROUP_REASON[examples]="stripped"
fi

# ════════════════════════════════════════════════════════
# GROUP 7 — SEO component (optional)
# ════════════════════════════════════════════════════════
if manifest_group_stripped "seo"; then
  echo "  [skip] SEO component already stripped"
elif [ "$STRIP_SEO" = true ]; then
  echo "  [opt] Stripping SEO component..."

  safe_rm seo "client/src/components/Seo.tsx"

  # Remove <Seo> usage and import from remaining pages
  for page_file in \
    "client/src/pages/dashboard/DashboardPage.tsx" \
    "client/src/pages/auth/SignInPage.tsx" \
    "client/src/pages/auth/SignUpPage.tsx" \
    "client/src/pages/auth/ForgotPasswordPage.tsx" \
    "client/src/pages/auth/ResetPasswordPage.tsx" \
    "client/src/pages/auth/VerifyEmailPage.tsx" \
    "client/src/pages/NotFoundPage.tsx"
  do
    if [ -f "$page_file" ]; then
      if grep -q 'import Seo' "$page_file"; then
        sedi '/import Seo/d' "$page_file"
      fi
      if grep -q '<Seo' "$page_file"; then
        # Remove single-line <Seo ... /> tags
        sedi '/<Seo.*\/>/d' "$page_file"
        # Remove multi-line <Seo ... /> tags (opening to closing />)
        sedi '/<Seo$/,/\/>/d' "$page_file"
        # Handle <Seo with attributes on same line but closing on next
        sedi '/<Seo /,/\/>/d' "$page_file"
      fi
    fi
  done

  GROUP_STRIPPED[seo]=true
  GROUP_REASON[seo]="stripped"
else
  GROUP_STRIPPED[seo]=false
  GROUP_REASON[seo]="user_declined"
fi

# ════════════════════════════════════════════════════════
# GROUP 8 — Extra themes (optional)
# ════════════════════════════════════════════════════════
if manifest_group_stripped "extra-themes"; then
  echo "  [skip] Extra themes already stripped"
elif [ "$STRIP_THEMES" = true ]; then
  echo "  [opt] Stripping extra themes (keeping dark only)..."

  # Edit themes.css — remove indigo, navy, sage blocks
  if [ -f "client/src/styles/themes.css" ]; then
    if grep -q 'data-theme="indigo"' "client/src/styles/themes.css"; then
      python3 -c "
import re

with open('client/src/styles/themes.css', 'r') as f:
    content = f.read()

# Remove indigo, navy, sage theme blocks (each starts with a comment and ends before the next comment or EOF)
# Pattern: /* ... INDIGO ... */ through end of its block
content = re.sub(
    r'\n/\* ─+ INDIGO.*?\n\}',
    '',
    content,
    flags=re.DOTALL
)
content = re.sub(
    r'\n/\* ─+ NAVY.*?\n\}',
    '',
    content,
    flags=re.DOTALL
)
content = re.sub(
    r'\n/\* ─+ SAGE.*?\n\}',
    '',
    content,
    flags=re.DOTALL
)

# Clean up trailing whitespace
content = content.rstrip() + '\n'

with open('client/src/styles/themes.css', 'w') as f:
    f.write(content)
"
    fi
  fi

  # Edit ThemeProvider.tsx — simplify to dark + system only
  if [ -f "client/src/components/ThemeProvider.tsx" ]; then
    if grep -q '"indigo"' "client/src/components/ThemeProvider.tsx"; then
      python3 -c "
with open('client/src/components/ThemeProvider.tsx', 'r') as f:
    content = f.read()

# Simplify Theme type
content = content.replace(
    'type Theme = \"dark\" | \"indigo\" | \"navy\" | \"sage\" | \"system\";',
    'type Theme = \"dark\" | \"system\";'
)

# Simplify VALID_THEMES
content = content.replace('''const VALID_THEMES = new Set<string>([
  \"dark\",
  \"indigo\",
  \"navy\",
  \"sage\",
  \"system\",
]);''', '''const VALID_THEMES = new Set<string>([
  \"dark\",
  \"system\",
]);''')

# Simplify resolveTheme — system fallback to dark
content = content.replace(
    'return \"indigo\";',
    'return \"dark\";'
)

# Simplify system media query handler
content = content.replace(
    'e.matches ? \"dark\" : \"indigo\"',
    '\"dark\"'
)

# Simplify THEME_OPTIONS
content = content.replace('''export const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: \"dark\", label: \"Dark\" },
  { value: \"indigo\", label: \"Indigo\" },
  { value: \"navy\", label: \"Navy\" },
  { value: \"sage\", label: \"Sage\" },
  { value: \"system\", label: \"System\" },
];''', '''export const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: \"dark\", label: \"Dark\" },
  { value: \"system\", label: \"System\" },
];''')

with open('client/src/components/ThemeProvider.tsx', 'w') as f:
    f.write(content)
"
    fi
  fi

  GROUP_STRIPPED[extra-themes]=true
  GROUP_REASON[extra-themes]="stripped"
else
  GROUP_STRIPPED[extra-themes]=false
  GROUP_REASON[extra-themes]="user_declined"
fi

# ════════════════════════════════════════════════════════
# GROUP 9 — Epic archives (optional)
# ════════════════════════════════════════════════════════
if manifest_group_stripped "epics"; then
  echo "  [skip] Epic archives already stripped"
elif [ "$STRIP_EPICS" = true ]; then
  echo "  [opt] Stripping epic archive files..."

  if [ -d "docs/epics/archive" ]; then
    safe_rm epics "docs/epics/archive"
  fi

  # Remove individual epic spec files (e*-*.md)
  for f in docs/epics/e*-*.md; do
    [ -e "$f" ] || continue
    rm -f "$f"
    count_removal epics
  done

  GROUP_STRIPPED[epics]=true
  GROUP_REASON[epics]="stripped"
else
  GROUP_STRIPPED[epics]=false
  GROUP_REASON[epics]="user_declined"
fi

# ════════════════════════════════════════════════════════
# Write manifest
# ════════════════════════════════════════════════════════
echo ""
echo ">>> Writing .stripped-manifest.json..."

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

cat > "$MANIFEST" << MANIFESTEOF
{
  "stripped_at": "$TIMESTAMP",
  "version": "1.0",
  "groups": {
    "legal": { "stripped": ${GROUP_STRIPPED[legal]}, "files_removed": ${GROUP_FILES_REMOVED[legal]}$([ "${GROUP_STRIPPED[legal]}" = "false" ] && echo ", \"reason\": \"${GROUP_REASON[legal]}\"" || true) },
    "landing": { "stripped": ${GROUP_STRIPPED[landing]}, "files_removed": ${GROUP_FILES_REMOVED[landing]}$([ "${GROUP_STRIPPED[landing]}" = "false" ] && echo ", \"reason\": \"${GROUP_REASON[landing]}\"" || true) },
    "getting-started": { "stripped": ${GROUP_STRIPPED[getting-started]}, "files_removed": ${GROUP_FILES_REMOVED[getting-started]}$([ "${GROUP_STRIPPED[getting-started]}" = "false" ] && echo ", \"reason\": \"${GROUP_REASON[getting-started]}\"" || true) },
    "dev-docs": { "stripped": ${GROUP_STRIPPED[dev-docs]}, "files_removed": ${GROUP_FILES_REMOVED[dev-docs]}$([ "${GROUP_STRIPPED[dev-docs]}" = "false" ] && echo ", \"reason\": \"${GROUP_REASON[dev-docs]}\"" || true) },
    "guides": { "stripped": ${GROUP_STRIPPED[guides]}, "files_removed": ${GROUP_FILES_REMOVED[guides]}$([ "${GROUP_STRIPPED[guides]}" = "false" ] && echo ", \"reason\": \"${GROUP_REASON[guides]}\"" || true) },
    "examples": { "stripped": ${GROUP_STRIPPED[examples]}, "files_removed": ${GROUP_FILES_REMOVED[examples]}$([ "${GROUP_STRIPPED[examples]}" = "false" ] && echo ", \"reason\": \"${GROUP_REASON[examples]}\"" || true) },
    "seo": { "stripped": ${GROUP_STRIPPED[seo]}, "files_removed": ${GROUP_FILES_REMOVED[seo]}$([ "${GROUP_STRIPPED[seo]}" = "false" ] && echo ", \"reason\": \"${GROUP_REASON[seo]}\"" || true) },
    "extra-themes": { "stripped": ${GROUP_STRIPPED[extra-themes]}, "files_removed": ${GROUP_FILES_REMOVED[extra-themes]}$([ "${GROUP_STRIPPED[extra-themes]}" = "false" ] && echo ", \"reason\": \"${GROUP_REASON[extra-themes]}\"" || true) },
    "epics": { "stripped": ${GROUP_STRIPPED[epics]}, "files_removed": ${GROUP_FILES_REMOVED[epics]}$([ "${GROUP_STRIPPED[epics]}" = "false" ] && echo ", \"reason\": \"${GROUP_REASON[epics]}\"" || true) }
  }
}
MANIFESTEOF

# ════════════════════════════════════════════════════════
# Post-strip verification
# ════════════════════════════════════════════════════════
echo ""
echo ">>> Post-strip verification..."

# Reconcile pnpm lockfile after workspace changes
echo "  [1/3] Reconciling pnpm lockfile..."
if ! pnpm install --no-frozen-lockfile 2>&1; then
  echo "  [FAIL] pnpm install failed. Check pnpm-workspace.yaml."
  exit 1
fi
echo "  [ok] pnpm install succeeded"

# Build
echo "  [2/3] Building client..."
if ! (cd client && pnpm build) 2>&1; then
  echo "  [FAIL] Client build failed. Check for dangling imports."
  exit 1
fi
echo "  [ok] Build succeeded"

# Test
echo "  [3/3] Running client tests..."
if ! (cd client && pnpm test -- --run) 2>&1; then
  echo "  [FAIL] Tests failed. Check for broken test imports."
  exit 1
fi
echo "  [ok] Tests passed"

# ── Summary ──
total_removed=0
for g in legal landing getting-started dev-docs guides examples seo extra-themes epics; do
  total_removed=$(( total_removed + ${GROUP_FILES_REMOVED[$g]} ))
done

echo ""
echo "================================================================"
echo "  Strip-to-Core complete!"
echo ""
echo "  Groups stripped:"
for g in legal landing getting-started dev-docs guides examples seo extra-themes epics; do
  if [ "${GROUP_STRIPPED[$g]}" = "true" ]; then
    echo "    [x] $g (${GROUP_FILES_REMOVED[$g]} files)"
  else
    echo "    [ ] $g (${GROUP_REASON[$g]})"
  fi
done
echo ""
echo "  Total files removed: $total_removed"
echo "  Build: PASS"
echo "  Tests: PASS"
echo "  Manifest: .stripped-manifest.json"
echo "================================================================"
