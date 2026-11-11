#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
command -v xcodebuild >/dev/null || { printf '%s\n' 'macOS and Xcode are required; this is an iOS source project, not a signed IPA.' >&2; exit 1; }
bash prepare-assets.sh
if [ "${1:-}" = simulator ]; then
 xcodebuild -project AliMirza.xcodeproj -scheme AliMirza -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath build CODE_SIGNING_ALLOWED=NO build
else
 : "${APPLE_TEAM_ID:?Set APPLE_TEAM_ID to your Apple developer team ID}"
 xcodebuild -project AliMirza.xcodeproj -scheme AliMirza -configuration Release -destination 'generic/platform=iOS' -archivePath build/AliMirza.xcarchive DEVELOPMENT_TEAM="$APPLE_TEAM_ID" -allowProvisioningUpdates archive
 printf '%s\n' 'Open the archive in Xcode Organizer and export using your App Store, Ad Hoc or development provisioning profile.'
fi
