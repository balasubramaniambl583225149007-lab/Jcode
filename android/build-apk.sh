#!/usr/bin/env bash
set -e

export ANDROID_DATA=/tmp
export ANDROID_ROOT=/system

BUILD_TOOLS="/root/android-sdk/build-tools/35.0.0"
PLATFORM="/root/android-sdk/platforms/android-36/android.jar"
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT_APK="/workspace/jcode/jcode.apk"

cd "$ROOT_DIR"
rm -rf build
mkdir -p build/classes

echo "==> Step 1: Compiling Android resources with aapt..."
"$BUILD_TOOLS/aapt" package -f -m \
    -J src \
    -M AndroidManifest.xml \
    -S res \
    -I "$PLATFORM"

echo "==> Step 2: Compiling Java classes with javac..."
javac -d build/classes \
    -cp "$PLATFORM" \
    src/com/jcode/app/*.java

echo "==> Step 3: Compiling DEX bytecode with d8..."
"$BUILD_TOOLS/d8" \
    --lib "$PLATFORM" \
    --output build/ \
    build/classes/com/jcode/app/*.class

echo "==> Step 4: Packaging resources & web assets into APK with aapt..."
"$BUILD_TOOLS/aapt" package -f \
    -M AndroidManifest.xml \
    -S res \
    -A assets \
    -I "$PLATFORM" \
    -F build/unaligned.apk

echo "==> Step 5: Adding classes.dex to APK..."
cd build
"$BUILD_TOOLS/aapt" add unaligned.apk classes.dex
cd "$ROOT_DIR"

echo "==> Step 6: Aligning APK with zipalign..."
"$BUILD_TOOLS/zipalign" -f -p 4 build/unaligned.apk build/aligned.apk

echo "==> Step 7: Generating signing keystore..."
if [ ! -f build/release.keystore ]; then
    keytool -genkey -v \
        -keystore build/release.keystore \
        -alias jcode \
        -keyalg RSA \
        -keysize 2048 \
        -validity 10000 \
        -storepass jcode123 \
        -keypass jcode123 \
        -dname "CN=jcode Studio, OU=Mobile, O=jcode, L=San Francisco, ST=CA, C=US"
fi

echo "==> Step 8: Signing APK with apksigner (v1, v2, v3, v4)..."
"$BUILD_TOOLS/apksigner" sign \
    --ks build/release.keystore \
    --ks-key-alias jcode \
    --ks-pass pass:jcode123 \
    --key-pass pass:jcode123 \
    --out "$OUTPUT_APK" \
    build/aligned.apk

echo "==> Step 9: Verifying APK signature..."
"$BUILD_TOOLS/apksigner" verify -v "$OUTPUT_APK"

echo "=========================================================="
echo "  SUCCESS! APK generated at: $OUTPUT_APK"
ls -lh "$OUTPUT_APK"
echo "=========================================================="
