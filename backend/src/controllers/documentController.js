function createRequireUser({ allowHeaderIdentity }) {
  return function requireUser(req, res, next) {
    const userId = req.auth?.userId || (allowHeaderIdentity ? req.get('X-User-Id') : null);
    if (!userId || typeof userId !== 'string' || !userId.trim() || userId.trim().length > 128) {
      const status = allowHeaderIdentity ? 400 : 401;
      return res.status(status).json({
        error: {
          code: allowHeaderIdentity ? 'USER_ID_REQUIRED' : 'AUTHENTICATION_REQUIRED',
          message: allowHeaderIdentity
            ? 'Informe um X-User-Id válido (máximo de 128 caracteres).'
            : 'É necessário autenticar o usuário.',
        },
      });
    }

    req.userId = userId.trim();
    return next();
  };
}

function createDocumentController({ documentService }) {
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
      const download = documentService.createDownload(req.params.id, req.userId);
      if (!download) {
        return res.status(404).json({
          error: { code: 'DOCUMENT_NOT_FOUND', message: 'Documento não encontrado.' },
        });
      }

      res.attachment(download.document.originalName);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      download.stream.on('error', (error) => {
        if (res.headersSent) {
          res.destroy(error);
          return;
        }
        next(error);
      });
      return download.stream.pipe(res);
    },
  };
}

module.exports = { createDocumentController, createRequireUser };