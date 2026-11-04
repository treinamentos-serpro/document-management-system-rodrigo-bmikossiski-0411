const { randomUUID } = require('node:crypto');

function createDocumentRecord(file, owner) {
  return {
    id: randomUUID(),
    originalName: file.originalname,
    storageName: file.filename,
    size: file.size,
    uploadedAt: new Date().toISOString(),
    owner,
    mimeType: 'application/octet-stream',
  };
}

function toPublicDocument(document) {
  return {
    id: document.id,
    originalName: document.originalName,
    size: document.size,
    uploadedAt: document.uploadedAt,
    owner: document.owner,
    mimeType: document.mimeType,
  };
}

module.exports = { createDocumentRecord, toPublicDocument };