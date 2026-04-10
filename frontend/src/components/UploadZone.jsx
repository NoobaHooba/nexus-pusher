import React, { useRef, useState } from 'react';
import ExtraFieldsForm from './ExtraFieldsForm';

export default function UploadZone({ onFiles, repoType, extraFields, onExtraChange }) {
  const inputRef = useRef();
  const [dragging, setDragging] = useState(false);

  const handleFiles = (files) => {
    if (files && files.length > 0) onFiles(Array.from(files));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="flex flex-col gap-6">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current.click()}
        className={`relative group border-2 border-dashed rounded-3xl p-16 bg-white flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
          dragging ? 'border-accent/60 bg-accent-dim/10' : 'border-slate-200 hover:border-accent/40'
        }`}
      >
        <div className={`w-20 h-20 bg-accent-dim rounded-2xl flex items-center justify-center mb-6 transition-transform ${
          dragging ? 'scale-110' : 'group-hover:scale-110'
        }`}>
          <span className="material-symbols-outlined text-4xl text-accent">upload_file</span>
        </div>
        <h4 className="text-2xl font-bold text-primary mb-2">Drop artifacts or click to browse</h4>
        <p className="text-on-surface-variant max-w-sm mb-8">Securely upload packages to your private Nexus repository</p>
        <button
          type="button"
          className="bg-primary text-white px-8 py-3.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-black transition-colors shadow-lg shadow-black/5"
          onClick={(e) => { e.stopPropagation(); inputRef.current.click(); }}
        >
          <span className="material-symbols-outlined text-xl">add</span>
          Select Local Assets
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>
      <ExtraFieldsForm repoType={repoType} values={extraFields} onChange={onExtraChange} />
    </div>
  );
}
