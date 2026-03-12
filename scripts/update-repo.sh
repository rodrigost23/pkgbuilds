#!/bin/bash
set -e

# Updates the Arch Linux repository database index.
# Intended to be run within the context of the Arch Linux docker container.

if [ -z "$REPO_NAME" ]; then
    echo "Error: REPO_NAME environment variable is not set."
    exit 1
fi

# We must ensure the signing key is available in the current user's keyring
if [ -n "$SECRET" ] && [ -f "$GPGKEY" ]; then
    echo "Importing signing key..."
    openssl aes-256-cbc -d -a -pbkdf2 -in "$GPGKEY" -pass pass:"$SECRET" | gpg --import
fi

DB_FILE="${REPO_NAME}.db.tar.gz"

if [ -n "$DELETED_PACKAGES" ] && [ "$DELETED_PACKAGES" != "[]" ]; then
    # Parse JSON array without jq dependency
    PKGS_TO_REMOVE=$(echo "$DELETED_PACKAGES" | tr -d '\[\]",')
    for pkg in $PKGS_TO_REMOVE; do
        if [ -f "$DB_FILE" ]; then
            repo-remove -q "$DB_FILE" "$pkg" || echo "Package $pkg not found in DB."
        fi
    done
fi

NEW_PKGS=$(find . -maxdepth 1 -name "*.pkg.tar.zst" -type f -printf "%f\n" 2>/dev/null || true)
if [ -n "$NEW_PKGS" ]; then
    # -s: Sign the database
    # -n: Only add new packages (skip existing)
    # -R: Remove old package entries when adding newer versions
    repo-add -s --key "$GPGKEY" -q --nocolor -n -R "$DB_FILE" ./*.pkg.tar.zst
fi
