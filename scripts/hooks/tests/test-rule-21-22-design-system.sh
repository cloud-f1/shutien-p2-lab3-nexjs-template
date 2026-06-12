#!/bin/bash
# Test fixtures for Rule 21 + Rule 22 — Design System Enforcement (E176)
#
# Rule 21: blocks new files staged at client/src/pages/**/*.css
# Rule 22: blocks added selectors in client/src/styles/common/*.css
#
# Pattern: each test creates an isolated temp git repo, stages a fixture
# tree, and runs stop-verifier.sh expecting the documented exit code.

set -e

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
STOP_VERIFIER="$REPO_ROOT/scripts/hooks/stop-verifier.sh"

PASS=0
FAIL=0

# Run the verifier inside an isolated repo. Caller stages files + sets
# $expected_exit. Stdout/stderr captured for diagnostics.
run_case() {
  local name="$1"
  local expected_exit="$2"
  local setup_fn="$3"

  local tmpdir
  tmpdir=$(mktemp -d)
  (
    cd "$tmpdir"
    git init -q
    git config user.email test@test.example
    git config user.name Test
    # Initial empty commit so HEAD exists for diff vs origin/main lookups
    # (rules 19/20 reference origin/main, but we don't trip those without
    # the relevant changes — keep init minimal).
    git commit -q --allow-empty -m "init"
    # Stay on main — rules 18/19/20 only fire on feat/e* branches.
    "$setup_fn"
  )

  local actual_exit
  set +e
  (cd "$tmpdir" && bash "$STOP_VERIFIER") > /tmp/rule21-22-out.$$.txt 2>&1
  actual_exit=$?
  set -e

  if [ "$actual_exit" = "$expected_exit" ]; then
    echo "  ✅ $name"
    PASS=$((PASS + 1))
  else
    echo "  ❌ $name — expected exit $expected_exit, got $actual_exit"
    sed 's/^/      /' /tmp/rule21-22-out.$$.txt
    FAIL=$((FAIL + 1))
  fi

  rm -f /tmp/rule21-22-out.$$.txt
  rm -rf "$tmpdir"
}

# ----- Rule 21 fixtures -----

setup_rule_21_new_page_css() {
  mkdir -p client/src/pages/foo
  cat > client/src/pages/foo/Foo.css <<EOF
.foo { color: red; }
EOF
  git add client/src/pages/foo/Foo.css
}

setup_rule_21_modify_existing_page_css() {
  # Pre-existing file (committed) — modification is allowed.
  mkdir -p client/src/pages/dashboard
  cat > client/src/pages/dashboard/Dashboard.css <<EOF
.legacy { color: blue; }
EOF
  git add client/src/pages/dashboard/Dashboard.css
  git commit -q -m "seed"
  echo ".legacy { color: green; }" > client/src/pages/dashboard/Dashboard.css
  git add client/src/pages/dashboard/Dashboard.css
}

setup_rule_21_new_styles_css_allowed() {
  # New CSS in styles/themes/ etc. is fine — only pages/ is blocked.
  mkdir -p client/src/styles
  cat > client/src/styles/new-theme.css <<EOF
[data-theme="orange"] { --primary: orange; }
EOF
  git add client/src/styles/new-theme.css
}

setup_rule_21_new_components_css_allowed() {
  # Co-located component CSS is allowed (DashboardLayout exception).
  mkdir -p client/src/components
  cat > client/src/components/Widget.css <<EOF
.widget { padding: 4px; }
EOF
  git add client/src/components/Widget.css
}

# ----- Rule 22 fixtures -----

setup_rule_22_add_selector_in_common() {
  # Pre-existing file (committed); new selector added.
  mkdir -p client/src/styles/common
  cat > client/src/styles/common/forms.css <<EOF
.form-field { display: block; }
EOF
  git add client/src/styles/common/forms.css
  git commit -q -m "seed"
  cat >> client/src/styles/common/forms.css <<EOF
.foo { color: red; }
EOF
  git add client/src/styles/common/forms.css
}

setup_rule_22_trim_existing_rule() {
  # Pre-existing file with two rules; trim one — should not trip.
  mkdir -p client/src/styles/common
  cat > client/src/styles/common/forms.css <<EOF
.form-field { display: block; }
.form-field-old { color: gray; }
EOF
  git add client/src/styles/common/forms.css
  git commit -q -m "seed"
  cat > client/src/styles/common/forms.css <<EOF
.form-field { display: block; }
EOF
  git add client/src/styles/common/forms.css
}

setup_rule_22_modify_body_only() {
  # Add lines INSIDE an existing rule (no new selector) — should not trip.
  mkdir -p client/src/styles/common
  cat > client/src/styles/common/forms.css <<EOF
.form-field {
  display: block;
}
EOF
  git add client/src/styles/common/forms.css
  git commit -q -m "seed"
  cat > client/src/styles/common/forms.css <<EOF
.form-field {
  display: block;
  color: red;
}
EOF
  git add client/src/styles/common/forms.css
}

setup_rule_22_new_file_in_common() {
  # A new file in styles/common/ with rules — definitely a violation.
  mkdir -p client/src/styles/common
  cat > client/src/styles/common/cards.css <<EOF
.card { border: 1px solid; }
EOF
  git add client/src/styles/common/cards.css
}

setup_rule_22_unrelated_styles_dir() {
  # Adding a selector in styles/ (non-common/) is fine for Rule 22.
  mkdir -p client/src/styles
  cat > client/src/styles/themes.css <<EOF
[data-theme="dark"] { --bg: #000; }
EOF
  git add client/src/styles/themes.css
  git commit -q -m "seed"
  cat >> client/src/styles/themes.css <<EOF
[data-theme="forest"] { --bg: #032; }
EOF
  git add client/src/styles/themes.css
}

# ----- Run them -----

echo "=== Rule 21: No new page-co-located CSS (E176) ==="
run_case "fail when new client/src/pages/foo/Foo.css is staged" "2" setup_rule_21_new_page_css
run_case "pass when modifying existing pages/**/*.css"          "0" setup_rule_21_modify_existing_page_css
run_case "pass when new CSS is in styles/ (not pages/)"         "0" setup_rule_21_new_styles_css_allowed
run_case "pass when new CSS is in components/ (not pages/)"     "0" setup_rule_21_new_components_css_allowed

echo ""
echo "=== Rule 22: No new rules in styles/common/ (E176) ==="
run_case "fail when new selector appended to common/forms.css"  "2" setup_rule_22_add_selector_in_common
run_case "pass when trimming an existing rule from common/"     "0" setup_rule_22_trim_existing_rule
run_case "pass when adding only body lines (no new selector)"   "0" setup_rule_22_modify_body_only
run_case "fail when a new file is added under styles/common/"   "2" setup_rule_22_new_file_in_common
run_case "pass when adding a selector outside styles/common/"   "0" setup_rule_22_unrelated_styles_dir

echo ""
echo "Passed: $PASS | Failed: $FAIL"
[ "$FAIL" = "0" ] || exit 1
