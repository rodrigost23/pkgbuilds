#!/bin/bash
set -e

# Identifies packages requiring build/removal to update the repository index.
# Outputs JSON arrays consumable by GitHub Actions strategy matrices.

to_json_array() {
    echo "$1" | tr ' ' '\n' | grep . | jq -R . | jq -s -c .
}

if [ "$FORCE_FULL_REBUILD" = "true" ]; then
    ADDED=$(find packages/ -mindepth 1 -maxdepth 1 -type d -exec basename {} \; | sort -u)
    DELETED=""
else
    # Diffing against the last successful workflow run rather than the previous commit
    # ensures that changes from intermediate failed runs are not silently skipped.
    LAST_SUCCESS_SHA=$(gh run list --workflow "Sync Repository" --status success --limit 1 --json headSha --jq '.[0].headSha' || echo "")
    
    if [ -z "$LAST_SUCCESS_SHA" ]; then
        ADDED=$(find packages/ -mindepth 1 -maxdepth 1 -type d -exec basename {} \; | sort -u)
        DELETED=""
    else
        ADDED=$(git diff --name-only --diff-filter=AM "$LAST_SUCCESS_SHA" HEAD -- packages/ | cut -d/ -f2 | sort -u)
        DELETED=$(git diff --name-only --diff-filter=D "$LAST_SUCCESS_SHA" HEAD -- packages/ | cut -d/ -f2 | sort -u)
    fi
fi

# The keyring package must be rebuilt whenever the signing key metadata changes
# so that the updated public key is distributed to clients.
if [ "$KEY_UPDATED" = "true" ]; then
    ADDED=$(echo -e "$ADDED\nrodrigost23-keyring" | sort -u)
fi

# Sanitize added list to ensure no deleted packages remain if conflicting states exist
for pkg in $DELETED; do
    ADDED=$(echo "$ADDED" | grep -v "^$pkg$" || true)
done

ADDED_JSON=$(to_json_array "$ADDED")
DELETED_JSON=$(to_json_array "$DELETED")

echo "added_or_modified=$ADDED_JSON" >> "$GITHUB_OUTPUT"
echo "deleted=$DELETED_JSON" >> "$GITHUB_OUTPUT"

if [ "$ADDED_JSON" != "[]" ] || [ "$DELETED_JSON" != "[]" ]; then
    echo "run_build=true" >> "$GITHUB_OUTPUT"
else
    echo "run_build=false" >> "$GITHUB_OUTPUT"
fi
