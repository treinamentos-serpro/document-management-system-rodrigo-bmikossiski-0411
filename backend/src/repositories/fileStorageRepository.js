const fs = require('node:fs/promises');
const path = require('node:path');

function createFileStorageRepository(storageDirectory) {
  return {
    getPath(storageName) {
      return path.join(storageDirectory, storageName);
    },

    async remove(storageName) {
      try {
        await fs.unlink(path.join(storageDirectory, storageName));
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }
    },
  };
}

module.exports = { createFileStorageRepository };