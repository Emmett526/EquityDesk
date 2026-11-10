'use strict';
// The Longbridge SDK is a 70 MB native module, so it is not shipped in the installer. The first time someone picks Longbridge,
// it is downloaded from the npm registry, checked against the pinned sha512 below, and kept in %APPDATA%\EquityDesk\native.
const fs = require('fs'), path = require('path'), zlib = require('zlib'), crypto = require('crypto');
const VER = '5.3.0';
const PKG = {
  win32: ['longbridge-win32-x64-msvc', 'longbridge.win32-x64-msvc.node', 'sha512-uN2WZmrv+fN2O2ShAhOVMMaIxW8MpjOjXLQBL90vbelYv09f+7OVVF4q8X1ousfBAZ4ZV6fZ6AXtqqvANrXv2g=='],
  linux: ['longbridge-linux-x64-gnu', 'longbridge.linux-x64-gnu.node', 'sha512-wEY7EsKwKaBwSuuM4kSwodSu4HY4OHJj5t+lXhQlWpJ9WDEXXzGPS4c0Cy5wIGmMmEBlYZO4I3frCPsKilvMHg==']
};
let mod = null, loading = null;
function untar(buf, want) {   // minimal ustar reader: returns the file whose name ends with `want`
  for (let o = 0; o + 512 <= buf.length;) {
    const name = buf.toString('utf8', o, o + 100).replace(/\0.*$/s, ''); if (!name) break;
    const size = parseInt(buf.toString('ascii', o + 124, o + 136).replace(/\0.*$/s, '').trim() || '0', 8);
    if (name.endsWith('/' + want) || name === want) return buf.subarray(o + 512, o + 512 + size);
    o += 512 + Math.ceil(size / 512) * 512;
  }
  return null;
}
async function load(dir) {
  if (mod) return mod;
  return loading || (loading = (async () => {
    const p = PKG[process.platform]; if (!p || process.arch !== 'x64') throw new Error('Longbridge is only set up for 64-bit Windows here');
    const file = path.join(dir, 'native', `${p[0]}-${VER}.node`);
    if (!fs.existsSync(file)) {
      const r = await fetch(`https://registry.npmjs.org/${p[0]}/-/${p[0]}-${VER}.tgz`, { signal: AbortSignal.timeout(10 * 60e3) });
      if (!r.ok) throw new Error('Could not download the Longbridge module (HTTP ' + r.status + ')');
      const tgz = Buffer.from(await r.arrayBuffer());
      if ('sha512-' + crypto.createHash('sha512').update(tgz).digest('base64') !== p[2]) throw new Error('The downloaded Longbridge module failed its integrity check, so it was not used.');
      const bin = untar(zlib.gunzipSync(tgz), p[1]); if (!bin) throw new Error('The Longbridge module download was not in the expected format');
      fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file + '.part', bin); fs.renameSync(file + '.part', file);
    }
    return (mod = require(file));
  })().finally(() => { loading = null; }));
}
module.exports = { load };
