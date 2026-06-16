#!/usr/bin/env bash
# new-domain.sh — scaffold a new CRUD domain for the Next.js app by copying the
# canonical `items` domain and renaming it. Next.js stack (Drizzle + Zod + Server
# Actions + App Router + modal CRUD + <DataTable>). This is what `/athena:domain`
# and `make new-domain NAME=<name>` drive.
#
# Usage:  scripts/new-domain.sh <singular-name> [plural-name]
#   e.g.  scripts/new-domain.sh note            → notes domain
#         scripts/new-domain.sh category categories
#
# Generates (mirroring next-app/.../items):
#   lib/schema/<plural>.ts            Drizzle table (+ barrel export in lib/schema/index.ts)
#   lib/validations/<plural>.ts       shared Zod schemas
#   lib/validations/<plural>.test.ts  Vitest unit test (db-free)
#   actions/<plural>.ts               Server Actions (requireEditor-guarded, ownership-scoped)
#   app/(dashboard)/dashboard/<plural>/{page,_<sg>-dialog,_<sg>-form,_<pl>-table}.tsx
# Then run `pnpm db:generate && pnpm db:migrate` and wire the nav link.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
APP="$ROOT/next-app"

SG="${1:-}"
[ -n "$SG" ] || { echo "Usage: scripts/new-domain.sh <singular-name> [plural-name]  (e.g. note)"; exit 1; }
SG="$(echo "$SG" | tr '[:upper:]' '[:lower:]')"
case "$SG" in *[!a-z]* ) echo "❌ name must be lowercase letters only (got '$SG')"; exit 1 ;; esac

# Plural: explicit 2nd arg, else naive English pluralization.
if [ -n "${2:-}" ]; then
  PL="$(echo "$2" | tr '[:upper:]' '[:lower:]')"
else
  case "$SG" in
    *s|*x|*z|*ch|*sh) PL="${SG}es" ;;
    *y)               PL="${SG%y}ies" ;;
    *)                PL="${SG}s" ;;
  esac
fi

cap() { printf '%s' "$(echo "${1:0:1}" | tr '[:lower:]' '[:upper:]')${1:1}"; }
PS="$(cap "$SG")"   # Pascal singular  (Note)
PP="$(cap "$PL")"   # Pascal plural    (Notes)

ITEMS_DIR="$APP/app/(dashboard)/dashboard/items"
NEW_DIR="$APP/app/(dashboard)/dashboard/$PL"

# ── Guards ───────────────────────────────────────────────────────────────────
[ -f "$APP/lib/schema/items.ts" ] || { echo "❌ canonical items domain not found at $APP/lib/schema/items.ts"; exit 1; }
for f in "$APP/lib/schema/$PL.ts" "$APP/lib/validations/$PL.ts" "$APP/actions/$PL.ts" "$NEW_DIR"; do
  [ -e "$f" ] && { echo "❌ target already exists: $f — pick another name or remove it first."; exit 1; }
done

echo "🌱 Scaffolding domain: $SG (plural: $PL · type: $PS)"

# Ordered identifier/path substitutions. Uses perl (portable \b word boundaries —
# BSD/macOS sed does NOT support \b). Compound identifiers + import paths first; the
# bare \bItem\b type rename runs LAST so it can't corrupt ItemDialog/CreateItemInput/etc.
rename() {
  SG="$SG" PL="$PL" PS="$PS" PP="$PP" perl -pe '
    BEGIN { ($sg,$pl,$ps,$pp) = @ENV{qw/SG PL PS PP/}; }
    s{/dashboard/items}{/dashboard/$pl}g;
    s{/actions/items}{/actions/$pl}g;
    s{/lib/validations/items}{/lib/validations/$pl}g;
    s{_item-dialog}{_${sg}-dialog}g;
    s{_item-form}{_${sg}-form}g;
    s{_items-table}{_${pl}-table}g;
    s{createItemSchema}{create${ps}Schema}g;
    s{updateItemSchema}{update${ps}Schema}g;
    s{CreateItemInput}{Create${ps}Input}g;
    s{UpdateItemInput}{Update${ps}Input}g;
    s{createItem}{create$ps}g;
    s{updateItem}{update$ps}g;
    s{deleteItem}{delete$ps}g;
    s{items_user_id_idx}{${pl}_user_id_idx}g;
    s{itemsTable}{${pl}Table}g;
    s{ItemsTable}{${pp}Table}g;
    s{ItemDialog}{${ps}Dialog}g;
    s{ItemForm}{${ps}Form}g;
    s{"items"}{"$pl"}g;
    s{\bItem\b}{$ps}g;
  '
}

# ── Copy + rename the data layer ──────────────────────────────────────────────
rename < "$APP/lib/schema/items.ts"       > "$APP/lib/schema/$PL.ts"
rename < "$APP/lib/validations/items.ts"  > "$APP/lib/validations/$PL.ts"
rename < "$APP/actions/items.ts"          > "$APP/actions/$PL.ts"

# ── Copy + rename the UI ──────────────────────────────────────────────────────
mkdir -p "$NEW_DIR"
rename < "$ITEMS_DIR/page.tsx"          > "$NEW_DIR/page.tsx"
rename < "$ITEMS_DIR/_item-dialog.tsx"  > "$NEW_DIR/_$SG-dialog.tsx"
rename < "$ITEMS_DIR/_item-form.tsx"    > "$NEW_DIR/_$SG-form.tsx"
rename < "$ITEMS_DIR/_items-table.tsx"  > "$NEW_DIR/_$PL-table.tsx"

# ── Barrel export (drizzle.config reads lib/schema/index.ts) ──────────────────
BARREL="$APP/lib/schema/index.ts"
if ! grep -q "\"./$PL\"" "$BARREL"; then
  printf 'export * from "./%s"\n' "$PL" >> "$BARREL"
fi

# ── A db-free Vitest unit test for the validation schema ──────────────────────
cat > "$APP/lib/validations/$PL.test.ts" <<EOF
import { describe, expect, it } from "vitest"

import { create${PS}Schema } from "./$PL"

describe("create${PS}Schema", () => {
  it("accepts a valid title", () => {
    expect(create${PS}Schema.safeParse({ title: "Hello" }).success).toBe(true)
  })
  it("rejects an empty title", () => {
    expect(create${PS}Schema.safeParse({ title: "" }).success).toBe(false)
  })
  it("rejects a title over 255 chars", () => {
    expect(create${PS}Schema.safeParse({ title: "x".repeat(256) }).success).toBe(false)
  })
})
EOF

echo ""
echo "✅ Scaffolded the '$PL' domain:"
echo "   lib/schema/$PL.ts · lib/validations/$PL.ts (+ test) · actions/$PL.ts"
echo "   app/(dashboard)/dashboard/$PL/{page,_$SG-dialog,_$SG-form,_$PL-table}.tsx"
echo "   barrel export added to lib/schema/index.ts"
echo ""
echo "Next steps (from next-app/):"
echo "   1. pnpm db:generate && pnpm db:migrate   # create the '$PL' table"
echo "   2. add a sidebar link in components/app-sidebar.tsx → /dashboard/$PL"
echo "   3. pnpm typecheck && pnpm lint && pnpm test"
echo "   (customise the columns/fields beyond 'title' in lib/schema/$PL.ts + the Zod schema + the form.)"
