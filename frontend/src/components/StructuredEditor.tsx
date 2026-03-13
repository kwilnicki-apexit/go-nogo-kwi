import { useState } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import type { StructuredDraft, SectionConfig, Labels, EnabledSections } from '../types';

const SECTIONS: SectionConfig[] = [
  { key: 'summary', labelPl: 'Podsumowanie', labelEn: 'Summary', icon: '' },
  { key: 'test_analysis', labelPl: 'Analiza testów', labelEn: 'Test analysis', icon: '' },
  { key: 'risks_eval', labelPl: 'Ocena ryzyk', labelEn: 'Risk evaluation', icon: '' },
  { key: 'decision', labelPl: 'Decyzja', labelEn: 'Decision', icon: '' },
  { key: 'justification', labelPl: 'Uzasadnienie', labelEn: 'Justification', icon: '' },
];

interface StructuredEditorProps {
  draft: StructuredDraft;
  setDraft: (draft: StructuredDraft) => void;
  onExport: (format: 'pdf' | 'docx' | 'md', enabledSections: EnabledSections) => void;
  exportMessage: string;
  chartPaths: string[];
  language: string;
  labels: Labels;
}

const QUILL_MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ color: [] }, { background: [] }],
    ['blockquote'],
    ['clean'],
  ],
};

const QUILL_FORMATS = [
  'header', 'bold', 'italic', 'underline', 'strike',
  'list', 'bullet', 'color', 'background', 'blockquote',
];

export const StructuredEditor = ({
  draft, setDraft, onExport, exportMessage, chartPaths, language, labels,
}: StructuredEditorProps) => {
  const [enabledSections, setEnabledSections] = useState<EnabledSections>({
    summary: true,
    test_analysis: true,
    risks_eval: true,
    decision: true,
    justification: true,
  });

  const isPl = language === 'pl';

  const hasDraft = draft && (draft.summary || draft.test_analysis || draft.decision);
  if (!hasDraft) return null;

  const handleChange = (key: keyof StructuredDraft, value: string) => {
    setDraft({ ...draft, [key]: value });
  };

  const toggleSection = (key: keyof StructuredDraft) => {
    if (key === 'decision') return;
    setEnabledSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const enabledCount = Object.values(enabledSections).filter(Boolean).length;
  const allEnabled = enabledCount === SECTIONS.length;

  const toggleAll = () => {
    const newState = !allEnabled;
    const updated = { ...enabledSections };
    for (const s of SECTIONS) {
      updated[s.key] = newState;
    }
    updated.decision = true;
    setEnabledSections(updated);
  };

  const decisionColor = draft.decision === 'GO' ? '#4CAF50' : '#F44336';

  return (
    <section className="card" style={{ animation: 'fadeIn 0.5s' }}>
      <h2 className="card-title" style={{ color: 'var(--orlen-red)' }}>
        {labels.reviewEdit}
      </h2>
      <p className="hint-text">{labels.reviewHint}</p>

      <div className={`decision-banner ${draft.decision === 'GO' ? 'decision-go' : 'decision-nogo'}`}>
        <span className="decision-label">{labels.aiRecommendation}</span>
        <div className="decision-value" style={{ color: decisionColor }}>
          {draft.decision || '-'}
        </div>
      </div>

      <div className="section-controls">
        <button className="btn-toggle-all" onClick={toggleAll}>
          {allEnabled ? labels.deselectAll : labels.selectAll}
        </button>
        <span className="section-count">
          {enabledCount} / {SECTIONS.length} {labels.sectionsIncluded}
        </span>
      </div>

      {SECTIONS.map((section) => {
        const enabled = enabledSections[section.key];
        const sectionLabel = isPl ? section.labelPl : section.labelEn;

        return (
          <div
            key={section.key}
            className={`editor-section ${enabled ? 'section-enabled' : 'section-disabled'}`}
          >
            <div className="section-header" onClick={() => toggleSection(section.key)}>
              <div className="section-header-left">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={() => toggleSection(section.key)}
                  onClick={e => e.stopPropagation()}
                  className="section-checkbox"
                  disabled={section.key === 'decision'}
                />
                <span className="section-title" style={{
                  color: section.key === 'decision' ? decisionColor : undefined,
                }}>
                  {sectionLabel}
                </span>
                {section.key === 'decision' && (
                  <span className="decision-badge" style={{ backgroundColor: decisionColor }}>
                    {draft.decision}
                  </span>
                )}
              </div>
              <span className="section-toggle-hint">
                {enabled ? labels.sectionEnabled : labels.sectionDisabled}
              </span>
            </div>

            {enabled && (
              <div className="section-body">
                {section.key === 'decision' ? (
                  <select
                    className="form-control decision-select"
                    value={draft.decision}
                    onChange={e => handleChange('decision', e.target.value)}
                    style={{ color: decisionColor }}
                  >
                    <option value="GO">GO</option>
                    <option value="NO-GO">NO-GO</option>
                  </select>
                ) : (
                  <ReactQuill
                    theme="snow"
                    value={draft[section.key]}
                    onChange={(value: string) => handleChange(section.key, value)}
                    modules={QUILL_MODULES}
                    formats={QUILL_FORMATS}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}

      {chartPaths.length > 0 && (
        <div className="charts-section">
          <label className="form-label" style={{ fontWeight: 'bold' }}>
            {labels.generatedCharts} ({chartPaths.length})
          </label>
          <div className="charts-grid">
            {chartPaths.map((path, i) => {
              const name = path.split('/').pop() || `chart_${i}`;
              return (
                <div key={i} className="chart-item">
                  <span className="chart-name">{name}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="button-group">
        <button className="btn btn-secondary" onClick={() => onExport('pdf', enabledSections)}>
          {labels.exportPdf}
        </button>
        <button className="btn btn-outline" onClick={() => onExport('docx', enabledSections)}>
          {labels.exportDocx}
        </button>
        <button className="btn btn-outline" onClick={() => onExport('md', enabledSections)}>
          {labels.exportMd}
        </button>
      </div>

      {exportMessage && (
        <div className={`alert ${exportMessage.includes('Błąd') || exportMessage.includes('Error')
          ? 'alert-error' : 'alert-success'}`}>
          {exportMessage}
        </div>
      )}
    </section>
  );
};