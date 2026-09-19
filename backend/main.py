"""ClarifySQL FastAPI Backend Application.

Provides REST APIs for:
1. Database selection and catalog listing
2. Schema Introspection (Tables, Columns, Types, Keys, Sample Data)
3. NetworkX Schema Graph & Foreign Key Join Paths
4. SQLGlot SQL Validation & Read-Only Safety Guardrails
5. Safe SQL Execution & Explainability Output
"""

import os
from contextlib import asynccontextmanager
from typing import Dict, List, Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.core.explainability import ExplainabilityBuilder, ExplainabilityReport
from backend.core.introspection import SchemaIntrospector
from backend.core.schema_graph import SchemaGraph
from backend.core.sql_executor import SQLExecutor
from backend.core.sql_validator import SQLValidator
from backend.models.schemas import (
    DatabaseSchema,
    SQLExecutionRequest,
    SQLExecutionResult,
    SQLValidationRequest,
    SQLValidationResult,
    SchemaGraphResponse,
)
from backend.sample_data.sample_dbs import initialize_sample_databases

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
_DB_CACHE: Dict[str, DatabaseSchema] = {}
_GRAPH_CACHE: Dict[str, SchemaGraph] = {}


def get_db_path(database_id: str) -> str:
    db_path = os.path.join(DATA_DIR, f"{database_id}.db")
    if not os.path.exists(db_path):
        # Trigger initialization if missing
        initialize_sample_databases()
        if not os.path.exists(db_path):
            raise HTTPException(status_code=404, detail=f"Database '{database_id}' not found.")
    return db_path


def get_cached_schema(database_id: str) -> DatabaseSchema:
    if database_id not in _DB_CACHE:
        db_path = get_db_path(database_id)
        introspector = SchemaIntrospector(db_path=db_path)
        _DB_CACHE[database_id] = introspector.introspect_sqlite(db_path)
    return _DB_CACHE[database_id]


def get_cached_graph(database_id: str) -> SchemaGraph:
    if database_id not in _GRAPH_CACHE:
        schema = get_cached_schema(database_id)
        _GRAPH_CACHE[database_id] = SchemaGraph(schema)
    return _GRAPH_CACHE[database_id]


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Ensure sample benchmark databases exist and are cached on boot."""
    initialize_sample_databases()
    for db_id in ["retail_store", "university"]:
        try:
            get_cached_schema(db_id)
            get_cached_graph(db_id)
        except Exception:
            pass
    yield


app = FastAPI(
    title="ClarifySQL API",
    description="Adaptive Schema-Grounded Clarification for Conversational Text-to-SQL",
    version="1.0.0",
    lifespan=lifespan,
)

# Enable CORS for Next.js / Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "ClarifySQL Backend", "phase": "Phase 1: Backend Core & SQL Validation"}


@app.get("/api/databases", response_model=List[Dict[str, str]])
def list_databases():
    """List available introspected demo databases."""
    initialize_sample_databases()
    dbs = []
    if os.path.exists(DATA_DIR):
        for f in sorted(os.listdir(DATA_DIR)):
            if f.endswith(".db"):
                db_id = os.path.splitext(f)[0]
                dbs.append({
                    "id": db_id,
                    "name": db_id.replace("_", " ").title(),
                    "filename": f,
                })
    return dbs


@app.get("/api/schema/{database_id}", response_model=DatabaseSchema)
def get_schema(database_id: str):
    """Returns the introspected schema for a database."""
    return get_cached_schema(database_id)


@app.get("/api/schema/{database_id}/graph", response_model=SchemaGraphResponse)
def get_schema_graph(database_id: str):
    """Returns the NetworkX relational schema graph representation."""
    graph = get_cached_graph(database_id)
    return graph.to_response()


@app.get("/api/schema/{database_id}/join-path")
def get_join_path(database_id: str, table_a: str = Query(...), table_b: str = Query(...)):
    """Computes the shortest foreign key join path between two tables."""
    graph = get_cached_graph(database_id)
    path = graph.find_join_path(table_a, table_b)
    if path is None:
        raise HTTPException(status_code=404, detail=f"No join path found between '{table_a}' and '{table_b}'.")
    return {"table_a": table_a, "table_b": table_b, "join_path": path, "hops": len(path) - 1}


@app.post("/api/sql/validate", response_model=SQLValidationResult)
def validate_sql(req: SQLValidationRequest):
    """Parses and validates SQL with SQLGlot, verifying schema attributes and safety."""
    schema = get_cached_schema(req.database_id)
    validator = SQLValidator(schema=schema)
    return validator.validate(req.sql, dialect=req.dialect)


class ExecutionWithExplainability(BaseModel):
    execution: SQLExecutionResult
    explainability: ExplainabilityReport


@app.post("/api/sql/execute", response_model=ExecutionWithExplainability)
def execute_sql(req: SQLExecutionRequest):
    """Safely executes a read-only SQL query with limits, returning results and explainability."""
    db_path = get_db_path(req.database_id)
    schema = get_cached_schema(req.database_id)
    executor = SQLExecutor(db_path=db_path, schema=schema)

    # 1. Execute
    exec_result = executor.execute(
        sql=req.sql,
        max_rows=req.max_rows,
        timeout_seconds=req.timeout_seconds,
    )

    # 2. Build explainability report
    if exec_result.validation:
        explain_report = ExplainabilityBuilder.from_validation_result(
            validation=exec_result.validation,
            execution_metrics={
                "execution_time_ms": exec_result.execution_time_ms,
                "row_count": exec_result.row_count,
                "truncated": exec_result.truncated,
            },
        )
    else:
        explain_report = ExplainabilityReport(
            status="EXECUTION_ERROR",
            summary_reason=exec_result.error or "Unknown error",
            safety_checks_passed=False,
        )

    return ExecutionWithExplainability(
        execution=exec_result,
        explainability=explain_report,
    )


from backend.core.clarify_engine import ClarifyEngine, TextToSQLRequest, TextToSQLResponse, ClarificationRequest


@app.post("/api/clarify/detect", response_model=Optional[ClarificationRequest])
def detect_clarification(req: TextToSQLRequest):
    """Inspects query for schema ambiguity and returns structured clarification options."""
    schema = get_cached_schema(req.database_id)
    engine = ClarifyEngine(schema=schema)
    return engine.detect_ambiguity(req.query)


@app.post("/api/text-to-sql", response_model=TextToSQLResponse)
def text_to_sql(req: TextToSQLRequest):
    """Converts natural language question to schema-grounded SQL with clarification handling."""
    schema = get_cached_schema(req.database_id)
    engine = ClarifyEngine(schema=schema)

    # 1. If no clarification was provided yet, check if clarification is strictly required
    if not req.clarification_selection:
        ambiguity = engine.detect_ambiguity(req.query)
        if ambiguity and ambiguity.needs_clarification:
            return TextToSQLResponse(
                query=req.query,
                database_id=req.database_id,
                sql=None,
                clarification=ambiguity,
                explanation=f"Ambiguity detected: {ambiguity.ambiguous_term}. Clarification is requested before executing.",
                tables_involved=[],
                columns_involved=[],
                engine="clarify-disambiguation-gate",
            )

    # 2. Synthesize SQL via Gemini 3.8 Flash (if API key configured) or robust schema heuristics
    gemini_data = engine.generate_sql_gemini(
        query=req.query,
        clarification_choice=req.clarification_selection,
    )

    if gemini_data and "sql" in gemini_data:
        return TextToSQLResponse(
            query=req.query,
            database_id=req.database_id,
            sql=gemini_data["sql"],
            clarification=None,
            explanation=gemini_data.get("explanation", "Synthesized using Gemini 3.8 Flash."),
            tables_involved=gemini_data.get("tables_involved", []),
            columns_involved=gemini_data.get("columns_involved", []),
            engine="gemini-3.8-flash",
        )

    # Fallback to schema heuristics
    fallback_data = engine.generate_sql_fallback(
        query=req.query,
        clarification_choice=req.clarification_selection,
    )
    return TextToSQLResponse(
        query=req.query,
        database_id=req.database_id,
        sql=fallback_data["sql"],
        clarification=None,
        explanation=fallback_data.get("explanation", "Schema-grounded heuristic engine."),
        tables_involved=fallback_data.get("tables_involved", []),
        columns_involved=fallback_data.get("columns_involved", []),
        engine="schema-grounded-heuristics",
    )

