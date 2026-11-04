const express = require('express');
const { createDocumentController } = require('../controllers/documentController');

function createDocumentsRoutes({ documentService, upload, requireUser, uploadRateLimiter }) {
  const router = express.Router();
  const controller = createDocumentController({ documentService });

  router.post('/upload', requireUser, uploadRateLimiter, upload.single('file'), controller.upload);
  router.get('/documents', requireUser, controller.list);
  router.get('/documents/:id/download', requireUser, controller.download);

  return router;
}

module.exports = createDocumentsRoutes;