#!/bin/bash

# Configuration
APP_JAR="/usr/share/java/karedi/Karedi.jar"
LIBERICA_JAVA="/usr/lib/jvm/liberica-jdk-17-full/bin/java"
OPENJFX_LIB="/usr/lib/jvm/java-17-openjdk/lib/javafx"
OPENJFX_AUR_LIB="/usr/share/java/openjfx/lib"

# Required JVM flags for Karedi internals
# (Fixes access to internal JavaFX APIs)
JAVA_FLAGS=(
    "-Djdk.gtk.version=2"
    "--add-exports=javafx.base/com.sun.javafx.event=ALL-UNNAMED"
    "--add-exports=javafx.controls/com.sun.javafx.scene.control.behavior=ALL-UNNAMED"
    "--add-exports=javafx.controls/com.sun.javafx.scene.control=ALL-UNNAMED"
    "--add-exports=javafx.base/com.sun.javafx.binding=ALL-UNNAMED"
    "--add-exports=javafx.graphics/com.sun.javafx.stage=ALL-UNNAMED"
)

# 1. Try Liberica JDK Full (User Preferred / Known Good)
if [ -x "$LIBERICA_JAVA" ]; then
    exec "$LIBERICA_JAVA" "${JAVA_FLAGS[@]}" -jar "$APP_JAR" "$@"
fi

# 2. Fallback: Try System Java
# If standard OpenJDK, we need to manually add JavaFX modules
JAVA_EXEC="java"
MODULE_PATH=""

# Check for OpenJFX libraries if we are likely on OpenJDK
if [ -d "$OPENJFX_LIB" ]; then
    MODULE_PATH="$OPENJFX_LIB"
elif [ -d "$OPENJFX_AUR_LIB" ]; then
    MODULE_PATH="$OPENJFX_AUR_LIB"
fi

# If we found external JavaFX modules, add them
if [ -n "$MODULE_PATH" ]; then
    JAVA_FLAGS+=(
        "--module-path=$MODULE_PATH"
        "--add-modules=javafx.controls,javafx.fxml,javafx.graphics,javafx.base,javafx.media,javafx.web"
    )
fi

# Run with system java
exec "$JAVA_EXEC" "${JAVA_FLAGS[@]}" -jar "$APP_JAR" "$@"
