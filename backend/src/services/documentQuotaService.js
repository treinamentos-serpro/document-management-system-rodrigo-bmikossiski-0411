function createQuotaError(code, message) {
  const error = new Error(message);
  error.status = 413;
  error.code = code;
  return error;
}

function createDocumentQuotaService({
  documentRepository,
  fileStorageRepository,
  maxUserStorageBytes,
  maxStorageBytes,
  maxUserDocuments,
}) {
  const pendingUploadsByOwner = new Map();

  async function reserveUpload(file, owner) {
    const ownerDocuments = documentRepository.findByOwner(owner);
    const ownerUsage = ownerDocuments.reduce((total, document) => total + document.size, 0);
    const pending = pendingUploadsByOwner.get(owner) || { count: 0, size: 0 };

    if (ownerDocuments.length + pending.count >= maxUserDocuments
      || ownerUsage + pending.size + file.size > maxUserStorageBytes) {
      throw createQuotaError(
        'USER_QUOTA_EXCEEDED',
        'O limite de documentos ou armazenamento deste usuário foi atingido.',
      );
    }

    const reservation = { count: 1, size: file.size, fileSize: file.size };
    pending.count += reservation.count;
    pending.size += reservation.size;
    pendingUploadsByOwner.set(owner, pending);
    let active = true;
    const release = () => {
      if (!active) return;
      active = false;
      pending.count -= reservation.count;
      pending.size -= reservation.size;
      if (pending.count === 0) pendingUploadsByOwner.delete(owner);
    };

    try {
      const storageUsage = await fileStorageRepository.getStorageUsage();
      if (storageUsage > maxStorageBytes) {
        throw createQuotaError('STORAGE_QUOTA_EXCEEDED', 'O limite de armazenamento local foi atingido.');
      }
      return release;
    } catch (error) {
      release();
      throw error;
    }
  }

  return { reserveUpload };
}

module.exports = { createDocumentQuotaService };