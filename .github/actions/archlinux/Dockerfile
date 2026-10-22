FROM archlinux:base-devel

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x entrypoint.sh

RUN pacman-key --init && pacman-key --populate archlinux && pacman -Syuq --noconfirm  --noprogressbar --ignore linux --ignore linux-firmwre --needed base-devel devtools dbus sudo && rm -rf /var/cache/pacman/pkg/* /var/lib/pacman/sync/*

RUN echo "OPTIONS+=(!debug)" >> /etc/makepkg.conf

# Our own published repository, so packages can depend on each other
# (`makepkg -s` installs makedepends/depends from here). Listed last so the
# official repositories win on name clashes.
RUN printf '\n[rodrigost23]\nSigLevel = Optional TrustAll\nServer = https://github.com/rodrigost23/pkgbuilds/releases/download/repository\n' >> /etc/pacman.conf

RUN dbus-uuidgen --ensure=/etc/machine-id && groupadd -f -r wheel && useradd -m -G wheel -s /bin/bash build && (echo "%wheel ALL=(ALL) NOPASSWD: ALL" > /etc/sudoers.d/wheel)

ENTRYPOINT ["/entrypoint.sh"]