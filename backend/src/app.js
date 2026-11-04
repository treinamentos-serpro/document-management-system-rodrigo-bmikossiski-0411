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

const DEFAULT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

function createApp({
  storageDirectory = path.resolve(__dirname, '../storage'),
  maxFileSizeBytes = Number(process.env.MAX_FILE_SIZE_BYTES) || DEFAULT_MAX_FILE_SIZE_BYTES,
  documentRepository = createMemoryDocumentRepository(),
} = {}) {
  const app = express();
  const fileStorageRepository = createFileStorageRepository(storageDirectory);
  const documentService = createDocumentService({ documentRepository, fileStorageRepository });
  const upload = createUploadMiddleware({ storageDirectory, maxFileSizeBytes });

  app.use(express.json());
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });
  app.use('/', documentsRoutes({ documentService, fileStorageRepository, upload }));

  app.use((error, req, res, next) => {
    if (res.headersSent) {
      return next(error);
    }

    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: { code: 'FILE_TOO_LARGE', message: 'O arquivo excede o limite permitido.' },
      });
    }

    if (error.name === 'MulterError') {
      return res.status(400).json({
        error: { code: 'INVALID_UPLOAD', message: 'Não foi possível processar o arquivo enviado.' },
      });
    }

    const status = error.status || 500;
    return res.status(status).json({
      error: {
        code: error.code || (status === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR'),
        message: status === 500 ? 'Ocorreu um erro interno.' : error.message,
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
