"""ClarifySQL Schema Introspection Service.

Extracts tables, columns, primary keys, foreign key constraints,
data types, and representative sample values from SQLite and SQLAlchemy connections.
"""

import os
import sqlite3
from typing import Any, Dict, List, Optional
from backend.models.schemas import (
    ColumnMetadata,
    DatabaseSchema,
    ForeignKeyConstraint,
    TableMetadata,
)


class SchemaIntrospector:
    """Introspects relational databases to build rich schema representations."""

    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path

    def introspect_sqlite(self, db_path: str, sample_row_limit: int = 5) -> DatabaseSchema:
        """Introspect a SQLite database file and return structured schema metadata."""
        if not os.path.exists(db_path):
            raise FileNotFoundError(f"Database file not found: {db_path}")

        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        try:
            # 1. Fetch all user tables (exclude sqlite_stat, sqlite_sequence, etc.)
            cursor.execute(
                """
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name NOT LIKE 'sqlite_%'
                ORDER BY name;
                """
            )
            table_rows = cursor.fetchall()
            table_names = [row["name"] for row in table_rows]

            tables: List[TableMetadata] = []

            for tbl_name in table_names:
                # 2. Get columns info via PRAGMA table_info
                # Returns (cid, name, type, notnull, dflt_value, pk)
                cursor.execute(f"PRAGMA table_info(\"{tbl_name}\");")
                col_info_rows = cursor.fetchall()

                # 3. Get foreign keys via PRAGMA foreign_key_list
                # Returns (id, seq, table, from, to, on_update, on_delete, match)
                cursor.execute(f"PRAGMA foreign_key_list(\"{tbl_name}\");")
                fk_rows = cursor.fetchall()

                fk_constraints: List[ForeignKeyConstraint] = []
                fk_map: Dict[str, str] = {}  # col_name -> "target_table.target_col"
                for fk in fk_rows:
                    col_from = fk["from"]
                    target_tbl = fk["table"]
                    col_to = fk["to"]
                    fk_constraints.append(
                        ForeignKeyConstraint(
                            constrained_column=col_from,
                            referenced_table=target_tbl,
                            referenced_column=col_to,
                        )
                    )
                    fk_map[col_from] = f"{target_tbl}.{col_to}"

                # 4. Determine row count
                try:
                    cursor.execute(f"SELECT COUNT(*) as cnt FROM \"{tbl_name}\";")
                    row_count = cursor.fetchone()["cnt"]
                except Exception:
                    row_count = 0

                # 5. Extract sample values for each column
                columns: List[ColumnMetadata] = []
                primary_keys: List[str] = []

                for col in col_info_rows:
                    col_name = col["name"]
                    col_type = col["type"] or "TEXT"
                    is_pk = bool(col["pk"])
                    is_nullable = not bool(col["notnull"])
                    is_fk = col_name in fk_map
                    target = fk_map.get(col_name)

                    if is_pk:
                        primary_keys.append(col_name)

                    # Fetch distinct non-null sample values safely
                    samples: List[Any] = []
                    try:
                        cursor.execute(
                            f"""
                            SELECT DISTINCT "{col_name}" 
                            FROM "{tbl_name}" 
                            WHERE "{col_name}" IS NOT NULL 
                            LIMIT {sample_row_limit};
                            """
                        )
                        samples = [r[0] for r in cursor.fetchall() if r[0] is not None]
                    except Exception:
                        samples = []

                    columns.append(
                        ColumnMetadata(
                            name=col_name,
                            data_type=col_type.upper(),
                            is_primary_key=is_pk,
                            is_foreign_key=is_fk,
                            is_nullable=is_nullable,
                            foreign_key_target=target,
                            sample_values=samples,
                        )
                    )

                tables.append(
                    TableMetadata(
                        name=tbl_name,
                        columns=columns,
                        primary_keys=primary_keys,
                        foreign_keys=fk_constraints,
                        row_count=row_count,
                    )
                )

            db_id = os.path.splitext(os.path.basename(db_path))[0]
            summary = f"Database '{db_id}' contains {len(tables)} tables with {sum(len(t.columns) for t in tables)} total columns."

            return DatabaseSchema(
                database_id=db_id,
                database_type="sqlite",
                tables=tables,
                summary=summary,
            )

        finally:
            conn.close()
