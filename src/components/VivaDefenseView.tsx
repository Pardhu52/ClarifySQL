import React from 'react';
import { Award, CheckCircle2, ShieldCheck, HelpCircle, GitCommit, Database, Zap, BookOpen } from 'lucide-react';

export const VivaDefenseView: React.FC = () => {
  return (
    <div className="h-full bg-stone-100 p-6 overflow-y-auto space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-stone-200 rounded-lg p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-stone-900 text-white">
                Dissertation & Viva Defense
              </span>
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                Phase 1 & Phase 2 Ready
              </span>
            </div>
            <h2 className="text-xl font-bold text-stone-900 mt-2">
              Adaptive Schema-Grounded Clarification Architecture
            </h2>
            <p className="text-xs text-stone-600 mt-1 max-w-3xl leading-relaxed">
              Standard Text-to-SQL pipelines silently guess when faced with schema ambiguities, leading to catastrophic reporting errors. ClarifySQL combines an introspected relational knowledge graph with an interactive ambiguity detection gate before generating SQL.
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black text-stone-900 font-mono">100%</div>
            <div className="text-[11px] text-stone-500 font-medium">Read-Only Safety Enforcement</div>
          </div>
        </div>
      </div>

      {/* 4 Pillars of ClarifySQL */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-stone-200 rounded-lg p-5 shadow-sm space-y-2">
          <div className="w-8 h-8 rounded-md bg-stone-100 flex items-center justify-center text-stone-800">
            <Database className="w-4 h-4 text-stone-900" />
          </div>
          <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
            1. Schema Graph Introspection
          </h3>
          <p className="text-xs text-stone-600 leading-relaxed">
            Extracts tables, primary keys, foreign-key constraint topologies, data types, and representative sample values to ground the generation engine.
          </p>
        </div>

        <div className="bg-white border border-stone-200 rounded-lg p-5 shadow-sm space-y-2">
          <div className="w-8 h-8 rounded-md bg-amber-50 flex items-center justify-center text-amber-700">
            <HelpCircle className="w-4 h-4 text-amber-600" />
          </div>
          <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
            2. Ambiguity Detection Gate
          </h3>
          <p className="text-xs text-stone-600 leading-relaxed">
            Detects when tokens (e.g. "sales", "date", "status") match multiple conflicting attributes. Pauses execution to solicit user disambiguation.
          </p>
        </div>

        <div className="bg-white border border-stone-200 rounded-lg p-5 shadow-sm space-y-2">
          <div className="w-8 h-8 rounded-md bg-emerald-50 flex items-center justify-center text-emerald-700">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
            3. AST & Safety Guardrails
          </h3>
          <p className="text-xs text-stone-600 leading-relaxed">
            Every query undergoes AST validation via SQLGlot. Blocks non-read statements (DROP, UPDATE, INSERT) and catches hallucinated column references.
          </p>
        </div>

        <div className="bg-white border border-stone-200 rounded-lg p-5 shadow-sm space-y-2">
          <div className="w-8 h-8 rounded-md bg-blue-50 flex items-center justify-center text-blue-700">
            <BookOpen className="w-4 h-4 text-blue-600" />
          </div>
          <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
            4. Viva Explainability
          </h3>
          <p className="text-xs text-stone-600 leading-relaxed">
            Produces structured explainability rationales detailing tables referenced, join paths resolved, safety checks verified, and execution latency.
          </p>
        </div>
      </div>

      {/* Comparison table */}
      <div className="bg-white border border-stone-200 rounded-lg shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-800">
            Experimental Comparison: Baseline Text-to-SQL vs. ClarifySQL
          </h3>
          <span className="text-[11px] text-stone-500 font-mono">BIRD / Spider Benchmarking Matrix</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50/70 text-stone-600 text-[11px] uppercase font-semibold">
                <th className="py-2.5 px-4">Evaluation Metric</th>
                <th className="py-2.5 px-4">Standard Text-to-SQL (Baseline)</th>
                <th className="py-2.5 px-4 bg-emerald-50/60 text-emerald-900">ClarifySQL (Our Approach)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-stone-700">
              <tr>
                <td className="py-2.5 px-4 font-semibold text-stone-900">Behavior on Ambiguous "Sales"</td>
                <td className="py-2.5 px-4 text-rose-700">Arbitrarily selects one column without notification (silent error)</td>
                <td className="py-2.5 px-4 font-semibold text-emerald-800 bg-emerald-50/30">
                  Detects ambiguity, presents target options with example figures
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-semibold text-stone-900">Hallucination Detection</td>
                <td className="py-2.5 px-4 text-rose-700">Database syntax/runtime crash returned to user</td>
                <td className="py-2.5 px-4 font-semibold text-emerald-800 bg-emerald-50/30">
                  Pre-execution AST verification against introspected catalogue
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-semibold text-stone-900">Security & Read-Only Safety</td>
                <td className="py-2.5 px-4 text-stone-500">Dependent solely on prompt instructions</td>
                <td className="py-2.5 px-4 font-semibold text-emerald-800 bg-emerald-50/30">
                  Deterministic AST check + SQLite read-only mode (file:?mode=ro)
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-semibold text-stone-900">Cross-Table Join Accuracy</td>
                <td className="py-2.5 px-4 text-stone-500">Frequent missing intermediate join tables</td>
                <td className="py-2.5 px-4 font-semibold text-emerald-800 bg-emerald-50/30">
                  Shortest foreign-key path calculated via NetworkX schema graph
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
