"""ClarifySQL Safe SQL Execution Engine.

Executes validated read-only SQL queries against SQLite/PostgreSQL
with strict timeout constraints, row caps, and performance metrics.
"""

import sqlite3
import time
from typing import Any, Dict, List, Optional
from backend.core.sql_validator import SQLValidator
from backend.models.schemas import (
    DatabaseSchema,
    SQLExecutionResult,
    SQLValidationResult,
)


class SQLExecutor:
    """Executes validated, safe SQL queries with guardrails."""

    def __init__(self, db_path: str, schema: DatabaseSchema):
        self.db_path = db_path
        self.schema = schema
        self.validator = SQLValidator(schema=schema)

    def execute(
        self,
        sql: str,
        max_rows: int = 100,
        timeout_seconds: float = 5.0,
        pre_validated_result: Optional[SQLValidationResult] = None,
    ) -> SQLExecutionResult:
        """Executes a SQL query after enforcing validation and safety caps."""
        # 1. Validation check
        validation = pre_validated_result or self.validator.validate(sql)
        if not validation.is_valid:
            error_msgs = [e.message for e in validation.errors]
            return SQLExecutionResult(
                success=False,
                database_id=self.schema.database_id,
                error="SQL validation failed: " + "; ".join(error_msgs),
                validation=validation,
            )

        target_sql = validation.sanitized_sql or sql
        start_time = time.perf_counter()

        # Connect with read-only URI mode if supported to guarantee filesystem safety
        conn_str = f"file:{self.db_path}?mode=ro"
        try:
            conn = sqlite3.connect(conn_str, uri=True, timeout=timeout_seconds)
        except Exception:
            # Fallback to standard path if URI mode has issues
            conn = sqlite3.connect(self.db_path, timeout=timeout_seconds)

        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Timeout guard using sqlite progress handler
        # A progress handler fires every N opcodes; we check elapsed time
        start_exec_epoch = time.time()

        def progress_callback():
            if time.time() - start_exec_epoch > timeout_seconds:
                return 1  # non-zero interrupts the query with sqlite3.OperationalError
            return 0

        conn.set_progress_handler(progress_callback, 1000)

        try:
            cursor.execute(target_sql)

            # Extract column headers
            columns = [desc[0] for desc in cursor.description] if cursor.description else []

            # Fetch rows up to max_rows + 1 to detect truncation
            raw_rows = cursor.fetchmany(max_rows + 1)
            total_fetched = len(raw_rows)
            is_truncated = total_fetched > max_rows

            trimmed_rows = raw_rows[:max_rows]
            formatted_rows: List[Dict[str, Any]] = [
                {k: (dict(row)[k] if dict(row)[k] is not None else None) for k in columns}
                for row in trimmed_rows
            ]

            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

            return SQLExecutionResult(
                success=True,
                database_id=self.schema.database_id,
                columns=columns,
                rows=formatted_rows,
                row_count=len(formatted_rows),
                total_available_rows=total_fetched if not is_truncated else max_rows + 1,
                truncated=is_truncated,
                execution_time_ms=elapsed_ms,
                validation=validation,
            )

        except sqlite3.OperationalError as e:
            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
            msg = str(e)
            if "interrupted" in msg.lower() or progress_callback() == 1:
                err_msg = f"Query timed out after {timeout_seconds} seconds."
            else:
                err_msg = f"Database execution error: {msg}"
            return SQLExecutionResult(
                success=False,
                database_id=self.schema.database_id,
                execution_time_ms=elapsed_ms,
                error=err_msg,
                validation=validation,
            )
        except Exception as e:
            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
            return SQLExecutionResult(
                success=False,
                database_id=self.schema.database_id,
                execution_time_ms=elapsed_ms,
                error=f"Execution error: {str(e)}",
                validation=validation,
            )
        finally:
            conn.close()
