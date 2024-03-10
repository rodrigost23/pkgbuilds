# PKGBUILDs

Use GitHub Actions for building and packaging a few [AUR](https://aur.archlinux.org) packages and deploy them to [GitHub Releases](https://github.com/rodrigost23/pkgbuilds/releases) so it can be used as a repository in [Arch Linux](https://www.archlinux.org).  Based on [djpohly/PKGBUILD](https://github.com/djpohly/PKGBUILD).

## Using as a pacman repository

To use as custom repository in [Arch Linux](https://www.archlinux.org), add to file `/etc/pacman.conf`:

```ini
[rodrigost23]
SigLevel = Optional TrustAll
Server = https://github.com/rodrigost23/pkgbuilds/releases/download/repository
```

## Customizing

To build AUR packages of your own selection, fork this repository.  The main branch contains most of the build actions.

- Fork this GitHub repository.
- Add Secrets (Pick one)
  - Set REPO_TOKEN with a private token
  - Set ENCRYPTION_KEY for actions and dependabot
- Change config.json
- Optional: create custom keyring package (Feel free to use mine as a reference)

## config.json default values (all values are optional)

```json
{
    "enc_gpg": "key.gpg.enc",
    "pub_gpg": "public.gpg",
    "name": "GitHub Action",
    "email": "github-action@users.noreply.github.com",
    "repo_name": "${{ github.repository_owner }}"
}
```

## Install signing key

Download [public.gpg](rodrigost23-keyring/public.gpg) and run:

```shell
pacman-key -a public.gpg
pacman-key --lsign-key $(gpg --show-keys --keyid-format=long public.gpg | grep 'pub' | awk 'match($2,/[A-Z0-9]{16}/){print substr($2,RSTART,RLENGTH)}')
```
