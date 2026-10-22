#!/bin/bash
# shellcheck disable=SC2154 # package variables come from the sourced PKGBUILDs
set -e

# Identifies packages requiring build/removal to update the repository index.
# Outputs JSON arrays consumable by GitHub Actions strategy matrices.
#
# What needs building is decided from what is actually published: a package
# is built when the version its PKGBUILD declares is not in the repository
# database. Unlike diffing against a previous run, a package that failed to
# build is retried until it succeeds, and one failing package never causes
# the others to be rebuilt.
#
# A PKGBUILD change that doesn't bump pkgver/pkgrel is not detected; bump
# pkgrel or run the workflow with force_full_rebuild.

to_json_array() {
    echo "$1" | tr ' ' '\n' | grep . | jq -R . | jq -s -c .
}

# Prints "<pkgname> <[epoch:]pkgver-pkgrel> <dynamic>" for each package a
# package directory produces. <dynamic> is 1 when the PKGBUILD computes its
# version in pkgver(), so the declared version can't be compared.
read_pkgbuild() {
    (
        cd "packages/$1"
        # shellcheck disable=SC1091
        source ./PKGBUILD >/dev/null 2>&1 || exit 1
        dynamic=0
        if declare -F pkgver >/dev/null; then dynamic=1; fi
        for name in "${pkgname[@]}"; do
            echo "$name ${epoch:+$epoch:}${pkgver}-${pkgrel} $dynamic"
        done
    )
}

PACKAGE_DIRS=$(find packages/ -mindepth 1 -maxdepth 1 -type d -exec basename {} \; | sort -u)

if [ "$FORCE_FULL_REBUILD" = "true" ]; then
    ADDED="$PACKAGE_DIRS"
    DELETED=""
else
    REPO_NAME=$(jq -r '.repo_name // "rodrigost23"' config.json)
    DB_DIR=$(mktemp -d)
    PUBLISHED=""
    PUBLISHED_NAMES=""

    if gh release download repository -p "${REPO_NAME}.db" -D "$DB_DIR" --repo "$GITHUB_REPOSITORY"; then
        # Entries look like <pkgname>-<[epoch:]pkgver>-<pkgrel>
        PUBLISHED=$(tar -tzf "$DB_DIR/${REPO_NAME}.db" | cut -d/ -f1 | sort -u)
        PUBLISHED_NAMES=$(tar -xzOf "$DB_DIR/${REPO_NAME}.db" --wildcards '*/desc' |
            awk '/^%NAME%$/ { getline; print }' | sort -u)
    else
        echo "No published database found; building all packages." >&2
    fi

    ADDED=""
    PRODUCED_NAMES=""
    PARSE_FAILED=false

    for dir in $PACKAGE_DIRS; do
        if ! info=$(read_pkgbuild "$dir"); then
            echo "Could not read packages/$dir/PKGBUILD; building it." >&2
            ADDED="$ADDED $dir"
            PARSE_FAILED=true
            continue
        fi

        while read -r name version dynamic; do
            PRODUCED_NAMES="$PRODUCED_NAMES $name"
            if [ "$dynamic" = "1" ]; then
                # Version only known after building: build when never published
                if ! echo "$PUBLISHED_NAMES" | grep -qxF "$name"; then
                    ADDED="$ADDED $dir"
                fi
            elif ! echo "$PUBLISHED" | grep -qxF "$name-$version"; then
                echo "$name $version is not published." >&2
                ADDED="$ADDED $dir"
            fi
        done <<<"$info"
    done

    # Packages that are published but no longer produced by any PKGBUILD.
    # Skipped when a PKGBUILD couldn't be read, as its names are unknown.
    # This also covers stale *-debug entries from before debug packages were disabled.
    DELETED=""
    if [ "$PARSE_FAILED" = "false" ]; then
        for name in $PUBLISHED_NAMES; do
            if ! echo "$PRODUCED_NAMES" | tr ' ' '\n' | grep -qxF "$name"; then
                DELETED="$DELETED $name"
            fi
        done
    fi

    ADDED=$(echo "$ADDED" | tr ' ' '\n' | grep . | sort -u || true)
fi

# The keyring package must be rebuilt whenever the signing key metadata changes
# so that the updated public key is distributed to clients.
if [ "$KEY_UPDATED" = "true" ]; then
    ADDED=$(echo -e "$ADDED\nrodrigost23-keyring" | sort -u)
fi

ADDED_JSON=$(to_json_array "$ADDED")
DELETED_JSON=$(to_json_array "$DELETED")

echo "added_or_modified=$ADDED_JSON" >> "$GITHUB_OUTPUT"
echo "deleted=$DELETED_JSON" >> "$GITHUB_OUTPUT"

if [ "$ADDED_JSON" != "[]" ] || [ "$DELETED_JSON" != "[]" ]; then
    echo "run_build=true" >> "$GITHUB_OUTPUT"
else
    echo "run_build=false" >> "$GITHUB_OUTPUT"
fi
