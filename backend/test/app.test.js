const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const app = require('../src/app');
const { createMemoryDocumentRepository } = require('../src/repositories/memoryDocumentRepository');
const { createFileStorageRepository } = require('../src/repositories/fileStorageRepository');

async function createTestServer(t, options = {}) {
  const storageDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'dms-test-'));
  const testApp = app.createApp({
    storageDirectory,
    documentRepository: createMemoryDocumentRepository(),
    maxFileSizeBytes: options.maxFileSizeBytes || 1024,
    maxUserStorageBytes: options.maxUserStorageBytes || 1024,
    maxStorageBytes: options.maxStorageBytes || 1024 * 1024,
    maxUserDocuments: options.maxUserDocuments || 100,
    uploadsPerMinute: options.uploadsPerMinute || 30,
    allowHeaderIdentity: options.allowHeaderIdentity ?? true,
  });
  const server = testApp.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));

  t.after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await fs.rm(storageDirectory, { recursive: true, force: true });
  });

  return `http://127.0.0.1:${server.address().port}`;
}

// Teste de fumaça do seed: garante que o app Express foi exportado.
// Novos testes serão adicionados durante os Steps 2, 6 e 7 com auxílio do Copilot.
test('o app backend é exportado', () => {
  assert.ok(app, 'o app deve estar definido');
  assert.strictEqual(typeof app, 'function', 'o app Express deve ser uma função');
});

test('faz upload, lista somente documentos do usuário e baixa o arquivo', async (t) => {
  const baseUrl = await createTestServer(t);
  const form = new FormData();
  form.append('file', new Blob(['conteudo de teste'], { type: 'text/plain' }), 'relatorio.txt');

  const uploadResponse = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: { 'X-User-Id': 'ana' },
    body: form,
  });
  assert.equal(uploadResponse.status, 201);
  const document = await uploadResponse.json();
  assert.equal(document.originalName, 'relatorio.txt');
  assert.equal(document.size, 17);
  assert.equal('storageName' in document, false);

  const listResponse = await fetch(`${baseUrl}/documents`, {
    headers: { 'X-User-Id': 'ana' },
  });
  assert.deepEqual((await listResponse.json()).documents.map(({ id }) => id), [document.id]);

  const otherUserResponse = await fetch(`${baseUrl}/documents`, {
    headers: { 'X-User-Id': 'bia' },
  });
  assert.deepEqual((await otherUserResponse.json()).documents, []);

  const downloadResponse = await fetch(`${baseUrl}/documents/${document.id}/download`, {
    headers: { 'X-User-Id': 'ana' },
  });
  assert.equal(downloadResponse.status, 200);
  assert.match(downloadResponse.headers.get('content-type'), /application\/octet-stream/);
  assert.equal(downloadResponse.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(await downloadResponse.text(), 'conteudo de teste');

  const forbiddenDownload = await fetch(`${baseUrl}/documents/${document.id}/download`, {
    headers: { 'X-User-Id': 'bia' },
  });
  assert.equal(forbiddenDownload.status, 404);
});

test('upload retorna metadados públicos e preserva bytes no download', async (t) => {
  const baseUrl = await createTestServer(t);
  const content = Buffer.from([0, 255, 128, 13, 10, 42]);
  const form = new FormData();
  form.append('file', new Blob([content]), 'arquivo.bin');

  const uploadResponse = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: { 'X-User-Id': 'ana' },
    body: form,
  });
  assert.equal(uploadResponse.status, 201);
  assert.match(uploadResponse.headers.get('content-type'), /application\/json/);
  const document = await uploadResponse.json();
  assert.equal(typeof document.id, 'string');
  assert.ok(document.id.length > 0);
  assert.ok(Number.isFinite(Date.parse(document.uploadedAt)));
  assert.deepEqual(document, {
    id: document.id,
    originalName: 'arquivo.bin',
    size: content.length,
    uploadedAt: document.uploadedAt,
    owner: 'ana',
    mimeType: 'application/octet-stream',
  });

  const downloadResponse = await fetch(`${baseUrl}/documents/${document.id}/download`, {
    headers: { 'X-User-Id': 'ana' },
  });
  assert.equal(downloadResponse.status, 200);
  assert.match(downloadResponse.headers.get('content-disposition'), /^attachment;/);
  assert.match(downloadResponse.headers.get('content-disposition'), /filename="arquivo\.bin"/);
  assert.deepEqual(Buffer.from(await downloadResponse.arrayBuffer()), content);
});

test('listagem retorna uma coleção vazia quando o usuário não tem documentos', async (t) => {
  const baseUrl = await createTestServer(t);
  const response = await fetch(`${baseUrl}/documents`, {
    headers: { 'X-User-Id': 'ana' },
  });

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /application\/json/);
  assert.deepEqual(await response.json(), { documents: [] });
});

test('download de documento inexistente retorna erro 404', async (t) => {
  const baseUrl = await createTestServer(t);
  const response = await fetch(`${baseUrl}/documents/inexistente/download`, {
    headers: { 'X-User-Id': 'ana' },
  });

  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, 'DOCUMENT_NOT_FOUND');
});

test('valida usuário, arquivo obrigatório e limite de tamanho', async (t) => {
  const baseUrl = await createTestServer(t, { maxFileSizeBytes: 3 });

  const missingUserResponse = await fetch(`${baseUrl}/documents`);
  assert.equal(missingUserResponse.status, 400);

  const missingFileResponse = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: { 'X-User-Id': 'ana' },
    body: new FormData(),
  });
  assert.equal(missingFileResponse.status, 400);

  const form = new FormData();
  form.append('file', new Blob(['quatro'], { type: 'text/plain' }), 'grande.txt');
  const oversizedResponse = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: { 'X-User-Id': 'ana' },
    body: form,
  });
  assert.equal(oversizedResponse.status, 413);
});

test('rejeita nomes de armazenamento que possam escapar do diretório local', () => {
  const repository = createFileStorageRepository(path.join(os.tmpdir(), 'dms-storage-test'));
  assert.throws(() => repository.getPath('../outside.txt'), { code: 'INVALID_STORAGE_NAME' });
  assert.throws(() => repository.getPath('/etc/passwd'), { code: 'INVALID_STORAGE_NAME' });
});

test('aplica cotas por usuário e remove o arquivo recusado', async (t) => {
  const baseUrl = await createTestServer(t, { maxUserStorageBytes: 2 });
  const form = new FormData();
  form.append('file', new Blob(['abc'], { type: 'text/plain' }), 'arquivo.txt');

  const response = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: { 'X-User-Id': 'ana' },
    body: form,
  });
  assert.equal(response.status, 413);
  assert.equal((await response.json()).error.code, 'USER_QUOTA_EXCEEDED');
  const listResponse = await fetch(`${baseUrl}/documents`, {
    headers: { 'X-User-Id': 'ana' },
  });
  assert.deepEqual((await listResponse.json()).documents, []);
});

test('limita a frequência de uploads por endereço', async (t) => {
  const baseUrl = await createTestServer(t, { uploadsPerMinute: 1 });
  const createForm = () => {
    const form = new FormData();
    form.append('file', new Blob(['a']), 'a.txt');
    return form;
  };

  const headers = { 'X-User-Id': 'ana' };
  const firstResponse = await fetch(`${baseUrl}/upload`, {
    method: 'POST', headers, body: createForm(),
  });
  assert.equal(firstResponse.status, 201);

  const secondResponse = await fetch(`${baseUrl}/upload`, {
    method: 'POST', headers, body: createForm(),
  });
  assert.equal(secondResponse.status, 429);
});

test('não ultrapassa a cota por usuário em uploads simultâneos', async (t) => {
  const baseUrl = await createTestServer(t, { maxUserStorageBytes: 2 });
  const createRequest = () => {
    const form = new FormData();
    form.append('file', new Blob(['ab']), 'arquivo.txt');
    return fetch(`${baseUrl}/upload`, {
      method: 'POST',
      headers: { 'X-User-Id': 'ana' },
      body: form,
    });
  };

  const responses = await Promise.all([createRequest(), createRequest()]);
  assert.deepEqual(responses.map(({ status }) => status).sort(), [201, 413]);
});

test('aplica a cota global do diretório local', async (t) => {
  const baseUrl = await createTestServer(t, { maxStorageBytes: 2 });
  const form = new FormData();
  form.append('file', new Blob(['abc']), 'arquivo.txt');

  const response = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: { 'X-User-Id': 'ana' },
    body: form,
  });
  assert.equal(response.status, 413);
  assert.equal((await response.json()).error.code, 'STORAGE_QUOTA_EXCEEDED');
});

test('não confia em X-User-Id quando identidade por cabeçalho está desabilitada', async (t) => {
  const baseUrl = await createTestServer(t, { allowHeaderIdentity: false });
  const response = await fetch(`${baseUrl}/documents`, {
    headers: { 'X-User-Id': 'ana' },
  });
  assert.equal(response.status, 401);
});
