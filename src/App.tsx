import React, { useState } from 'react';
import { Header } from './components/Header';
import { ChatStudio } from './components/ChatStudio';
import { SchemaViewer } from './components/SchemaViewer';
import { SQLEditorSandbox } from './components/SQLEditorSandbox';
import { VivaDefenseView } from './components/VivaDefenseView';
import { BENCHMARK_DATABASES } from './data/schemas';
import { DatabaseSchema, SQLExecutionResult } from './types';

export default function App() {
  const [databases] = useState<DatabaseSchema[]>(BENCHMARK_DATABASES);
  const [selectedDb, setSelectedDb] = useState<DatabaseSchema>(BENCHMARK_DATABASES[0]);
  const [activeTab, setActiveTab] = useState<'chat' | 'schema' | 'benchmark' | 'editor'>('chat');

  // Shared SQL execution runner
  const handleExecuteSql = async (sql: string): Promise<SQLExecutionResult> => {
    const res = await fetch('/api/sql/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        database_id: selectedDb.databaseId,
        sql,
        max_rows: 100,
      }),
    });

    if (!res.ok) {
      throw new Error(`Server execution error (status ${res.status})`);
    }

    const data = await res.json();
    return {
      success: data.execution.success,
      databaseId: data.execution.database_id,
      columns: data.execution.columns || [],
      rows: data.execution.rows || [],
      rowCount: data.execution.row_count || 0,
      executionTimeMs: data.execution.execution_time_ms || 0,
      error: data.execution.error,
    };
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-stone-100 font-sans text-stone-900 antialiased selection:bg-stone-300">
      {/* Top App Header */}
      <Header
        databases={databases}
        selectedDb={selectedDb}
        onSelectDb={(db) => setSelectedDb(db)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Main Workspace Area */}
      <main className="flex-1 overflow-hidden relative">
        {activeTab === 'chat' && (
          <ChatStudio
            schema={selectedDb}
            onExecuteSql={handleExecuteSql}
          />
        )}

        {activeTab === 'schema' && (
          <SchemaViewer schema={selectedDb} />
        )}

        {activeTab === 'editor' && (
          <SQLEditorSandbox
            schema={selectedDb}
            onExecute={handleExecuteSql}
          />
        )}

        {activeTab === 'benchmark' && (
          <VivaDefenseView />
        )}
      </main>
    </div>
  );
}
