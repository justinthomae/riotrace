#!/usr/bin/env bash
# Compile-checks the drop-in outside Unity (needs mono's mcs) and runs the logic tests.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
src="$here/../CrossGameInvites"
out="$(mktemp -d)"
trap 'rm -rf "$out"' EXIT

# Logic assembly must not depend on UnityEngine.
mcs -nologo -warnaserror -target:library -out:"$out/Logic.dll" "$src"/Runtime/Logic/*.cs
# Runtime assembly against compile-only Unity stubs.
mcs -nologo -warnaserror -target:library -out:"$out/Runtime.dll" -r:"$out/Logic.dll" \
    "$here/UnityStubs.cs" "$src"/Runtime/*.cs
# Tests with an NUnit shim, then run them.
mcs -nologo -warnaserror -out:"$out/Tests.exe" -r:"$out/Logic.dll" \
    "$here/NUnitShim.cs" "$here/TestRunner.cs" "$src"/Tests/Editor/*.cs
(cd "$out" && mono Tests.exe)
