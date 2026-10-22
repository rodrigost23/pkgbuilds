#!/bin/bash
set -ex
pacman-key --init

# Trust the repository's signing key so packages from our own repo (see
# pacman.conf) can be installed as dependencies. Same steps as the README.
KEYRING_KEY=packages/rodrigost23-keyring/public.gpg
if [ -f "$KEYRING_KEY" ]; then
fingerprint=$(gpg --show-keys --with-colons "$KEYRING_KEY" | awk -F: '/^fpr/ {print $10; exit}')
pacman-key --add "$KEYRING_KEY"
pacman-key --lsign-key "$fingerprint"
fi

pacman -Syuq --noconfirm --noprogressbar --ignore linux --ignore linux-firmware --needed

og=$(stat -c '%u:%g' .)
od=$(pwd)
chown -R build: .

if [ ! -z "${SECRET}" ]; then
openssl aes-256-cbc -d -a -pbkdf2 -in "${GPG_FILE}" -pass pass:"${SECRET}" | sudo -u build gpg --import
unset GPG_FILE
unset SECRET
fi

cd "$1"
shift
# The command arrives as a single argument (see action.yml), so it must be word-split
# shellcheck disable=SC2068
sudo -u build --preserve-env=PACKAGER,GPGKEY,REPO_NAME,DELETED_PACKAGES $@

cd "$od"
chown -R "$og" .