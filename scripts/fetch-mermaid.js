#!/usr/bin/env node
const https = require('https');
const fs = require('fs');
const path = require('path');

const VERSION = '10.9.0';
const DEST = path.join(__dirname, '..', 'lib', 'mermaid.min.js');
const URL = `https://cdn.jsdelivr.net/npm/mermaid@${VERSION}/dist/mermaid.min.js`;

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Download failed: ${response.statusCode}`));
          return;
        }
        response.pipe(file);
        file.on('finish', () => {
          file.close(resolve);
        });
      })
      .on('error', (err) => {
        fs.unlink(dest, () => reject(err));
      });
  });
}

(async () => {
  try {
    console.log(`Downloading Mermaid ${VERSION}...`);
    await download(URL, DEST);
    console.log(`Saved to ${DEST}`);
  } catch (error) {
    console.error('Unable to fetch Mermaid library:', error.message);
    process.exitCode = 1;
  }
})();
