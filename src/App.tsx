import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  Image as ImageIcon,
  Download,
  Settings2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
} from 'lucide-react';

// Declaração global para reconhecer a biblioteca carregada via CDN no objeto window
declare global {
  interface Window {
    ImageTracer: any;
  }
}

// Interfaces de Tipagem
interface ProcessedFile {
  name?: string;
  url?: string;
  originalName: string;
  size?: number;
  status: 'success' | 'error';
  error?: string;
}

interface ConversionResult {
  name: string;
  url: string;
  originalName: string;
  size: number;
}

// Função utilitária para carregar scripts externos dinamicamente
const loadScript = (src: string): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error(`Falha ao carregar o script: ${src}`));
    document.body.appendChild(script);
  });
};

export default function App() {
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [files, setFiles] = useState<File[]>([]);
  const [targetFormat, setTargetFormat] = useState<string>('webp');
  const [quality, setQuality] = useState<number>(0.8);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processedFiles, setProcessedFiles] = useState<ProcessedFile[]>([]);
  const [tracerLoaded, setTracerLoaded] = useState<boolean>(false);

  // Tipagem correta para a referência do input de ficheiro
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadScript(
      'https://cdn.jsdelivr.net/npm/imagetracerjs@1.2.6/imagetracer_v1.2.6.js',
    )
      .then(() => setTracerLoaded(true))
      .catch((err) => console.error('Erro ao carregar ImageTracer:', err));
  }, []);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files));
    }
  };

  const addFiles = (newFiles: File[]) => {
    const validFiles = newFiles.filter((file) => file.type.match('image.*'));
    setFiles((prev) => [...prev, ...validFiles]);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const convertToWebP = (file: File): Promise<ConversionResult> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            reject(new Error('Falha ao obter contexto 2D do Canvas.'));
            return;
          }

          ctx.drawImage(img, 0, 0);

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Erro ao gerar o arquivo WebP.'));
                return;
              }
              const url = URL.createObjectURL(blob);
              resolve({
                name: file.name.replace(/\.[^/.]+$/, '') + '.webp',
                url: url,
                originalName: file.name,
                size: blob.size,
              });
            },
            'image/webp',
            quality,
          );
        };
        img.onerror = () =>
          reject(new Error('Erro ao carregar a imagem no Canvas.'));

        // Assegurar que o result é do tipo string (DataURL)
        if (typeof event.target?.result === 'string') {
          img.src = event.target.result;
        } else {
          reject(new Error('Formato de leitura de ficheiro inválido.'));
        }
      };
      reader.onerror = () => reject(new Error('Erro ao ler o ficheiro.'));
      reader.readAsDataURL(file);
    });
  };

  const convertToSVG = (file: File): Promise<ConversionResult> => {
    return new Promise((resolve, reject) => {
      if (!window.ImageTracer) {
        reject(new Error('A biblioteca de vetorização não está carregada.'));
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const options = {
          ltres: 1,
          qtres: 1,
          pathomit: 8,
          colorsampling: 2,
          numberofcolors: 16,
          mincolorratio: 0,
          colorquantcycles: 3,
        };

        if (typeof event.target?.result === 'string') {
          window.ImageTracer.imageToSVG(
            event.target.result,
            (svgString: string) => {
              const blob = new Blob([svgString], { type: 'image/svg+xml' });
              const url = URL.createObjectURL(blob);
              resolve({
                name: file.name.replace(/\.[^/.]+$/, '') + '.svg',
                url: url,
                originalName: file.name,
                size: blob.size,
              });
            },
            options,
          );
        } else {
          reject(
            new Error('Formato de leitura de ficheiro inválido para SVG.'),
          );
        }
      };
      reader.onerror = () =>
        reject(new Error('Erro ao ler o ficheiro para vetorização.'));
      reader.readAsDataURL(file);
    });
  };

  const processFiles = async () => {
    if (files.length === 0) return;

    setIsProcessing(true);
    setProcessedFiles([]);

    const results: ProcessedFile[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        let result: ConversionResult | undefined;
        if (targetFormat === 'webp') {
          result = await convertToWebP(file);
        } else if (targetFormat === 'svg') {
          result = await convertToSVG(file);
        }

        if (result) {
          results.push({ ...result, status: 'success' });
        }
      } catch (error: unknown) {
        console.error(`Erro a processar ${file.name}:`, error);
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        results.push({
          originalName: file.name,
          status: 'error',
          error: errorMessage,
        });
      }
    }

    setProcessedFiles(results);
    setFiles([]);
    setIsProcessing(false);
  };

  const clearResults = () => {
    setProcessedFiles([]);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans p-6 md:p-12">
      <main className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <header className="text-center space-y-2">
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">
            Praxis <span className="text-[#0acf8f]">Converter</span>
          </h1>
          <p className="text-slate-500 text-lg">
            Converta as suas imagens PNG e JPG para WebP ou SVG (Vetor) de forma
            local e segura.
          </p>
        </header>

        {/* Control Panel */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-6 justify-between items-center">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <Settings2 className="text-slate-400" />
            <div className="flex flex-col">
              <label className="text-sm font-medium text-slate-700 mb-1">
                Formato de Saída
              </label>
              <select
                className="bg-slate-100 border-none rounded-lg px-4 py-2 text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all cursor-pointer"
                value={targetFormat}
                onChange={(e) => setTargetFormat(e.target.value)}>
                <option value="webp">WebP (Comprimido)</option>
                <option value="svg" disabled={!tracerLoaded}>
                  SVG (Vetorizado) {!tracerLoaded && '- A carregar...'}
                </option>
              </select>
            </div>
          </div>

          {targetFormat === 'webp' && (
            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="flex flex-col w-full md:w-48">
                <div className="flex justify-between">
                  <label className="text-sm font-medium text-slate-700 mb-1">
                    Qualidade WebP
                  </label>
                  <span className="text-sm text-slate-500">
                    {Math.round(quality * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.1"
                  value={quality}
                  onChange={(e) => setQuality(parseFloat(e.target.value))}
                  className="w-full accent-blue-600"
                />
                <span className="text-xs text-slate-400 mt-1">
                  80% é o original
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Dropzone */}
        <div
          className={`border-2 border-dashed rounded-3xl p-12 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-4
            ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-white hover:border-blue-400 hover:bg-slate-50'}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileInput}
            className="hidden"
            multiple
            accept="image/png, image/jpeg, image/jpg"
          />
          <div
            className={`p-4 rounded-full ${isDragging ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
            <UploadCloud size={48} strokeWidth={1.5} />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-slate-800">
              Arraste as suas imagens para aqui
            </h3>
            <p className="text-slate-500 mt-2">
              ou clique para selecionar os ficheiros do seu dispositivo
            </p>
          </div>
          <p className="text-xs text-slate-400 mt-4">
            Suporta JPG e PNG. O processamento ocorre 100% no seu browser.
          </p>
        </div>

        {/* Queue & Processing Actions */}
        {files.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 animate-in fade-in slide-in-from-bottom-4">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <ImageIcon className="text-blue-500" size={20} />
              Ficheiros Prontos a Converter ({files.length})
            </h3>
            <ul className="space-y-3 mb-6 max-h-60 overflow-y-auto pr-2">
              {files.map((file, idx) => (
                <li
                  key={idx}
                  className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <span className="text-sm font-medium truncate pr-4">
                    {file.name}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400">
                      {(file.size / 1024).toFixed(1)} KB
                    </span>
                    <button
                      onClick={() => removeFile(idx)}
                      className="text-slate-400 hover:text-red-500 transition-colors"
                      title="Remover">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex justify-end">
              <button
                onClick={processFiles}
                disabled={isProcessing}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-colors w-full md:w-auto justify-center">
                {isProcessing ?
                  <>
                    <Loader2 size={20} className="animate-spin" />A processar...
                  </>
                : <>Começar Conversão</>}
              </button>
            </div>
          </div>
        )}

        {/* Results */}
        {processedFiles.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-emerald-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold flex items-center gap-2 text-emerald-800">
                <CheckCircle2 className="text-emerald-500" size={20} />
                Resultados da Conversão
              </h3>
              <button
                onClick={clearResults}
                className="text-sm text-slate-500 hover:text-slate-800 transition-colors">
                Limpar Histórico
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {processedFiles.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center p-4 border border-slate-200 rounded-xl bg-slate-50 justify-between group hover:border-emerald-300 transition-colors">
                  <div className="flex flex-col overflow-hidden pr-4">
                    <span
                      className="text-sm font-semibold text-slate-800 truncate"
                      title={file.name || file.originalName}>
                      {file.name || file.originalName}
                    </span>
                    {file.status === 'success' ?
                      <span className="text-xs text-emerald-600 font-medium flex items-center gap-2">
                        Conversão bem-sucedida
                        {file.size && (
                          <span className="text-slate-400 font-normal">
                            • {(file.size / 1024).toFixed(1)} KB
                          </span>
                        )}
                      </span>
                    : <span className="text-xs text-red-500 font-medium flex items-center gap-1">
                        <AlertCircle size={12} /> Erro: {file.error}
                      </span>
                    }
                  </div>

                  {file.status === 'success' && (
                    <a
                      href={file.url}
                      download={file.name}
                      className="flex-shrink-0 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 p-2 rounded-lg transition-colors flex items-center gap-2"
                      title="Descarregar ficheiro">
                      <Download size={18} />
                      <span className="text-sm font-medium hidden sm:inline">
                        Descarregar
                      </span>
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer com Créditos */}
        <footer className="pt-12 pb-4 text-center text-slate-400 text-sm">
          <p>
            Uma ferramenta{' '}
            <span className="font-semibold text-slate-600">
              Praxis Platform
            </span>
          </p>
          <p className="mt-1 text-xs">
            Desenvolvido por{' '}
            <a
              href="https://www.linkedin.com/in/guilhermefitl"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-slate-500 hover:text-blue-600 underline underline-offset-2 transition-colors">
              fitlgui
            </a>
          </p>
        </footer>
      </main>
    </div>
  );
}
