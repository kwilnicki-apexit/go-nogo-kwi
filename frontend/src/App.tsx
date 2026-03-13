import { useState } from 'react';
import { Header } from './components/Header';
import { ReportForm } from './components/ReportForm';
import { StructuredEditor } from './components/StructuredEditor';
import { apiClient } from './api/client';
import { getLabels } from './i18n/labels';
import type { StructuredDraft, ExportRequest, DraftResponse, EnabledSections } from './types';
import './styles/main.css';

const EMPTY_DRAFT: StructuredDraft = {
  summary: '',
  test_analysis: '',
  risks_eval: '',
  decision: '',
  justification: ''
};

function App() {
  const [projectName, setProjectName] = useState('Projekt Alfa');
  const [author, setAuthor] = useState('Jan Kowalski');
  const [language, setLanguage] = useState('pl');
  const [risks, setRisks] = useState('');
  const [files, setFiles] = useState<File[]>([]);

  const [draft, setDraft] = useState<StructuredDraft>(EMPTY_DRAFT);
  const [chartPaths, setChartPaths] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [exportMessage, setExportMessage] = useState('');

  const labels = getLabels(language);

  const handleGenerateDraft = async () => {
    setIsLoading(true);
    setExportMessage('');
    setDraft(EMPTY_DRAFT);
    setChartPaths([]);

    try {
      const formData = new FormData();
      formData.append('project_name', projectName);
      formData.append('user_risks', risks);
      formData.append('language', language);
      files.forEach(file => formData.append('files', file));

      const response = await apiClient.post<DraftResponse>('reports/draft', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setDraft(response.data.draft || EMPTY_DRAFT);
      setChartPaths(response.data.charts || []);
    } catch (error) {
      console.error('Failed to generate draft:', error);
      alert(labels.errorAi);
    } finally {
      setIsLoading(false);
    }
  };

  const stripHtml = (html: string): string => {
    let text = html;
    text = text.replace(/<br\s*\/?>/gi, '\n');
    text = text.replace(/<\/p><p>/gi, '\n\n');
    text = text.replace(/<\/li><li>/gi, '\n- ');
    text = text.replace(/<li>/gi, '- ');
    text = text.replace(/<[^>]+>/g, '');
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/\n{3,}/g, '\n\n');
    return text.trim();
  };

  const handleExport = async (format: 'pdf' | 'docx' | 'md', enabledSections: EnabledSections) => {
    const isPl = language === 'pl';
    setExportMessage(labels.generatingFile);

    const sectionDefs = [
      { key: 'summary' as const, headingPl: 'Podsumowanie', headingEn: 'Summary' },
      { key: 'test_analysis' as const, headingPl: 'Analiza testow', headingEn: 'Test Analysis' },
      { key: 'risks_eval' as const, headingPl: 'Ocena ryzyk', headingEn: 'Risk Evaluation' },
      { key: 'decision' as const, headingPl: 'Decyzja', headingEn: 'Decision' },
      { key: 'justification' as const, headingPl: 'Uzasadnienie', headingEn: 'Justification' },
    ];

    const parts: string[] = [];

    for (const sec of sectionDefs) {
      if (!enabledSections[sec.key]) continue;

      const heading = isPl ? sec.headingPl : sec.headingEn;
      const content = draft[sec.key];

      if (!content) continue;

      if (sec.key === 'decision') {
        parts.push(`## ${heading}: ${content}`);
        parts.push('');
      } else {
        parts.push(`## ${heading}`);
        parts.push(stripHtml(content));
        parts.push('');
      }
    }

    const fullText = parts.join('\n');

    try {
      const payload: ExportRequest = {
        project_name: projectName,
        edited_text: fullText,
        format,
        language,
        author,
        chart_paths: chartPaths,
      };
      const response = await apiClient.post('reports/export', payload);
      setExportMessage(`${labels.successFile} ${response.data.filepath}`);
    } catch (error) {
      console.error(`Export to ${format} failed:`, error);
      setExportMessage(labels.errorExport);
    }
  };

  return (
    <>
      <Header title={labels.headerTitle} />
      <main className="container">
        <ReportForm
          projectName={projectName} setProjectName={setProjectName}
          author={author} setAuthor={setAuthor}
          language={language} setLanguage={setLanguage}
          risks={risks} setRisks={setRisks}
          files={files} setFiles={setFiles}
          onGenerate={handleGenerateDraft}
          isLoading={isLoading}
          labels={labels}
        />
        <StructuredEditor
          draft={draft}
          setDraft={setDraft}
          onExport={handleExport}
          exportMessage={exportMessage}
          chartPaths={chartPaths}
          language={language}
          labels={labels}
        />
      </main>
    </>
  );
}

export default App;