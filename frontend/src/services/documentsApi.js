async function request(path, options = {}) {
  const response = await fetch(`/api${path}`, options);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error?.message || 'Não foi possível concluir a operação.');
  }
  return response;
}

export async function listDocuments(userId) {
  const response = await request('/documents', {
    headers: { 'X-User-Id': userId },
  });
  const body = await response.json();
  return body.documents;
}

export async function uploadDocument(userId, file) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await request('/upload', {
    method: 'POST',
    headers: { 'X-User-Id': userId },
    body: formData,
  });
  return response.json();
}

export async function downloadDocument(userId, documentId) {
  const response = await request(`/documents/${encodeURIComponent(documentId)}/download`, {
    headers: { 'X-User-Id': userId },
  });
  return response.blob();
}