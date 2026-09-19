"""ClarifySQL Schema Graph Service.

Constructs and queries relational NetworkX graphs representing
tables, columns, and foreign-key join constraints.
"""

from typing import Dict, List, Optional, Tuple
import networkx as nx
from backend.models.schemas import (
    DatabaseSchema,
    GraphEdge,
    GraphNode,
    SchemaGraphResponse,
)


class SchemaGraph:
    """NetworkX-based representation of relational database schemas."""

    def __init__(self, schema: DatabaseSchema):
        self.schema = schema
        # Multigraph to allow multiple relationship edges (e.g. column containment, foreign keys)
        self.graph = nx.MultiDiGraph()
        # Undirected table-level graph for join path resolution
        self.table_graph = nx.Graph()
        self._build_graph()

    def _build_graph(self) -> None:
        """Constructs the NetworkX graphs from the introspected schema."""
        for table in self.schema.tables:
            # Add table node
            self.graph.add_node(
                table.name,
                node_type="table",
                label=table.name,
                row_count=table.row_count,
            )
            self.table_graph.add_node(table.name)

            for col in table.columns:
                col_node_id = f"{table.name}.{col.name}"
                self.graph.add_node(
                    col_node_id,
                    node_type="column",
                    label=col.name,
                    table_name=table.name,
                    data_type=col.data_type,
                    is_primary_key=col.is_primary_key,
                    is_foreign_key=col.is_foreign_key,
                    foreign_key_target=col.foreign_key_target,
                )

                # Edge: Table -> Column (containment)
                self.graph.add_edge(
                    table.name,
                    col_node_id,
                    relation_type="has_column",
                    label="contains",
                )

            # Add foreign key edges
            for fk in table.foreign_keys:
                source_col_node = f"{table.name}.{fk.constrained_column}"
                target_col_node = f"{fk.referenced_table}.{fk.referenced_column}"

                # Add column-level FK edge
                self.graph.add_edge(
                    source_col_node,
                    target_col_node,
                    relation_type="foreign_key",
                    label=f"references {fk.referenced_table}.{fk.referenced_column}",
                )

                # Add table-level join edge in the undirected graph
                self.table_graph.add_edge(
                    table.name,
                    fk.referenced_table,
                    source_col=fk.constrained_column,
                    target_col=fk.referenced_column,
                )

    def find_join_path(self, table_a: str, table_b: str) -> Optional[List[str]]:
        """Find the shortest join path between two tables using NetworkX."""
        if not self.table_graph.has_node(table_a) or not self.table_graph.has_node(table_b):
            return None
        try:
            return nx.shortest_path(self.table_graph, source=table_a, target=table_b)
        except nx.NetworkXNoPath:
            return None

    def get_related_tables(self, table_name: str) -> List[str]:
        """Returns all directly connected tables via foreign keys."""
        if not self.table_graph.has_node(table_name):
            return []
        return list(self.table_graph.neighbors(table_name))

    def to_response(self) -> SchemaGraphResponse:
        """Serializes the graph into a lightweight JSON-compatible response for UI rendering."""
        nodes: List[GraphNode] = []
        edges: List[GraphEdge] = []

        for node_id, attrs in self.graph.nodes(data=True):
            nodes.append(
                GraphNode(
                    id=node_id,
                    label=attrs.get("label", node_id),
                    node_type=attrs.get("node_type", "unknown"),
                    data_type=attrs.get("data_type"),
                    table_name=attrs.get("table_name"),
                    is_primary_key=attrs.get("is_primary_key", False),
                    is_foreign_key=attrs.get("is_foreign_key", False),
                )
            )

        for u, v, attrs in self.graph.edges(data=True):
            edges.append(
                GraphEdge(
                    source=u,
                    target=v,
                    relation_type=attrs.get("relation_type", "related"),
                    label=attrs.get("label"),
                )
            )

        return SchemaGraphResponse(
            database_id=self.schema.database_id,
            nodes=nodes,
            edges=edges,
            table_count=len(self.schema.tables),
            column_count=sum(len(t.columns) for t in self.schema.tables),
            foreign_key_count=sum(len(t.foreign_keys) for t in self.schema.tables),
        )

    def generate_schema_prompt_context(self) -> str:
        """Generates compact, highly-informative schema context for LLM generation."""
        lines = [f"### Database: {self.schema.database_id}"]
        for table in self.schema.tables:
            col_strs = []
            for col in table.columns:
                suffix = ""
                if col.is_primary_key:
                    suffix += " [PK]"
                if col.is_foreign_key:
                    suffix += f" [FK -> {col.foreign_key_target}]"
                samples = f", samples: {col.sample_values[:3]}" if col.sample_values else ""
                col_strs.append(f"  - {col.name} ({col.data_type}{suffix}{samples})")

            lines.append(f"Table: {table.name} ({table.row_count} rows)")
            lines.extend(col_strs)
        return "\n".join(lines)
