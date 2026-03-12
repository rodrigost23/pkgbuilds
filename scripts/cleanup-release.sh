#!/bin/bash
set -e

# Identifies and deletes older package versions from the GitHub Release
# to manage storage limits and prevent unbound growth.

ALL_ASSETS=$(gh release view repository --json assets --jq '.assets[].name' --repo "$GITHUB_REPOSITORY")

NEW_PKGS=$(find . -maxdepth 1 -name "*.pkg.tar.zst" -type f -printf "%f\n" 2>/dev/null || true)

for pkg_file in $NEW_PKGS; do
    PKG_BASE_NAME=$(echo "$pkg_file" | sed -E 's/-[0-9].*//')
    OLD_VERSIONS=$(echo "$ALL_ASSETS" | grep "^${PKG_BASE_NAME}-" | grep -v "^${pkg_file}" | grep -v "^${pkg_file}.sig" || true)
    
    for old_file in $OLD_VERSIONS; do
        gh release delete-asset repository "$old_file" -y --repo "$GITHUB_REPOSITORY" || true
    done
done
