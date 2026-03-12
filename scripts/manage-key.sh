#!/bin/bash
set -e

# Manages the GPG signing key for the repository.
# Generates a new key if absent, or extends the expiration of an existing key.

if [ -z "$ENCRYPTION_KEY" ]; then
    echo "Error: ENCRYPTION_KEY environment variable is required."
    exit 1
fi

GPG_EMAIL=$(jq -r '.email // "github-action@users.noreply.github.com"' config.json)
GPG_NAME=$(jq -r '.name // "GitHub Action"' config.json)
ENC_GPG_PATH=$(jq -r '.enc_gpg // "key.gpg.enc"' config.json)
PUB_GPG_PATH=$(jq -r '.pub_gpg // "public.gpg"' config.json)

KEY_UPDATED=false

if [ ! -f "$ENC_GPG_PATH" ]; then
    echo "Generating new GPG key..."
    gpg --full-generate-key --expert --batch <<EOF
%no-protection
Key-Type: eddsa
Key-Curve: Ed25519
Key-Usage: sign
Name-Real: $GPG_NAME
Name-Email: $GPG_EMAIL
Expire-Date: 2y
%commit
EOF
    KEY_UPDATED=true
else
    echo "Importing existing GPG key..."
    openssl aes-256-cbc -d -a -pbkdf2 -in "$ENC_GPG_PATH" -pass pass:"$ENCRYPTION_KEY" | gpg --import
    
    if [ -f "$PUB_GPG_PATH" ]; then
        cat "$PUB_GPG_PATH" | gpg --import
    fi

    KEYID=$(gpg --list-secret-keys --with-colons "$GPG_EMAIL" | grep '^sec' | cut -d: -f5)
    EXPIRY=$(gpg --list-secret-keys --with-colons "$GPG_EMAIL" | grep '^sec' | cut -d: -f7)
    NOW=$(date +%s)
    
    if [ -n "$EXPIRY" ]; then
        THRESHOLD=$((NOW + 5184000)) # 60 days
        if [ "$NOW" -ge "$EXPIRY" ] || [ "$EXPIRY" -lt "$THRESHOLD" ]; then
            echo "Extending key expiration by 2 years..."
            gpg --batch --command-fd 0 --edit-key "$KEYID" <<EOF
expire
2y
key 1
expire
2y
save
EOF
            KEY_UPDATED=true
        else
            echo "Key is valid until $(date -d @"$EXPIRY")."
        fi
    fi
fi

if [ "$KEY_UPDATED" = "true" ]; then
    echo "Exporting and persisting updated keys..."
    KEYID=$(gpg --list-secret-keys --with-colons "$GPG_EMAIL" | grep '^sec' | cut -d: -f5)
    
    gpg --armor --export-secret-key "$KEYID" | \
        openssl aes-256-cbc -a -salt -pbkdf2 -out "$ENC_GPG_PATH" -pass pass:"$ENCRYPTION_KEY"
    
    gpg --batch --output "$PUB_GPG_PATH" --armor --export "$KEYID"
    
    git config --local user.email "github-actions[bot]@users.noreply.github.com"
    git config --local user.name "github-actions[bot]"
    git add "$ENC_GPG_PATH" "$PUB_GPG_PATH"
    
    if [ -n "$(git status --porcelain "$ENC_GPG_PATH" "$PUB_GPG_PATH")" ]; then
        git commit -m "chore: update GPG signing key expiration"
        git push origin HEAD
    else
        echo "No changes detected in key files."
    fi
fi

echo "key_updated=$KEY_UPDATED" >> "$GITHUB_OUTPUT"
