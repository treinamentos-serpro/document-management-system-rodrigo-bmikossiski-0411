import { useRef, useState } from 'react';

export default function UploadComponent({ onUpload, disabled }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!file || uploading || disabled) return;

    setUploading(true);
    try {
      const uploaded = await onUpload(file);
      if (uploaded) {
        setFile(null);
        inputRef.current.value = '';
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <form className="upload-form" onSubmit={handleSubmit}>
      <label className="file-picker">
        <span className="file-picker-label">Arquivo</span>
        <input
          ref={inputRef}
          type="file"
          onChange={(event) => setFile(event.target.files?.[0] || null)}
          disabled={disabled || uploading}
        />
      </label>
      <span className="selected-file" title={file?.name}>
        {file?.name || 'Nenhum arquivo selecionado'}
      </span>
      <button className="primary-button" type="submit" disabled={!file || uploading || disabled}>
        {uploading ? 'Enviando...' : 'Enviar documento'}
      </button>
    </form>
  );
}