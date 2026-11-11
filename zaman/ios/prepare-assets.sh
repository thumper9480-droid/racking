#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
# Standard Apple build asset conversion, preserving the approved launcher artwork.
sips -z 1024 1024 ../logo.png --out AliMirza/Assets.xcassets/AppIcon.appiconset/AppIcon.png
