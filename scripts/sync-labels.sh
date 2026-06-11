#!/usr/bin/env bash
# Apply .github/labels.yml to the GitHub repo (idempotent create-or-update).
#
# Requires: gh (authenticated), yq OR python3 (for YAML parsing). Falls back to
# python3 since it ships everywhere. Run from anywhere inside the repo.
#
#     scripts/sync-labels.sh            # create/update goal + triage labels
#
# Existing labels are updated in place; nothing is deleted. Safe to re-run.
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
labels_file="$repo_root/.github/labels.yml"

if [[ ! -f "$labels_file" ]]; then
  echo "error: $labels_file not found" >&2
  exit 1
fi

# Emit "name<TAB>color<TAB>description" rows for every label in the file.
rows="$(python3 - "$labels_file" <<'PY'
import sys, yaml
with open(sys.argv[1]) as f:
    doc = yaml.safe_load(f)
for group in ("goals", "triage"):
    for label in doc.get(group, []) or []:
        print("\t".join([label["name"], label["color"], label.get("description", "")]))
PY
)"

while IFS=$'\t' read -r name color desc; do
  [[ -z "$name" ]] && continue
  if gh label create "$name" --color "$color" --description "$desc" >/dev/null 2>&1; then
    echo "created  $name"
  else
    gh label edit "$name" --color "$color" --description "$desc" >/dev/null
    echo "updated  $name"
  fi
done <<< "$rows"

echo "done — labels synced from .github/labels.yml"
