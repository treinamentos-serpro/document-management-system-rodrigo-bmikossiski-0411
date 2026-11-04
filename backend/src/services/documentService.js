const { createDocumentRecord, toPublicDocument } = require('./documentMapper');
const { createDocumentQuotaService } = require('./documentQuotaService');

function createDocumentService({
  documentRepository,
  fileStorageRepository,
  maxUserStorageBytes,
  maxStorageBytes,
  maxUserDocuments,
}) {
  const documentQuotaService = createDocumentQuotaService({
    documentRepository,
    fileStorageRepository,
    maxUserStorageBytes,
    maxStorageBytes,
    maxUserDocuments,
  });

  return {
    async saveUploadedDocument(file, owner) {
      let releaseQuota;
      try {
        releaseQuota = await documentQuotaService.reserveUpload(file, owner);
        const document = createDocumentRecord(file, owner);
        documentRepository.save(document);
        return toPublicDocument(document);
      } catch (error) {
        await fileStorageRepository.remove(file.filename);
        throw error;
      } finally {
        releaseQuota?.();
      }
    },

    listDocuments(owner) {
      return documentRepository.findByOwner(owner).map(toPublicDocument);
    },

    createDownload(id, owner) {
      const document = documentRepository.findByIdAndOwner(id, owner);
      if (!document) return null;

      return {
        document: toPublicDocument(document),
        stream: fileStorageRepository.createReadStream(document.storageName),
      };
    },
  };
}

module.exports = { createDocumentService };