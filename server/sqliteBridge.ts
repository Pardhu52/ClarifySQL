import { spawn } from 'child_process';
import path from 'path';

export interface SqlExecutionResult {
  success: boolean;
  database_id: string;
  columns: string[];
  rows: Record<string, any>[];
  row_count: number;
  execution_time_ms: number;
  error?: string;
}

export function executeSqlSafe(databaseId: string, sql: string, maxRows: number = 100): Promise<SqlExecutionResult> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const dbPath = path.resolve(process.cwd(), 'backend', 'data', `${databaseId}.db`);

    // Basic read-only safety guardrail
    const trimmed = sql.trim().toUpperCase();
    if (!trimmed.startsWith('SELECT') && !trimmed.startsWith('WITH') && !trimmed.startsWith('EXPLAIN')) {
      return resolve({
        success: false,
        database_id: databaseId,
        columns: [],
        rows: [],
        row_count: 0,
        execution_time_ms: 0,
        error: 'Execution blocked: ClarifySQL enforces strictly read-only statements (SELECT / WITH).',
      });
    }

    const dangerousKeywords = ['DROP', 'DELETE', 'INSERT', 'UPDATE', 'ALTER', 'CREATE', 'ATTACH', 'DETACH', 'PRAGMA'];
    for (const kw of dangerousKeywords) {
      const regex = new RegExp(`\\b${kw}\\b`, 'i');
      if (regex.test(sql)) {
        return resolve({
          success: false,
          database_id: databaseId,
          columns: [],
          rows: [],
          row_count: 0,
          execution_time_ms: 0,
          error: `Execution blocked: Disallowed SQL keyword '${kw}'. Read-only queries only.`,
        });
      }
    }

    const pythonScript = `
import sqlite3, json, sys

db_path = ${JSON.stringify(dbPath)}
query = ${JSON.stringify(sql)}
max_rows = ${maxRows}

try:
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True, timeout=5.0)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute(query)
    rows = cur.fetchmany(max_rows)
    col_names = [d[0] for d in cur.description] if cur.description else []
    
    dict_rows = []
    for r in rows:
        dict_rows.append({col: r[col] for col in col_names})
        
    print(json.dumps({"success": True, "columns": col_names, "rows": dict_rows}))
except Exception as e:
    print(json.dumps({"success": False, "error": str(e)}))
`;

    const pyProcess = spawn('python3', ['-c', pythonScript]);
    let output = '';
    let errorOutput = '';

    pyProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    pyProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    pyProcess.on('close', (code) => {
      const executionTime = Date.now() - startTime;
      if (code !== 0) {
        return resolve({
          success: false,
          database_id: databaseId,
          columns: [],
          rows: [],
          row_count: 0,
          execution_time_ms: executionTime,
          error: errorOutput.trim() || `Process exited with code ${code}`,
        });
      }

      try {
        const result = JSON.parse(output.trim());
        if (result.success) {
          resolve({
            success: true,
            database_id: databaseId,
            columns: result.columns,
            rows: result.rows,
            row_count: result.rows.length,
            execution_time_ms: executionTime,
          });
        } else {
          resolve({
            success: false,
            database_id: databaseId,
            columns: [],
            rows: [],
            row_count: 0,
            execution_time_ms: executionTime,
            error: result.error,
          });
        }
      } catch (err: any) {
        resolve({
          success: false,
          database_id: databaseId,
          columns: [],
          rows: [],
          row_count: 0,
          execution_time_ms: executionTime,
          error: `JSON parsing error: ${err.message}. Raw output: ${output}`,
        });
      }
    });
  });
}
