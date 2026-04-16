#!/bin/bash
SYSTEM_APP_DIR="/usr/lib/jellyfin2samsung"
USER_DATA_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/jellyfin2samsung"

# Ensure writable paths exist in the user data directory.
# We copy default content from the system directory to initialize them.
for item in "Logs" "Downloads" "Assets" "settings.json"; do
    target="$USER_DATA_DIR/$item"
    
    # Remove stale symlinks from previous iteration attempts
    [ -L "$target" ] && rm "$target"

    if [ ! -e "$target" ]; then
        mkdir -p "$(dirname "$target")"
        
        if [ -d "$SYSTEM_APP_DIR/$item" ]; then
            mkdir -p "$target"
            # Archive mode (-a) preserves permissions and execution bits
            cp -an "$SYSTEM_APP_DIR/$item/." "$target/" 2>/dev/null || true
            chmod -R u+w "$target" 2>/dev/null || true
        elif [ -f "$SYSTEM_APP_DIR/$item" ]; then
            cp -an "$SYSTEM_APP_DIR/$item" "$target"
            chmod u+w "$target" 2>/dev/null || true
        else
            [[ "$item" == "settings.json" ]] && touch "$target" || mkdir -p "$target"
        fi
    fi
done

# Configure bubblewrap for GUI and hardware acceleration.
# We use --bind / / to allow standard user permissions for file access.
# Redirections ensure the app's state stays in the user's data directory.
BWRAP_ARGS=(
    --bind / /
    --dev-bind /dev /dev  # Required for DRI/DRM hardware acceleration
    --proc /proc
    --tmpfs /tmp
    --tmpfs /run
    --ro-bind "$SYSTEM_APP_DIR" "$SYSTEM_APP_DIR"
    --bind "$USER_DATA_DIR/Assets" "$SYSTEM_APP_DIR/Assets"
    --bind "$USER_DATA_DIR/Logs" "$SYSTEM_APP_DIR/Logs"
    --bind "$USER_DATA_DIR/Downloads" "$SYSTEM_APP_DIR/Downloads"
    --bind "$USER_DATA_DIR/settings.json" "$SYSTEM_APP_DIR/settings.json"
    --bind "$USER_DATA_DIR" "$USER_DATA_DIR"
    --setenv XDG_DATA_HOME "$USER_DATA_DIR"
    --share-net
    --die-with-parent
)

# X11 Display Server support
[ -d /tmp/.X11-unix ] && BWRAP_ARGS+=(--bind /tmp/.X11-unix /tmp/.X11-unix)
[ -n "$XAUTHORITY" ] && [ -f "$XAUTHORITY" ] && BWRAP_ARGS+=(--bind "$XAUTHORITY" "$XAUTHORITY")

# Wayland Compositor support
[ -n "$XDG_RUNTIME_DIR" ] && BWRAP_ARGS+=(--bind "$XDG_RUNTIME_DIR" "$XDG_RUNTIME_DIR")

exec bwrap "${BWRAP_ARGS[@]}" "$SYSTEM_APP_DIR/Jellyfin2Samsung" "$@"
