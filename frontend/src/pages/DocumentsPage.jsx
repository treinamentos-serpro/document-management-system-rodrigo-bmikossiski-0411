import { useEffect, useState } from 'react';
import DocumentList from '../components/DocumentList.jsx';
import UploadComponent from '../components/UploadComponent.jsx';
import {
  listDocuments,
  uploadDocument,
} from '../services/documentsApi.js';
import './DocumentsPage.css';

const USER_STORAGE_KEY = 'dms-user-id';

function getStoredUser() {
  return localStorage.getItem(USER_STORAGE_KEY) || 'usuario-demo';
}

export default function DocumentsPage() {
  const [userInput, setUserInput] = useState(getStoredUser);
  const [activeUser, setActiveUser] = useState(getStoredUser);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    listDocuments(activeUser)
      .then((result) => {
        if (active) setDocuments(result);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [activeUser, refreshKey]);

  function handleUserSubmit(event) {
    event.preventDefault();
    if (isUploading) return;
    const userId = userInput.trim();
    if (!userId) {
      setError('Informe um identificador de usuário.');
      return;
    }
    localStorage.setItem(USER_STORAGE_KEY, userId);
    setActiveUser(userId);
    setNotice('');
    if (userId === activeUser) setRefreshKey((value) => value + 1);
  }

  async function handleUpload(file) {
    const uploadOwner = activeUser;
    setError('');
    setNotice('');
    setIsUploading(true);
    try {
      await uploadDocument(uploadOwner, file);
      if (uploadOwner === activeUser) {
        setNotice('Documento enviado.');
        setRefreshKey((value) => value + 1);
      }
      return true;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <main className="workspace">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Arquivo, início">
          <span className="brand-symbol" aria-hidden="true"><i /><i /><i /></span>
          <span>ARQUIVO<span className="brand-period">.</span></span>
        </a>
        <span className="topbar-caption">GESTÃO DE DOCUMENTOS</span>
      </header>

      <section className="page-heading">
        <div>
          <p className="eyebrow">ESPAÇO PESSOAL</p>
          <h1>Seus documentos</h1>
          <p className="heading-copy">Arquivos organizados, prontos para consultar e baixar.</p>
        </div>
        <form className="user-form" onSubmit={handleUserSubmit}>
          <label htmlFor="user-id">Usuário</label>
          <div className="user-control">
            <input
              id="user-id"
              value={userInput}
              onChange={(event) => setUserInput(event.target.value)}
              autoComplete="off"
              disabled={isUploading}
            />
            <button type="submit" aria-label="Abrir documentos deste usuário" disabled={isUploading}>
              Abrir
            </button>
          </div>
        </form>
      </section>

      <section className="upload-section" aria-labelledby="upload-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">ADICIONAR AO ARQUIVO</p>
            <h2 id="upload-title">Enviar documento</h2>
          </div>
          <span className="storage-note">Armazenamento local</span>
        </div>
        <UploadComponent onUpload={handleUpload} disabled={!activeUser || isUploading} />
      </section>

      <section className="documents-section" aria-labelledby="documents-title">
        <div className="section-heading list-heading">
          <div>
            <p className="eyebrow">BIBLIOTECA</p>
            <h2 id="documents-title">Todos os documentos</h2>
          </div>
          <span className="document-count">{loading ? '...' : documents.length} arquivos</span>
        </div>
        {error && <p className="message error-message" role="alert">{error}</p>}
        {notice && <p className="message success-message" role="status">{notice}</p>}
        <DocumentList
          documents={documents}
          userId={activeUser}
          onError={setError}
          loading={loading}
        />
      </section>
      <footer className="page-footer">
        <span>ARQUIVO<span className="brand-period">.</span></span>
        <span>Documentos de {activeUser}</span>
      </footer>
    </main>
  );
}