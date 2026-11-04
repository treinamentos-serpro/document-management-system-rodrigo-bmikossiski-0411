// Seed do servidor backend do Document Management System.
//
// Este arquivo é apenas um ponto de partida mínimo. Ao longo do workshop você
// vai usar o Agent Mode do GitHub Copilot para construir as camadas:
//   - routes/       (definição das rotas)
//   - controllers/  (entrada HTTP e validação)
//   - services/     (regras de negócio)
//   - repositories/ (persistência: arquivos locais + metadados em memória)
//
// Restrição do projeto: uploads são gravados no filesystem local da aplicação
// usando multer com diskStorage. Não utilize provedores externos.

const express = require('express');
const path = require('node:path');
const documentsRoutes = require('./routes/documentsRoutes');
const { createFileStorageRepository } = require('./repositories/fileStorageRepository');
const { createMemoryDocumentRepository } = require('./repositories/memoryDocumentRepository');
const { createDocumentService } = require('./services/documentService');
const { createUploadMiddleware } = require('./services/uploadMiddleware');
const { createRequireUser } = require('./controllers/documentController');
const { createUploadRateLimiter } = require('./routes/uploadRateLimiter');

const DEFAULT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const DEFAULT_MAX_USER_STORAGE_BYTES = 100 * 1024 * 1024;
const DEFAULT_MAX_STORAGE_BYTES = 1024 * 1024 * 1024;
const DEFAULT_MAX_USER_DOCUMENTS = 100;
const DEFAULT_UPLOADS_PER_MINUTE = 30;

function readPositiveInteger(name, defaultValue) {
  const value = process.env[name];
  if (value === undefined || value === '') return defaultValue;

  const parsedValue = Number(value);
  if (!Number.isSafeInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`${name} deve ser um inteiro positivo.`);
  }
  return parsedValue;
}

function createApp({
  storageDirectory = path.resolve(__dirname, '../storage'),
  maxFileSizeBytes = readPositiveInteger('MAX_FILE_SIZE_BYTES', DEFAULT_MAX_FILE_SIZE_BYTES),
  maxUserStorageBytes = readPositiveInteger('MAX_USER_STORAGE_BYTES', DEFAULT_MAX_USER_STORAGE_BYTES),
  maxStorageBytes = readPositiveInteger('MAX_STORAGE_BYTES', DEFAULT_MAX_STORAGE_BYTES),
  maxUserDocuments = readPositiveInteger('MAX_USER_DOCUMENTS', DEFAULT_MAX_USER_DOCUMENTS),
  uploadsPerMinute = readPositiveInteger('UPLOADS_PER_MINUTE', DEFAULT_UPLOADS_PER_MINUTE),
  allowHeaderIdentity = process.env.NODE_ENV !== 'production',
  documentRepository = createMemoryDocumentRepository(),
} = {}) {
  const app = express();
  const fileStorageRepository = createFileStorageRepository(storageDirectory);
  const documentService = createDocumentService({
    documentRepository,
    fileStorageRepository,
    maxUserStorageBytes,
    maxStorageBytes,
    maxUserDocuments,
  });
  const upload = createUploadMiddleware({ storageDirectory, maxFileSizeBytes });
  const requireUser = createRequireUser({ allowHeaderIdentity });
  const uploadRateLimiter = createUploadRateLimiter({ limit: uploadsPerMinute, windowMs: 60_000 });

  app.use(express.json());
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });
  app.use('/', documentsRoutes({ documentService, upload, requireUser, uploadRateLimiter }));

  app.use((error, req, res, next) => {
    if (res.headersSent) {
      return next(error);
    }

    if (error.code === 'LIMIT_FILE_SIZE' || error.code === 'STORAGE_QUOTA_EXCEEDED'
      || error.code === 'USER_QUOTA_EXCEEDED') {
      return res.status(413).json({
        error: { code: error.code, message: error.message },
      });
    }

    if (error.name === 'MulterError') {
      return res.status(400).json({
        error: { code: 'INVALID_UPLOAD', message: 'Não foi possível processar o arquivo enviado.' },
      });
    }

    const status = error.status || (error.code === 'ENOENT' ? 404 : 500);
    return res.status(status).json({
      error: {
        code: error.code === 'ENOENT' ? 'DOCUMENT_FILE_NOT_FOUND'
          : error.code || (status === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR'),
        message: status === 500 ? 'Ocorreu um erro interno.'
          : status === 404 ? 'Documento não encontrado.' : error.message,
      },
    });
  });

  return app;
}

const app = createApp();

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`DMS backend ouvindo na porta ${PORT}`);
  });
}

app.createApp = createApp;
module.exports = app;
