"""Pydantic data models for ClarifySQL Schema Introspection, Validation, and Execution."""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ColumnMetadata(BaseModel):
    name: str
    data_type: str
    is_primary_key: bool = False
    is_foreign_key: bool = False
    is_nullable: bool = True
    foreign_key_target: Optional[str] = None  # Format: "target_table.target_column"
    sample_values: List[Any] = Field(default_factory=list)
    description: Optional[str] = None


class ForeignKeyConstraint(BaseModel):
    constrained_column: str
    referenced_table: str
    referenced_column: str


class TableMetadata(BaseModel):
    name: str
    columns: List[ColumnMetadata]
    primary_keys: List[str] = Field(default_factory=list)
    foreign_keys: List[ForeignKeyConstraint] = Field(default_factory=list)
    row_count: int = 0
    description: Optional[str] = None


class DatabaseSchema(BaseModel):
    database_id: str
    database_type: str = "sqlite"  # sqlite or postgresql
    tables: List[TableMetadata]
    summary: Optional[str] = None


class GraphNode(BaseModel):
    id: str
    label: str
    node_type: str  # "table" or "column"
    data_type: Optional[str] = None
    table_name: Optional[str] = None
    is_primary_key: bool = False
    is_foreign_key: bool = False


class GraphEdge(BaseModel):
    source: str
    target: str
    relation_type: str  # "has_column", "foreign_key", "joined_with"
    label: Optional[str] = None


class SchemaGraphResponse(BaseModel):
    database_id: str
    nodes: List[GraphNode]
    edges: List[GraphEdge]
    table_count: int
    column_count: int
    foreign_key_count: int


class SQLValidationRequest(BaseModel):
    sql: str
    database_id: str
    dialect: str = "sqlite"


class SQLValidationError(BaseModel):
    error_type: str  # "SYNTAX_ERROR", "UNSAFE_STATEMENT", "UNKNOWN_TABLE", "UNKNOWN_COLUMN", "TIMEOUT_RISK"
    message: str
    location: Optional[str] = None
    suggested_fix: Optional[str] = None


class SQLValidationResult(BaseModel):
    is_valid: bool
    sanitized_sql: Optional[str] = None
    ast_tree: Optional[str] = None
    statement_type: Optional[str] = None  # e.g. "SELECT", "WITH"
    referenced_tables: List[str] = Field(default_factory=list)
    referenced_columns: List[str] = Field(default_factory=list)
    errors: List[SQLValidationError] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    is_read_only: bool = True


class SQLExecutionRequest(BaseModel):
    sql: str
    database_id: str
    max_rows: int = 100
    timeout_seconds: float = 5.0


class SQLExecutionResult(BaseModel):
    success: bool
    database_id: str
    columns: List[str] = Field(default_factory=list)
    rows: List[Dict[str, Any]] = Field(default_factory=list)
    row_count: int = 0
    total_available_rows: int = 0
    truncated: bool = False
    execution_time_ms: float = 0.0
    error: Optional[str] = None
    validation: Optional[SQLValidationResult] = None
