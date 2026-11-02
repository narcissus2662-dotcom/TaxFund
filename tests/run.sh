#!/bin/bash
# รันชุดทดสอบทั้งหมดด้วย JavaScriptCore (Mac ไม่มี Node): bash tests/run.sh
set -e
cd "$(dirname "$0")/.."
JSC=/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

cp apps-script/Code.gs "$TMP/Code.js"
"$JSC" tests/assert.js tests/fakes.js "$TMP/Code.js" tests/server.test.js

sed -n '/PURE-START/,/PURE-END/p' apps-script/Index.html > "$TMP/pure.js"
"$JSC" tests/assert.js "$TMP/pure.js" tests/client.test.js
