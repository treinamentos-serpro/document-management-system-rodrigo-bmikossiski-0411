const express = require('express');
const { createDocumentController, requireUser } = require('../controllers/documentController');

function createDocumentsRoutes({ documentService, fileStorageRepository, upload }) {
  const router = express.Router();
  const controller = createDocumentController({ documentService, fileStorageRepository });

  router.post('/upload', requireUser, upload.single('file'), controller.upload);
  router.get('/documents', requireUser, controller.list);
  router.get('/documents/:id/download', requireUser, controller.download);

  return router;
}

module.exports = createDocumentsRoutes;