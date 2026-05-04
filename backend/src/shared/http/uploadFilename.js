const crypto = require('crypto');
const path = require('path');

function safeUploadFilename(originalName) {
  const basename = path.basename(String(originalName || '')).trim();
  const safeName = basename
    .replace(/[^\w.\-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 180) || 'upload.bin';

  return `${Date.now()}-${crypto.randomUUID()}-${safeName}`;
}

module.exports = {
  safeUploadFilename,
};
