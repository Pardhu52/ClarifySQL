import { DatabaseSchema, SQLValidationResult, SQLValidationError } from '../types';

export class ClientSQLValidator {
  private schema: DatabaseSchema;
  private knownTables: Set<string>;
  private tableColumns: Map<string, Set<string>>;

  constructor(schema: DatabaseSchema) {
    this.schema = schema;
    this.knownTables = new Set(schema.tables.map(t => t.name.toLowerCase()));
    this.tableColumns = new Map();
    for (const t of schema.tables) {
      this.tableColumns.set(t.name.toLowerCase(), new Set(t.columns.map(c => c.name.toLowerCase())));
    }
  }

  validate(sql: string): SQLValidationResult {
    const errors: SQLValidationError[] = [];
    const warnings: string[] = [];
    const trimmed = sql.trim();

    if (!trimmed) {
      return {
        isValid: false,
        referencedTables: [],
        referencedColumns: [],
        errors: [{ errorType: 'SYNTAX_ERROR', message: 'SQL statement cannot be empty' }],
        warnings: [],
        isReadOnly: true,
      };
    }

    const upper = trimmed.toUpperCase();
    const disallowedKeywords = ['DROP', 'DELETE', 'INSERT', 'UPDATE', 'ALTER', 'CREATE', 'TRUNCATE', 'REPLACE', 'GRANT', 'REVOKE'];
    for (const kw of disallowedKeywords) {
      const regex = new RegExp(`\\b${kw}\\b`, 'i');
      if (regex.test(sql)) {
        errors.push({
          errorType: 'UNSAFE_STATEMENT',
          message: `Forbidden DDL/DML keyword '${kw}'. ClarifySQL strictly enforces read-only queries (SELECT / WITH).`,
          suggestedFix: 'Remove destructive command and use a SELECT statement.',
        });
      }
    }

    // Extract table names
    const referencedTables: string[] = [];
    const tableRegex = /\b(?:FROM|JOIN)\s+([a-zA-Z0-9_]+)/gi;
    let match;
    while ((match = tableRegex.exec(sql)) !== null) {
      const tbl = match[1].toLowerCase();
      if (!referencedTables.includes(tbl)) {
        referencedTables.push(tbl);
      }
    }

    // Check for unknown tables
    for (const tbl of referencedTables) {
      if (!this.knownTables.has(tbl)) {
        errors.push({
          errorType: 'UNKNOWN_TABLE',
          message: `Table '${tbl}' does not exist in schema '${this.schema.databaseId}'.`,
          suggestedFix: `Available tables: ${Array.from(this.knownTables).join(', ')}`,
        });
      }
    }

    // Extract columns (e.g. table.col or standalone col)
    const referencedColumns: string[] = [];
    const colDotRegex = /\b([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)\b/g;
    while ((match = colDotRegex.exec(sql)) !== null) {
      const tbl = match[1].toLowerCase();
      const col = match[2].toLowerCase();
      if (this.knownTables.has(tbl)) {
        referencedColumns.push(`${tbl}.${col}`);
        const colsInTable = this.tableColumns.get(tbl);
        if (colsInTable && !colsInTable.has(col)) {
          errors.push({
            errorType: 'UNKNOWN_COLUMN',
            message: `Column '${col}' does not exist on table '${tbl}'.`,
            suggestedFix: `Known columns on ${tbl}: ${Array.from(colsInTable).join(', ')}`,
          });
        }
      }
    }

    if (!upper.includes('LIMIT') && referencedTables.length > 0) {
      warnings.push('Query does not specify an explicit LIMIT clause; default limit of 100 will be enforced.');
    }

    return {
      isValid: errors.length === 0,
      sanitizedSql: trimmed,
      statementType: upper.startsWith('WITH') ? 'WITH' : 'SELECT',
      referencedTables,
      referencedColumns,
      errors,
      warnings,
      isReadOnly: errors.filter(e => e.errorType === 'UNSAFE_STATEMENT').length === 0,
    };
  }
}
