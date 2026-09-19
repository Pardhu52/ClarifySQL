import React, { useState } from 'react';
import { Database, Key, Link2, Eye, Table2, Layers, Search } from 'lucide-react';
import { DatabaseSchema, TableMetadata } from '../types';

interface SchemaViewerProps {
  schema: DatabaseSchema;
}

export const SchemaViewer: React.FC<SchemaViewerProps> = ({ schema }) => {
  const [selectedTableName, setSelectedTableName] = useState<string>(
    schema.tables[0]?.name || ''
  );
  const [searchFilter, setSearchFilter] = useState('');

  const selectedTable: TableMetadata | undefined = schema.tables.find(
    (t) => t.name === selectedTableName
  ) || schema.tables[0];

  const filteredTables = schema.tables.filter((t) =>
    t.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
    t.columns.some((c) => c.name.toLowerCase().includes(searchFilter.toLowerCase()))
  );

  return (
    <div className="flex h-full bg-stone-100 overflow-hidden">
      {/* Sidebar: Table Catalog */}
      <div className="w-72 bg-white border-r border-stone-200 flex flex-col shrink-0">
        <div className="p-3.5 border-b border-stone-200">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-stone-400" />
            <input
              type="text"
              placeholder="Search tables or columns..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-900 focus:bg-white"
            />
          </div>
          <div className="flex items-center justify-between mt-2.5 px-0.5 text-[11px] text-stone-500 font-medium">
            <span>{schema.tables.length} Tables Introspected</span>
            <span className="font-mono text-stone-600 bg-stone-100 px-1.5 py-0.5 rounded">
              {schema.databaseType}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-stone-100">
          {filteredTables.map((tbl) => {
            const isSelected = tbl.name === selectedTable?.name;
            return (
              <button
                key={tbl.name}
                onClick={() => setSelectedTableName(tbl.name)}
                className={`w-full text-left p-3 transition-colors flex items-start justify-between ${
                  isSelected
                    ? 'bg-stone-100 border-l-2 border-stone-900'
                    : 'hover:bg-stone-50'
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <Table2 className="w-3.5 h-3.5 text-stone-500" />
                    <span className="text-xs font-semibold text-stone-900 font-mono">
                      {tbl.name}
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500 line-clamp-1 mt-0.5">
                    {tbl.description || `${tbl.columns.length} columns`}
                  </p>
                </div>
                <span className="text-[10px] font-mono text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded">
                  {tbl.rowCount} rows
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Panel: Table Details, Schema, Types, Foreign Keys */}
      <div className="flex-1 flex flex-col overflow-y-auto p-6 space-y-6">
        {selectedTable ? (
          <>
            {/* Header info */}
            <div className="bg-white p-5 rounded-lg border border-stone-200 shadow-sm flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-stone-900 font-mono">
                    {selectedTable.name}
                  </h2>
                  <span className="text-xs font-medium bg-stone-100 text-stone-700 px-2 py-0.5 rounded">
                    {selectedTable.rowCount} Total Records
                  </span>
                </div>
                <p className="text-xs text-stone-600 mt-1 max-w-2xl">
                  {selectedTable.description || 'Introspected relational table schema.'}
                </p>
              </div>

              {selectedTable.foreignKeys.length > 0 && (
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                    Foreign Key Joins
                  </span>
                  {selectedTable.foreignKeys.map((fk, idx) => (
                    <span
                      key={idx}
                      className="text-xs font-mono bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded flex items-center gap-1"
                    >
                      <Link2 className="w-3 h-3 text-amber-600" />
                      {fk.constrainedColumn} → {fk.referencedTable}.{fk.referencedColumn}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Column Schema Table */}
            <div className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                  Introspected Column Schema & Constraints
                </h3>
                <span className="text-xs text-stone-500">
                  {selectedTable.columns.length} Total Columns
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-stone-200 bg-stone-50/50 text-[11px] font-semibold text-stone-600 uppercase">
                      <th className="py-2.5 px-4">Column Name</th>
                      <th className="py-2.5 px-4">Data Type</th>
                      <th className="py-2.5 px-4">Key Constraints</th>
                      <th className="py-2.5 px-4">Representative Sample Values</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {selectedTable.columns.map((col) => (
                      <tr key={col.name} className="hover:bg-stone-50/60">
                        <td className="py-2.5 px-4 font-mono font-medium text-stone-900 flex items-center gap-1.5">
                          {col.isPrimaryKey && (
                            <span title="Primary Key">
                              <Key className="w-3 h-3 text-emerald-600 shrink-0" />
                            </span>
                          )}
                          {col.isForeignKey && (
                            <span title="Foreign Key">
                              <Link2 className="w-3 h-3 text-amber-600 shrink-0" />
                            </span>
                          )}
                          <span>{col.name}</span>
                        </td>
                        <td className="py-2.5 px-4 font-mono text-stone-600">
                          <span className="px-1.5 py-0.5 bg-stone-100 rounded text-[11px]">
                            {col.dataType}
                          </span>
                        </td>
                        <td className="py-2.5 px-4">
                          {col.isPrimaryKey && (
                            <span className="inline-flex items-center text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded mr-1">
                              PRIMARY KEY
                            </span>
                          )}
                          {col.isForeignKey && (
                            <span className="inline-flex items-center text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded">
                              FK → {col.foreignKeyTarget}
                            </span>
                          )}
                          {!col.isPrimaryKey && !col.isForeignKey && (
                            <span className="text-stone-400 text-[11px]">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-stone-600">
                          {col.sampleValues && col.sampleValues.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {col.sampleValues.map((val, idx) => (
                                <span
                                  key={idx}
                                  className="bg-stone-100 text-stone-700 px-1.5 py-0.5 rounded text-[11px]"
                                >
                                  {val !== null ? String(val) : 'null'}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-stone-400 italic">None cached</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Relational Graph View / Join Topology */}
            <div className="bg-white rounded-lg border border-stone-200 p-5 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700 mb-3 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-stone-500" />
                Network Relational Topology for {schema.databaseId}
              </h3>
              <p className="text-xs text-stone-600 mb-4">
                The NetworkX graph structure maps tables and column attributes into connected nodes. Queries between non-adjacent tables traverse these foreign-key bridges.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {schema.tables.map((t) => (
                  <div
                    key={t.name}
                    className={`p-3.5 rounded-md border text-xs ${
                      t.name === selectedTable.name
                        ? 'border-stone-900 bg-stone-50'
                        : 'border-stone-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono font-bold text-stone-900">
                        {t.name}
                      </span>
                      <span className="text-[10px] text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded">
                        {t.columns.length} cols
                      </span>
                    </div>

                    <div className="space-y-1">
                      {t.foreignKeys.length > 0 ? (
                        t.foreignKeys.map((fk, idx) => (
                          <div
                            key={idx}
                            className="text-[11px] font-mono text-stone-600 flex items-center gap-1"
                          >
                            <Link2 className="w-3 h-3 text-amber-500" />
                            <span>{fk.constrainedColumn}</span>
                            <span className="text-stone-400">→</span>
                            <span className="font-semibold text-stone-800">
                              {fk.referencedTable}
                            </span>
                          </div>
                        ))
                      ) : (
                        <span className="text-[11px] text-stone-400 italic">
                          Root entity (no outbound foreign keys)
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-stone-400 text-sm">
            Select a table from the sidebar catalog to view schema details.
          </div>
        )}
      </div>
    </div>
  );
};
