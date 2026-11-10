#!/bin/bash
# prune a production node_modules: type defs, source maps, docs, ESM duplicates, TS sources
set -e; cd "$1"
find . -type d -empty -delete
find . -type f \( -name '*.d.ts' -o -name '*.d.mts' -o -name '*.d.cts' -o -name '*.map' -o -name '*.md' -o -name '*.markdown' -o -name '*.ts' -o -name '*.mts' -o -name '*.cts' -o -name '.npmignore' -o -name '*.tsbuildinfo' -o -name '.eslintrc*' -o -name '.prettierrc*' \) ! -iname 'LICENSE*' -delete
rm -rf rxjs/dist/esm rxjs/dist/esm5 rxjs/dist/bundles rxjs/dist/types rxjs/src rxjs/ajax rxjs/fetch rxjs/testing rxjs/webSocket rxjs/operators/package.json.bak
rm -rf @bufbuild/protobuf/dist/esm @tigeropenapi/tigeropen/dist/esm @tigeropenapi/tigeropen/dist/types @babel/runtime/helpers/esm @babel/runtime/regenerator/*.mjs
find . -type d -empty -delete
