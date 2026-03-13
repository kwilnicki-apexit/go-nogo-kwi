import { useRef } from 'react';
import type { Labels } from '../types';

const MAX_FILES = 20;

interface ReportFormProps {
  projectName: string;
  setProjectName: (val: string) => void;
  author: string;
  setAuthor: (val: string) => void;
  language: string;
  setLanguage: (val: string) => void;
  risks: string;
  setRisks: (val: string) => void;
  files: File[];
  setFiles: (files: File[]) => void;
  onGenerate: () => void;
  isLoading: boolean;
  labels: Labels;
}

export const ReportForm = ({
  projectName, setProjectName,
  author, setAuthor,
  language, setLanguage,
  risks, setRisks,
  files, setFiles,
  onGenerate, isLoading,
  labels,
}: ReportFormProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      const combined = [...files, ...newFiles].slice(0, MAX_FILES);
      setFiles(combined);
    }
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <section className="card">
      <h2 className="card-title">{labels.projectParams}</h2>
      <div className="form-grid">
        <div className="form-group">
          <label className="form-label">{labels.projectName}</label>
          <input
            className="form-control"
            value={projectName}
            onChange={e => setProjectName(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label">{labels.reportAuthor}</label>
          <input
            className="form-control"
            value={author}
            onChange={e => setAuthor(e.target.value)}
          />
        </div>
        <div className="form-group full-width">
          <label className="form-label">{labels.outputLanguage}</label>
          <select
            className="form-control"
            value={language}
            onChange={e => setLanguage(e.target.value)}
          >
            <option value="pl">{labels.polish}</option>
            <option value="en">{labels.english}</option>
          </select>
        </div>
        <div className="form-group full-width">
          <label className="form-label">{labels.testFiles}</label>
          <input
            ref={fileInputRef}
            type="file"
            className="form-control"
            multiple
            accept=".csv,.xls,.xlsx"
            onChange={handleFileChange}
          />
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: '0.35rem',
            fontSize: '0.8rem',
            color: '#999',
          }}>
            <span>{labels.maxFiles}</span>
            <span>{files.length} / {MAX_FILES} {labels.fileCount}</span>
          </div>
          {files.length > 0 && (
            <div style={{ marginTop: '0.5rem' }}>
              {files.map((file, index) => (
                <div key={index} className="file-item">
                  <span>
                    {file.name}
                    <span style={{ color: '#999', marginLeft: '0.5rem' }}>
                      ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                  </span>
                  <button
                    onClick={() => removeFile(index)}
                    className="file-remove-btn"
                    title="Remove"
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="form-group full-width">
          <label className="form-label">{labels.identifiedRisks}</label>
          <textarea
            className="form-control"
            rows={3}
            style={{ resize: 'vertical' }}
            value={risks}
            onChange={e => setRisks(e.target.value)}
            placeholder={language === 'pl'
              ? 'Opisz znane ryzyka projektu...'
              : 'Describe known project risks...'}
          />
        </div>
      </div>
      <button
        className="btn btn-primary"
        onClick={onGenerate}
        disabled={isLoading || files.length === 0}
      >
        {isLoading ? labels.generating : labels.generateReport}
      </button>
      {files.length === 0 && (
        <p style={{ color: '#999', fontSize: '0.85rem', marginTop: '0.5rem' }}>
          {labels.addFileHint}
        </p>
      )}
    </section>
  );
};