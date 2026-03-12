#!/bin/bash
set -ex
pacman-key --init
pacman -Syuq --noconfirm --noprogressbar --ignore linux --ignore linux-firmware --needed

og=$(stat -c '%u:%g' .)
od=$(pwd)
chown -R build: .

if [ ! -z "${SECRET}" ]; then
openssl aes-256-cbc -d -a -pbkdf2 -in ${GPG_FILE} -pass pass:${SECRET} | sudo -u build gpg --import
unset GPG_FILE
unset SECRET
fi

cd $1
shift
sudo -u build --preserve-env=PACKAGER,GPGKEY,REPO_NAME,DELETED_PACKAGES "$@"

cd "$od"
chown -R "$og" .