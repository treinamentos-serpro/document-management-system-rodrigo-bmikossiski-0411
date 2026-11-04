const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const multer = require('multer');

function createUploadMiddleware({ storageDirectory, maxFileSizeBytes }) {
  fs.mkdirSync(storageDirectory, { recursive: true });

  const storage = multer.diskStorage({
    destination: storageDirectory,
    filename: (req, file, callback) => callback(null, randomUUID()),
  });

  return multer({
    storage,
    limits: { fileSize: maxFileSizeBytes, files: 1 },
  });
}

module.exports = { createUploadMiddleware };