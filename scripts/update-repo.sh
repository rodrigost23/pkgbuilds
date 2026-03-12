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
    # -R: Remove old package entries when adding newer versions
    repo-add -s --key "$GPGKEY" -q --nocolor -R "$DB_FILE" ./*.pkg.tar.zst

    # GitHub Releases do not support symlinks. repo-add creates 'repo.db' as a 
    # symlink to 'repo.db.tar.gz'. We replace the symlinks with actual copies
    # to ensure pacman gets a valid file regardless of the extension it requests.
    for ext in db files; do
        link="${REPO_NAME}.${ext}"
        if [ -L "$link" ]; then
            target=$(readlink "$link")
            rm "$link"
            cp "$target" "$link"
        fi
        
        sig_link="${link}.sig"
        if [ -L "$sig_link" ]; then
            sig_target=$(readlink "$sig_link")
            rm "$sig_link"
            cp "$sig_target" "$sig_link"
        fi
    done
fi
