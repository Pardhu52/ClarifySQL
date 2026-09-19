import React from 'react';
import { Database, AlertTriangle, ShieldCheck, Terminal, Compass, Layers } from 'lucide-react';
import { DatabaseSchema } from '../types';

interface HeaderProps {
  databases: DatabaseSchema[];
  selectedDb: DatabaseSchema;
  onSelectDb: (db: DatabaseSchema) => void;
  activeTab: 'chat' | 'schema' | 'benchmark' | 'editor';
  setActiveTab: (tab: 'chat' | 'schema' | 'benchmark' | 'editor') => void;
}

export const Header: React.FC<HeaderProps> = ({
  databases,
  selectedDb,
  onSelectDb,
  activeTab,
  setActiveTab,
}) => {
  return (
    <header className="border-b border-stone-200 bg-stone-50 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
      {/* Brand & Concept */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-stone-900 flex items-center justify-center text-white font-semibold text-base shadow-sm">
          <Layers className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight text-stone-900 font-sans">
              ClarifySQL
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
              Interactive Viva Demo
            </span>
          </div>
          <p className="text-xs text-stone-500 font-medium">
            Adaptive Schema-Grounded Clarification for Conversational Text-to-SQL
          </p>
        </div>
      </div>

      {/* Database Selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider flex items-center gap-1.5">
          <Database className="w-3.5 h-3.5 text-stone-400" />
          Active Database:
        </span>
        <select
          value={selectedDb.databaseId}
          onChange={(e) => {
            const found = databases.find((d) => d.databaseId === e.target.value);
            if (found) onSelectDb(found);
          }}
          className="text-xs font-medium text-stone-900 bg-white border border-stone-300 rounded-md px-2.5 py-1.5 shadow-sm focus:outline-none focus:ring-1 focus:ring-stone-900 hover:border-stone-400 cursor-pointer"
        >
          {databases.map((db) => (
            <option key={db.databaseId} value={db.databaseId}>
              {db.databaseName} ({db.tables.length} tables)
            </option>
          ))}
        </select>
      </div>

      {/* Navigation tabs */}
      <nav className="flex items-center space-x-1 bg-stone-200/70 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('chat')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
            activeTab === 'chat'
              ? 'bg-white text-stone-900 shadow-sm'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          Conversational Studio
        </button>
        <button
          onClick={() => setActiveTab('schema')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
            activeTab === 'schema'
              ? 'bg-white text-stone-900 shadow-sm'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          Schema Inspector & Graph
        </button>
        <button
          onClick={() => setActiveTab('editor')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
            activeTab === 'editor'
              ? 'bg-white text-stone-900 shadow-sm'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          SQL Safety Sandbox
        </button>
        <button
          onClick={() => setActiveTab('benchmark')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
            activeTab === 'benchmark'
              ? 'bg-white text-stone-900 shadow-sm'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          Viva & Evaluation Defense
        </button>
      </nav>
    </header>
  );
};
