function requireUser(req, res, next) {
  const userId = req.get('X-User-Id');
  if (!userId || !userId.trim()) {
    return res.status(400).json({
      error: { code: 'USER_ID_REQUIRED', message: 'O cabeçalho X-User-Id é obrigatório.' },
    });
  }

  req.userId = userId.trim();
  return next();
}

function createDocumentController({ documentService, fileStorageRepository }) {
  return {
    async upload(req, res) {
      if (!req.file) {
        return res.status(400).json({
          error: { code: 'FILE_REQUIRED', message: 'Envie um arquivo no campo file.' },
        });
      }

      const document = await documentService.saveUploadedDocument(req.file, req.userId);
      return res.status(201).json(document);
    },

    list(req, res) {
      return res.json({ documents: documentService.listDocuments(req.userId) });
    },

    download(req, res, next) {
      const document = documentService.findDocumentForUser(req.params.id, req.userId);
      if (!document) {
        return res.status(404).json({
          error: { code: 'DOCUMENT_NOT_FOUND', message: 'Documento não encontrado.' },
        });
      }

      res.setHeader('Content-Type', document.mimeType);
      return res.download(
        fileStorageRepository.getPath(document.storageName),
        document.originalName,
        (error) => {
          if (error) {
            next(error);
          }
        },
      );
    },
  };
}

module.exports = { createDocumentController, requireUser };