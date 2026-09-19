"""ClarifySQL Explainability Engine.

Generates human-readable, schema-grounded rationales detailing
the pipeline's status, localized schema ambiguities, candidate resolution options,
validation checks, and execution metrics.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from backend.models.schemas import SQLValidationResult


class SchemaCandidate(BaseModel):
    token: str
    matched_attribute: str  # e.g. "orders.total_amount"
    score: float = 1.0
    reason: Optional[str] = None


class ExplainabilityReport(BaseModel):
    status: str  # "ANSWERABLE", "AMBIGUOUS", "UNANSWERABLE", "VALIDATION_ERROR"
    summary_reason: str
    candidates: List[SchemaCandidate] = Field(default_factory=list)
    suggested_clarification: Optional[str] = None
    ast_summary: Optional[str] = None
    tables_used: List[str] = Field(default_factory=list)
    columns_used: List[str] = Field(default_factory=list)
    safety_checks_passed: bool = True
    execution_metrics: Optional[Dict[str, Any]] = None

    def to_formatted_text(self) -> str:
        """Returns a scannable textual summary suitable for presentation and viva."""
        lines = [
            f"Status: {self.status}",
            f"Reason: {self.summary_reason}",
        ]
        if self.candidates:
            lines.append("Candidates:")
            for cand in self.candidates:
                lines.append(f"  - {cand.matched_attribute} (matched on '{cand.token}')")
        if self.suggested_clarification:
            lines.append(f"Clarification: {self.suggested_clarification}")
        if self.tables_used:
            lines.append(f"Referenced Tables: {', '.join(self.tables_used)}")
        if self.columns_used:
            lines.append(f"Referenced Columns: {', '.join(self.columns_used)}")
        return "\n".join(lines)


class ExplainabilityBuilder:
    """Builds comprehensive explainability reports across pipeline stages."""

    @staticmethod
    def from_validation_result(
        validation: SQLValidationResult,
        execution_metrics: Optional[Dict[str, Any]] = None,
    ) -> ExplainabilityReport:
        if not validation.is_valid:
            error_details = "; ".join([e.message for e in validation.errors])
            return ExplainabilityReport(
                status="VALIDATION_ERROR",
                summary_reason=f"SQL failed schema or safety validation: {error_details}",
                tables_used=validation.referenced_tables,
                columns_used=validation.referenced_columns,
                safety_checks_passed=validation.is_read_only,
                ast_summary=validation.ast_tree,
                execution_metrics=execution_metrics,
            )

        return ExplainabilityReport(
            status="ANSWERABLE",
            summary_reason="Query successfully parsed, schema-grounded, and passed all read-only safety guardrails.",
            tables_used=validation.referenced_tables,
            columns_used=validation.referenced_columns,
            safety_checks_passed=True,
            ast_summary=validation.ast_tree,
            execution_metrics=execution_metrics,
        )
