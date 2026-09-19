"""Phase 1 Automated Test Suite for ClarifySQL.

Tests:
1. Schema Introspection (SQLite tables, columns, PKs, FKs, sample data)
2. NetworkX Schema Graph (Relations, foreign key traversal, join paths)
3. SQLGlot SQL Validator (Read-only safety, AST inspection, DDL/DML blocking, schema verification)
4. Safe SQL Execution (Timeouts, row caps, execution metrics)
"""

import os
import pytest
from backend.core.explainability import ExplainabilityBuilder
from backend.core.introspection import SchemaIntrospector
from backend.core.schema_graph import SchemaGraph
from backend.core.sql_executor import SQLExecutor
from backend.core.sql_validator import SQLValidator
from backend.sample_data.sample_dbs import initialize_sample_databases


@pytest.fixture(scope="session")
def setup_databases():
    paths = initialize_sample_databases()
    retail_db = [p for p in paths if "retail_store.db" in p][0]
    uni_db = [p for p in paths if "university.db" in p][0]
    return {"retail": retail_db, "university": uni_db}


def test_schema_introspection(setup_databases):
    introspector = SchemaIntrospector()
    schema = introspector.introspect_sqlite(setup_databases["retail"])

    assert schema.database_id == "retail_store"
    assert len(schema.tables) >= 6

    table_names = [t.name for t in schema.tables]
    assert "customers" in table_names
    assert "orders" in table_names
    assert "order_items" in table_names
    assert "products" in table_names
    assert "invoices" in table_names

    orders_tbl = [t for t in schema.tables if t.name == "orders"][0]
    assert "order_id" in orders_tbl.primary_keys
    assert orders_tbl.row_count > 0

    fk_map = {fk.constrained_column: fk.referenced_table for fk in orders_tbl.foreign_keys}
    assert fk_map.get("customer_id") == "customers"

    col_names = [c.name for c in orders_tbl.columns]
    assert "total_amount" in col_names
    assert "order_date" in col_names


def test_networkx_schema_graph(setup_databases):
    introspector = SchemaIntrospector()
    schema = introspector.introspect_sqlite(setup_databases["retail"])
    sg = SchemaGraph(schema)

    # Test join path discovery: customers -> products
    # Path should traverse: customers -> orders -> order_items -> products
    join_path = sg.find_join_path("customers", "products")
    assert join_path is not None
    assert join_path[0] == "customers"
    assert join_path[-1] == "products"
    assert "orders" in join_path
    assert "order_items" in join_path

    # Test related tables for orders
    related_to_orders = sg.get_related_tables("orders")
    assert "customers" in related_to_orders
    assert "order_items" in related_to_orders
    assert "invoices" in related_to_orders

    # Test graph serialization
    resp = sg.to_response()
    assert resp.table_count == len(schema.tables)
    assert resp.column_count > 0
    assert resp.foreign_key_count > 0


def test_sqlglot_validator_valid_queries(setup_databases):
    introspector = SchemaIntrospector()
    schema = introspector.introspect_sqlite(setup_databases["retail"])
    validator = SQLValidator(schema)

    # 1. Simple SELECT
    res = validator.validate("SELECT customer_id, first_name, email FROM customers WHERE city = 'Seattle';")
    assert res.is_valid is True
    assert res.is_read_only is True
    assert "customers" in res.referenced_tables
    assert len(res.errors) == 0

    # 2. Join query
    join_sql = """
        SELECT c.first_name, o.order_id, o.total_amount 
        FROM customers c 
        JOIN orders o ON c.customer_id = o.customer_id 
        WHERE o.order_status = 'completed';
    """
    res_join = validator.validate(join_sql)
    assert res_join.is_valid is True
    assert "customers" in res_join.referenced_tables
    assert "orders" in res_join.referenced_tables

    # 3. CTE (WITH) query
    cte_sql = """
        WITH HighValueOrders AS (
            SELECT customer_id, SUM(total_amount) AS total_spent
            FROM orders
            GROUP BY customer_id
            HAVING total_spent > 1000
        )
        SELECT c.first_name, h.total_spent
        FROM HighValueOrders h
        JOIN customers c ON h.customer_id = c.customer_id;
    """
    res_cte = validator.validate(cte_sql)
    assert res_cte.is_valid is True
    assert res_cte.statement_type in ("SELECT", "WITH")


def test_sqlglot_validator_safety_blocking(setup_databases):
    introspector = SchemaIntrospector()
    schema = introspector.introspect_sqlite(setup_databases["retail"])
    validator = SQLValidator(schema)

    # Rejection of INSERT
    res_insert = validator.validate("INSERT INTO customers (customer_id, first_name) VALUES (99, 'Hacker');")
    assert res_insert.is_valid is False
    assert any(e.error_type == "UNSAFE_STATEMENT" for e in res_insert.errors)

    # Rejection of DROP TABLE
    res_drop = validator.validate("DROP TABLE customers;")
    assert res_drop.is_valid is False
    assert any(e.error_type == "UNSAFE_STATEMENT" for e in res_drop.errors)

    # Rejection of UPDATE
    res_update = validator.validate("UPDATE orders SET total_amount = 0 WHERE order_id = 1001;")
    assert res_update.is_valid is False
    assert any(e.error_type == "UNSAFE_STATEMENT" for e in res_update.errors)

    # Rejection of ATTACH / PRAGMA
    res_pragma = validator.validate("PRAGMA table_info(customers);")
    assert res_pragma.is_valid is False


def test_sqlglot_validator_hallucination_detection(setup_databases):
    introspector = SchemaIntrospector()
    schema = introspector.introspect_sqlite(setup_databases["retail"])
    validator = SQLValidator(schema)

    # 1. Non-existent table hallucination
    res_table = validator.validate("SELECT * FROM non_existent_table WHERE id = 1;")
    assert res_table.is_valid is False
    assert any(e.error_type == "UNKNOWN_TABLE" for e in res_table.errors)

    # 2. Non-existent column hallucination on existing table
    res_col = validator.validate("SELECT customers.social_security_number FROM customers;")
    assert res_col.is_valid is False
    assert any(e.error_type == "UNKNOWN_COLUMN" for e in res_col.errors)


def test_safe_sql_execution(setup_databases):
    introspector = SchemaIntrospector()
    schema = introspector.introspect_sqlite(setup_databases["retail"])
    executor = SQLExecutor(db_path=setup_databases["retail"], schema=schema)

    # Test valid execution
    query = "SELECT order_id, total_amount, order_status FROM orders WHERE total_amount > 500 ORDER BY total_amount DESC;"
    res = executor.execute(query, max_rows=10)

    assert res.success is True
    assert res.row_count > 0
    assert "order_id" in res.columns
    assert "total_amount" in res.columns
    assert res.execution_time_ms >= 0.0
    assert res.rows[0]["order_id"] is not None

    # Test blocked malicious query execution
    malicious = "DELETE FROM customers WHERE customer_id = 1;"
    mal_res = executor.execute(malicious)
    assert mal_res.success is False
    assert "SQL validation failed" in mal_res.error


def test_explainability_report(setup_databases):
    introspector = SchemaIntrospector()
    schema = introspector.introspect_sqlite(setup_databases["retail"])
    validator = SQLValidator(schema)

    valid_res = validator.validate("SELECT first_name, email FROM customers LIMIT 5;")
    report = ExplainabilityBuilder.from_validation_result(
        valid_res, execution_metrics={"execution_time_ms": 1.25, "row_count": 5}
    )

    assert report.status == "ANSWERABLE"
    assert report.safety_checks_passed is True
    assert "customers" in report.tables_used

    text = report.to_formatted_text()
    assert "Status: ANSWERABLE" in text
    assert "Referenced Tables: customers" in text
