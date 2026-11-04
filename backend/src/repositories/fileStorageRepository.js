const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const path = require('node:path');

function createFileStorageRepository(storageDirectory) {
  const rootDirectory = path.resolve(storageDirectory);
  const storageNamePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  function getPath(storageName) {
    if (typeof storageName !== 'string' || !storageNamePattern.test(storageName)) {
      const error = new Error('Nome interno de arquivo inválido.');
      error.status = 400;
      error.code = 'INVALID_STORAGE_NAME';
      throw error;
    }

    const resolvedPath = path.resolve(rootDirectory, storageName);
    if (!resolvedPath.startsWith(`${rootDirectory}${path.sep}`)) {
      const error = new Error('Caminho de armazenamento inválido.');
      error.status = 400;
      error.code = 'INVALID_STORAGE_PATH';
      throw error;
    }
    return resolvedPath;
  }

  return {
    getPath,

    createReadStream(storageName) {
      return fsSync.createReadStream(getPath(storageName));
    },

    async getStorageUsage() {
      const entries = await fs.readdir(rootDirectory, { withFileTypes: true });
      const fileSizes = await Promise.all(entries
        .filter((entry) => entry.isFile())
        .map(async (entry) => (await fs.stat(path.join(rootDirectory, entry.name))).size));
      return fileSizes.reduce((total, size) => total + size, 0);
    },

    async remove(storageName) {
      try {
        await fs.unlink(getPath(storageName));
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }
    },
  };
}

module.exports = { createFileStorageRepository };