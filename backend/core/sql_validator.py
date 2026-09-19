"""ClarifySQL SQLGlot Safety & Schema Validation Engine.

Parses generated SQL, enforces read-only safety (SELECT/WITH only),
verifies table and column existence against introspected schema,
detects hallucinated schema elements, and sanitizes execution bounds.
"""

from typing import List, Optional, Set
import sqlglot
from sqlglot import exp
from sqlglot.errors import ParseError

from backend.models.schemas import (
    DatabaseSchema,
    SQLValidationError,
    SQLValidationResult,
)


class SQLValidator:
    """Validates SQL queries against database schema and security policies."""

    DISALLOWED_EXPRESSIONS = (
        exp.Insert,
        exp.Update,
        exp.Delete,
        exp.Drop,
        exp.Alter,
        exp.Create,
        exp.Command,
        exp.Pragma,
    )

    FORBIDDEN_KEYWORDS = {
        "ATTACH",
        "DETACH",
        "LOAD_EXTENSION",
        "EXEC",
        "EXECUTE",
        "XP_CMDSHELL",
    }

    def __init__(self, schema: DatabaseSchema, max_row_limit: int = 500):
        self.schema = schema
        self.max_row_limit = max_row_limit

        # Index tables and columns for fast O(1) lookup
        self.known_tables: Set[str] = {t.name.lower() for t in schema.tables}
        self.table_column_map: dict[str, Set[str]] = {
            t.name.lower(): {c.name.lower() for c in t.columns}
            for t in schema.tables
        }
        self.all_known_columns: Set[str] = {
            c.name.lower() for t in schema.tables for c in t.columns
        }

    def validate(self, sql: str, dialect: str = "sqlite") -> SQLValidationResult:
        """Thoroughly parses and validates a SQL query string."""
        errors: List[SQLValidationError] = []
        warnings: List[str] = []
        is_read_only = True
        referenced_tables: List[str] = []
        referenced_columns: List[str] = []
        ast_tree_repr: Optional[str] = None
        statement_type: Optional[str] = None
        sanitized_sql = sql.strip().rstrip(";")

        # 1. Check for forbidden keywords before parsing
        upper_sql = sql.upper()
        for forbidden in self.FORBIDDEN_KEYWORDS:
            if forbidden in upper_sql.split():
                errors.append(
                    SQLValidationError(
                        error_type="UNSAFE_STATEMENT",
                        message=f"Query contains forbidden command/keyword: '{forbidden}'",
                        suggested_fix="Queries must be strictly read-only SELECT or WITH statements.",
                    )
                )
                is_read_only = False

        # 2. Parse SQL into AST with SQLGlot
        try:
            parsed_expressions = sqlglot.parse(sql, read=dialect)
        except ParseError as e:
            errors.append(
                SQLValidationError(
                    error_type="SYNTAX_ERROR",
                    message=f"SQL syntax error: {str(e)}",
                    suggested_fix="Verify SQL syntax according to dialect.",
                )
            )
            return SQLValidationResult(
                is_valid=False,
                sanitized_sql=sanitized_sql,
                errors=errors,
                warnings=warnings,
                is_read_only=False,
            )

        if not parsed_expressions or parsed_expressions[0] is None:
            errors.append(
                SQLValidationError(
                    error_type="SYNTAX_ERROR",
                    message="Empty or unparseable SQL statement.",
                )
            )
            return SQLValidationResult(
                is_valid=False,
                sanitized_sql=sanitized_sql,
                errors=errors,
                warnings=warnings,
                is_read_only=False,
            )

        # We evaluate the primary statement (or first if multiple)
        root_expr = parsed_expressions[0]
        ast_tree_repr = repr(root_expr)
        statement_type = root_expr.key.upper()

        # 3. Read-Only Safety Validation
        for disallowed in self.DISALLOWED_EXPRESSIONS:
            if root_expr.find(disallowed):
                is_read_only = False
                errors.append(
                    SQLValidationError(
                        error_type="UNSAFE_STATEMENT",
                        message=f"Forbidden DDL/DML operation detected: {disallowed.__name__}",
                        suggested_fix="Only read-only SELECT or CTE queries are permitted.",
                    )
                )

        # Must be Select, Union, or CTE with Select
        is_select_query = isinstance(root_expr, (exp.Select, exp.Union)) or bool(root_expr.find(exp.Select))
        if not is_select_query:
            is_read_only = False
            errors.append(
                SQLValidationError(
                    error_type="UNSAFE_STATEMENT",
                    message=f"Statement is not a query (found type: {statement_type}).",
                    suggested_fix="Use SELECT statements only.",
                )
            )

        # 4. Extract CTE names, CTE aliases, and query-defined column aliases
        cte_names: Set[str] = set()
        for cte in root_expr.find_all(exp.CTE):
            cte_alias = cte.alias_or_name
            if cte_alias:
                cte_names.add(cte_alias.lower())

        for tbl in root_expr.find_all(exp.Table):
            if tbl.name.lower() in cte_names:
                if tbl.alias:
                    cte_names.add(tbl.alias.lower())

        defined_column_aliases: Set[str] = set()
        for alias in root_expr.find_all(exp.Alias):
            if alias.alias:
                defined_column_aliases.add(alias.alias.lower())

        # 5. Extract and Validate Referenced Tables
        found_tables: Set[str] = set()
        for tbl in root_expr.find_all(exp.Table):
            tbl_name = tbl.name.lower()
            if not tbl_name or tbl_name in cte_names:
                continue

            found_tables.add(tbl_name)
            if tbl_name not in self.known_tables:
                errors.append(
                    SQLValidationError(
                        error_type="UNKNOWN_TABLE",
                        message=f"Table '{tbl.name}' does not exist in schema '{self.schema.database_id}'.",
                        suggested_fix=f"Available tables: {', '.join(sorted(self.known_tables))}",
                    )
                )

        referenced_tables = sorted(list(found_tables))

        # 6. Extract and Validate Referenced Columns
        found_columns: Set[str] = set()
        for col in root_expr.find_all(exp.Column):
            col_name = col.name.lower()
            table_qualifier = col.table.lower() if col.table else None

            # Skip wildcard '*'
            if col_name == "*":
                continue

            found_columns.add(f"{col.table}.{col.name}" if col.table else col.name)

            if table_qualifier:
                # If qualified with a CTE or CTE alias, skip physical schema check
                if table_qualifier in cte_names:
                    continue

                if table_qualifier in self.known_tables:
                    valid_cols_for_table = self.table_column_map.get(table_qualifier, set())
                    if col_name not in valid_cols_for_table and col_name not in defined_column_aliases:
                        errors.append(
                            SQLValidationError(
                                error_type="UNKNOWN_COLUMN",
                                message=f"Column '{col.name}' does not exist on table '{col.table}'.",
                                suggested_fix=f"Valid columns for '{col.table}': {', '.join(sorted(valid_cols_for_table))}",
                            )
                        )
            else:
                # Unqualified column: must exist in at least one referenced table, or be a defined alias
                if col_name in defined_column_aliases:
                    continue

                matching_tables = [
                    t for t in (found_tables or self.known_tables)
                    if col_name in self.table_column_map.get(t, set())
                ]
                if not matching_tables and col_name not in self.all_known_columns:
                    errors.append(
                        SQLValidationError(
                            error_type="UNKNOWN_COLUMN",
                            message=f"Column '{col.name}' could not be resolved to any table in the schema.",
                            suggested_fix=f"Verify column names in schema: {', '.join(sorted(self.all_known_columns)[:10])}...",
                        )
                    )

        referenced_columns = sorted(list(found_columns))

        # 7. Check / Enforce LIMIT clause
        limit_expr = root_expr.find(exp.Limit)
        if not limit_expr:
            warnings.append(f"No LIMIT specified; defaulting query limit to {self.max_row_limit} for safety.")
            sanitized_sql = f"{sanitized_sql} LIMIT {self.max_row_limit}"
        else:
            try:
                limit_val = int(str(limit_expr.expression))
                if limit_val > self.max_row_limit:
                    warnings.append(f"Specified LIMIT ({limit_val}) exceeds safety maximum ({self.max_row_limit}). Capping to {self.max_row_limit}.")
                    # Mutate expression to safety cap
                    limit_expr.set("expression", exp.Literal.number(self.max_row_limit))
                    sanitized_sql = root_expr.sql(dialect=dialect)
            except Exception:
                pass

        is_valid = len(errors) == 0 and is_read_only

        return SQLValidationResult(
            is_valid=is_valid,
            sanitized_sql=sanitized_sql,
            ast_tree=ast_tree_repr,
            statement_type=statement_type,
            referenced_tables=referenced_tables,
            referenced_columns=referenced_columns,
            errors=errors,
            warnings=warnings,
            is_read_only=is_read_only,
        )
