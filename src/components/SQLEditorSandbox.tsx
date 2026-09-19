import React, { useState } from 'react';
import { Play, ShieldAlert, ShieldCheck, CheckCircle2, AlertTriangle, RefreshCw, Terminal, Layers } from 'lucide-react';
import { DatabaseSchema, SQLExecutionResult, SQLValidationResult } from '../types';
import { ClientSQLValidator } from '../utils/sqlValidator';

interface SQLEditorSandboxProps {
  schema: DatabaseSchema;
  onExecute: (sql: string) => Promise<SQLExecutionResult>;
}

export const SQLEditorSandbox: React.FC<SQLEditorSandboxProps> = ({ schema, onExecute }) => {
  const [sql, setSql] = useState<string>(
    `-- Test your SQL query here or experiment with safety checks
SELECT c.customer_id, c.first_name, c.email,
       COUNT(o.order_id) AS total_orders,
       ROUND(SUM(o.total_amount), 2) AS total_spent
FROM customers c
LEFT JOIN orders o ON c.customer_id = o.customer_id
GROUP BY c.customer_id
ORDER BY total_spent DESC
LIMIT 5;`
  );

  const [validationResult, setValidationResult] = useState<SQLValidationResult | null>(null);
  const [executionResult, setExecutionResult] = useState<SQLExecutionResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  const validator = new ClientSQLValidator(schema);

  const handleValidate = () => {
    const res = validator.validate(sql);
    setValidationResult(res);
  };

  const handleRun = async () => {
    const val = validator.validate(sql);
    setValidationResult(val);
    if (!val.isValid && !val.isReadOnly) {
      setExecutionResult({
        success: false,
        databaseId: schema.databaseId,
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: 0,
        error: val.errors.map((e) => e.message).join(' | '),
      });
      return;
    }

    setIsExecuting(true);
    try {
      const res = await onExecute(sql);
      setExecutionResult(res);
    } catch (err: any) {
      setExecutionResult({
        success: false,
        databaseId: schema.databaseId,
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: 0,
        error: err.message || 'Execution failed',
      });
    } finally {
      setIsExecuting(false);
    }
  };

  // Test bad query quick buttons
  const loadExample = (type: 'valid' | 'blocked_drop' | 'hallucinated_col') => {
    if (type === 'valid') {
      setSql(`SELECT product_name, sale_price, stock_quantity FROM products WHERE stock_quantity < 50;`);
    } else if (type === 'blocked_drop') {
      setSql(`DROP TABLE customers; -- Attempting destructive DDL injection`);
    } else if (type === 'hallucinated_col') {
      setSql(`SELECT customer_id, non_existent_column, fake_field FROM customers;`);
    }
  };

  return (
    <div className="h-full flex flex-col bg-stone-100 overflow-hidden">
      {/* Top toolbar */}
      <div className="bg-white border-b border-stone-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Terminal className="w-5 h-5 text-stone-700" />
          <div>
            <h2 className="text-sm font-bold text-stone-900">
              Interactive SQL Safety Sandbox
            </h2>
            <p className="text-xs text-stone-500">
              Test queries directly with SQLGlot AST validation, schema hallucination checks, and read-only execution guardrails.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-stone-500 font-medium">Test Presets:</span>
          <button
            onClick={() => loadExample('valid')}
            className="text-xs px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded transition-colors"
          >
            Safe Read Query
          </button>
          <button
            onClick={() => loadExample('blocked_drop')}
            className="text-xs px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 rounded border border-rose-200 transition-colors"
          >
            Blocked DDL (DROP TABLE)
          </button>
          <button
            onClick={() => loadExample('hallucinated_col')}
            className="text-xs px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded border border-amber-200 transition-colors"
          >
            Hallucinated Column
          </button>
        </div>
      </div>

      {/* Editor & Validation Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 divide-x divide-stone-200 overflow-hidden">
        {/* Left: Code Editor */}
        <div className="flex flex-col bg-white overflow-hidden">
          <div className="bg-stone-50 border-b border-stone-200 px-4 py-2 flex items-center justify-between text-xs text-stone-600">
            <span className="font-mono font-medium">SQLite Editor ({schema.databaseId}.db)</span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleValidate}
                className="px-2.5 py-1 rounded bg-stone-200/80 hover:bg-stone-300 text-stone-800 font-medium text-xs transition-colors"
              >
                Validate AST
              </button>
              <button
                onClick={handleRun}
                disabled={isExecuting}
                className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                {isExecuting ? 'Executing...' : 'Run Query'}
              </button>
            </div>
          </div>

          <textarea
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            className="flex-1 p-4 font-mono text-xs text-stone-900 bg-stone-950 text-stone-100 focus:outline-none resize-none leading-relaxed selection:bg-stone-700"
            placeholder="Write SQL..."
            spellCheck={false}
          />

          {/* Validation Status Bar */}
          {validationResult && (
            <div
              className={`p-3 border-t text-xs flex items-start gap-2.5 ${
                validationResult.isValid
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              {validationResult.isValid ? (
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <div className="font-bold">
                  {validationResult.isValid
                    ? 'Security & Schema Validation Passed'
                    : 'Validation Issues Detected'}
                </div>
                {validationResult.errors.map((err, i) => (
                  <p key={i} className="text-[11px] mt-0.5 font-medium">
                    • [{err.errorType}] {err.message}
                  </p>
                ))}
                {validationResult.warnings.map((warn, i) => (
                  <p key={i} className="text-[11px] text-amber-800 mt-0.5">
                    • Warning: {warn}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Results & Schema Context */}
        <div className="flex flex-col bg-stone-50 overflow-y-auto p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700">
              Execution Output & Explainability
            </h3>
            {executionResult && (
              <span className="text-[11px] font-mono text-stone-500">
                {executionResult.rowCount} rows • {executionResult.executionTimeMs}ms
              </span>
            )}
          </div>

          {executionResult ? (
            executionResult.success ? (
              <div className="bg-white border border-stone-200 rounded-lg shadow-sm overflow-hidden">
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-stone-100 border-b border-stone-200 sticky top-0">
                      <tr>
                        {executionResult.columns.map((c) => (
                          <th key={c} className="py-2 px-3 font-mono font-semibold text-stone-700 text-[11px]">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 font-mono text-stone-800 text-[11px]">
                      {executionResult.rows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-stone-50">
                          {executionResult.columns.map((c) => (
                            <td key={c} className="py-1.5 px-3 whitespace-nowrap">
                              {row[c] !== null ? String(row[c]) : <span className="text-stone-400">null</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 text-xs text-rose-900">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  Execution Prevented / Failed
                </div>
                <p className="mt-1 font-mono text-[11px]">{executionResult.error}</p>
              </div>
            )
          ) : (
            <div className="bg-white border border-stone-200 rounded-lg p-8 text-center text-stone-400 text-xs">
              Write or select a query on the left and click "Run Query" to execute.
            </div>
          )}

          {/* Quick Table Reference card */}
          <div className="bg-white border border-stone-200 rounded-lg p-4">
            <h4 className="text-xs font-bold text-stone-800 mb-2 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-stone-500" />
              Available Tables in {schema.databaseId}
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {schema.tables.map((t) => (
                <span
                  key={t.name}
                  className="px-2 py-1 bg-stone-100 border border-stone-200 rounded text-xs font-mono text-stone-700"
                  title={`${t.columns.length} columns`}
                >
                  {t.name} ({t.rowCount})
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
