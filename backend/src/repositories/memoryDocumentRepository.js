function createMemoryDocumentRepository() {
  const documents = new Map();

  return {
    save(document) {
      documents.set(document.id, document);
    },

    findByOwner(owner) {
      return [...documents.values()]
        .filter((document) => document.owner === owner)
        .sort((first, second) => second.uploadedAt.localeCompare(first.uploadedAt));
    },

    findByIdAndOwner(id, owner) {
      const document = documents.get(id);
      return document && document.owner === owner ? document : null;
    },
  };
}

module.exports = { createMemoryDocumentRepository };