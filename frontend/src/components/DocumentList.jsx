import DownloadButton from './DownloadButton.jsx';

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function DocumentList({ documents, userId, onError, loading }) {
  if (loading) {
    return <p className="list-status" role="status">Carregando documentos...</p>;
  }

  if (documents.length === 0) {
    return <p className="list-status empty-state">Nenhum documento enviado por este usuário.</p>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col">Nome</th>
            <th scope="col">Enviado em</th>
            <th scope="col">Tamanho</th>
            <th scope="col"><span className="visually-hidden">Ações</span></th>
          </tr>
        </thead>
        <tbody>
          {documents.map((document) => (
            <tr key={document.id}>
              <td className="document-name">
                <span className="document-mark" aria-hidden="true">DOC</span>
                <span title={document.originalName}>{document.originalName}</span>
              </td>
              <td>{formatDate(document.uploadedAt)}</td>
              <td>{formatSize(document.size)}</td>
              <td className="action-cell">
                <DownloadButton document={document} userId={userId} onError={onError} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}