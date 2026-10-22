#!/bin/bash

# Sanity checks for every PKGBUILD under packages/ (and the container smoke
# test package): it parses, it sources
# cleanly, it defines the mandatory variables, and every source array has a
# checksum array of the same length. Run from the repository root.

fail=0

for pkgbuild in packages/*/PKGBUILD .github/actions/archlinux/test/PKGBUILD; do
    dir=$(dirname "$pkgbuild")

    if ! bash -n "$pkgbuild"; then
        echo "::error file=$pkgbuild::syntax error"
        fail=1
        continue
    fi

    # Sourcing runs the PKGBUILD's top-level code, as makepkg does
    if ! problems=$(
        cd "$dir" || exit 1
        # shellcheck disable=SC1091
        source ./PKGBUILD >/dev/null 2>&1 || {
            echo "could not be sourced"
            exit 0
        }

        for var in pkgname pkgver pkgrel arch; do
            declare -n ref="$var"
            [ -n "${ref[*]}" ] || echo "$var is not defined"
        done

        for var in $(compgen -A variable | grep -E '^source(_.+)?$'); do
            declare -n sources="$var"
            suffix=${var#source}
            matched=false
            for algo in md5 sha1 sha224 sha256 sha384 sha512 b2 ck; do
                declare -n sums="${algo}sums${suffix}"
                if [ "${#sums[@]}" -eq "${#sources[@]}" ] && [ "${#sums[@]}" -gt 0 ]; then
                    matched=true
                fi
            done
            $matched || echo "$var has ${#sources[@]} entries but no checksum array of that length"
        done
    ); then
        problems="failed to run the checks"
    fi

    if [ -n "$problems" ]; then
        while IFS= read -r problem; do
            echo "::error file=$pkgbuild::$problem"
        done <<<"$problems"
        fail=1
    else
        echo "ok: $pkgbuild"
    fi
done

exit "$fail"
