const { randomUUID } = require('node:crypto');

function toPublicDocument(document) {
  const { storageName, ...publicDocument } = document;
  return publicDocument;
}

function createDocumentService({ documentRepository, fileStorageRepository }) {
  return {
    async saveUploadedDocument(file, owner) {
      const document = {
        id: randomUUID(),
        originalName: file.originalname,
        storageName: file.filename,
        size: file.size,
        uploadedAt: new Date().toISOString(),
        owner,
        mimeType: file.mimetype || 'application/octet-stream',
      };

      try {
        documentRepository.save(document);
      } catch (error) {
        await fileStorageRepository.remove(document.storageName);
        throw error;
      }

      return toPublicDocument(document);
    },

    listDocuments(owner) {
      return documentRepository.findByOwner(owner).map(toPublicDocument);
    },

    findDocumentForUser(id, owner) {
      return documentRepository.findByIdAndOwner(id, owner);
    },
  };
}

module.exports = { createDocumentService };