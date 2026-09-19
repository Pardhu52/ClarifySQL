"""Test suite for ClarifySQL FastAPI endpoints."""

import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)


def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "ClarifySQL" in data["service"]


def test_list_databases():
    response = client.get("/api/databases")
    assert response.status_code == 200
    dbs = response.json()
    assert len(dbs) >= 2
    db_ids = [d["id"] for d in dbs]
    assert "retail_store" in db_ids
    assert "university" in db_ids


def test_get_schema():
    response = client.get("/api/schema/retail_store")
    assert response.status_code == 200
    schema = response.json()
    assert schema["database_id"] == "retail_store"
    assert len(schema["tables"]) >= 6
    tbl_names = [t["name"] for t in schema["tables"]]
    assert "customers" in tbl_names
    assert "orders" in tbl_names


def test_get_schema_graph():
    response = client.get("/api/schema/retail_store/graph")
    assert response.status_code == 200
    graph = response.json()
    assert graph["table_count"] >= 6
    assert len(graph["nodes"]) > 0
    assert len(graph["edges"]) > 0


def test_get_join_path():
    response = client.get("/api/schema/retail_store/join-path?table_a=customers&table_b=products")
    assert response.status_code == 200
    data = response.json()
    assert data["join_path"] == ["customers", "orders", "order_items", "products"]
    assert data["hops"] == 3


def test_api_validate_sql_valid():
    payload = {
        "database_id": "retail_store",
        "sql": "SELECT customer_id, email FROM customers WHERE city = 'Austin';",
        "dialect": "sqlite",
    }
    response = client.post("/api/sql/validate", json=payload)
    assert response.status_code == 200
    res = response.json()
    assert res["is_valid"] is True
    assert "customers" in res["referenced_tables"]


def test_api_validate_sql_blocked():
    payload = {
        "database_id": "retail_store",
        "sql": "DROP TABLE customers;",
        "dialect": "sqlite",
    }
    response = client.post("/api/sql/validate", json=payload)
    assert response.status_code == 200
    res = response.json()
    assert res["is_valid"] is False
    assert any(e["error_type"] == "UNSAFE_STATEMENT" for e in res["errors"])


def test_api_execute_sql():
    payload = {
        "database_id": "retail_store",
        "sql": "SELECT customer_id, first_name, email FROM customers ORDER BY customer_id LIMIT 2;",
        "max_rows": 10,
        "timeout_seconds": 3.0,
    }
    response = client.post("/api/sql/execute", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["execution"]["success"] is True
    assert len(data["execution"]["rows"]) == 2
    assert data["explainability"]["status"] == "ANSWERABLE"
    assert "customers" in data["explainability"]["tables_used"]
