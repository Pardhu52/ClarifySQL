export interface ColumnMetadata {
  name: string;
  dataType: string;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  foreignKeyTarget?: string;
  sampleValues?: (string | number | boolean | null)[];
  description?: string;
}

export interface ForeignKeyConstraint {
  constrainedColumn: string;
  referencedTable: string;
  referencedColumn: string;
}

export interface TableMetadata {
  name: string;
  columns: ColumnMetadata[];
  primaryKeys: string[];
  foreignKeys: ForeignKeyConstraint[];
  rowCount: number;
  description?: string;
}

export interface DatabaseSchema {
  databaseId: string;
  databaseName: string;
  databaseType: string;
  tables: TableMetadata[];
  summary: string;
}

export interface GraphNode {
  id: string;
  label: string;
  nodeType: 'table' | 'column';
  dataType?: string;
  tableName?: string;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
}

export interface GraphEdge {
  source: string;
  target: string;
  relationType: 'has_column' | 'foreign_key' | 'joined_with';
  label?: string;
}

export interface SchemaGraphResponse {
  databaseId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  tableCount: number;
  columnCount: number;
  foreignKeyCount: number;
}

export interface ClarificationOption {
  id: string;
  label: string;
  description: string;
  targetColumn?: string;
  targetTable?: string;
  exampleValue?: string;
}

export interface ClarificationRequest {
  needsClarification: boolean;
  ambiguityType?: 'COLUMN_AMBIGUITY' | 'TABLE_JOIN_AMBIGUITY' | 'TEMPORAL_FILTER' | 'VALUE_DISAMBIGUATION';
  ambiguousTerm?: string;
  question?: string;
  options: ClarificationOption[];
  confidenceScore: number;
}

export interface SQLValidationError {
  errorType: 'SYNTAX_ERROR' | 'UNSAFE_STATEMENT' | 'UNKNOWN_TABLE' | 'UNKNOWN_COLUMN' | 'TIMEOUT_RISK';
  message: string;
  location?: string;
  suggestedFix?: string;
}

export interface SQLValidationResult {
  isValid: boolean;
  sanitizedSql?: string;
  statementType?: string;
  referencedTables: string[];
  referencedColumns: string[];
  errors: SQLValidationError[];
  warnings: string[];
  isReadOnly: boolean;
}

export interface SQLExecutionResult {
  success: boolean;
  databaseId: string;
  columns: string[];
  rows: Record<string, any>[];
  rowCount: number;
  executionTimeMs: number;
  truncated?: boolean;
  error?: string;
  validation?: SQLValidationResult;
}

export interface ExplainabilityReport {
  status: 'ANSWERABLE' | 'AMBIGUOUS' | 'UNANSWERABLE' | 'VALIDATION_ERROR' | 'EXECUTION_ERROR';
  summaryReason: string;
  candidates?: {
    token: string;
    matchedAttribute: string;
    score: number;
    reason?: string;
  }[];
  suggestedClarification?: string;
  tablesUsed: string[];
  columnsUsed: string[];
  safetyChecksPassed: boolean;
  executionMetrics?: {
    executionTimeMs?: number;
    rowCount?: number;
    truncated?: boolean;
  };
}

export interface TextToSQLResponse {
  query: string;
  databaseId: string;
  sql?: string | null;
  clarification?: ClarificationRequest | null;
  explanation: string;
  tablesInvolved: string[];
  columnsInvolved: string[];
  engine: string;
  validation?: SQLValidationResult;
  explainability?: ExplainabilityReport;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  timestamp: string;
  query?: string;
  response?: TextToSQLResponse;
  sql?: string;
  executionResult?: SQLExecutionResult;
  selectedOptionId?: string;
  error?: string;
}
