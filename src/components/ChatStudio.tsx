import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Database, HelpCircle, Layers, RefreshCw } from 'lucide-react';
import { DatabaseSchema, ChatMessage, ClarificationOption, SQLExecutionResult } from '../types';
import { ClarificationCard } from './ClarificationCard';
import { SQLResultDisplay } from './SQLResultDisplay';
import { SAMPLE_QUERIES } from '../data/schemas';

interface ChatStudioProps {
  schema: DatabaseSchema;
  onExecuteSql: (sql: string) => Promise<SQLExecutionResult>;
}

export const ChatStudio: React.FC<ChatStudioProps> = ({ schema, onExecuteSql }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingClarificationMsgId, setPendingClarificationMsgId] = useState<string | null>(null);
  const [executingSqlMap, setExecutingSqlMap] = useState<Record<string, boolean>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize welcome message when database switches
  useEffect(() => {
    setMessages([
      {
        id: 'welcome-1',
        sender: 'assistant',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        response: {
          query: '',
          databaseId: schema.databaseId,
          explanation: `Connected to **${schema.databaseName}** with ${schema.tables.length} introspected relational tables. Ask any business question or click one of the benchmark queries below to test adaptive clarification and SQL generation.`,
          tablesInvolved: schema.tables.map((t) => t.name),
          columnsInvolved: [],
          engine: 'ClarifySQL Adaptive Engine',
        },
      },
    ]);
  }, [schema.databaseId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async (queryText: string, clarificationSelection?: string) => {
    if (!queryText.trim()) return;

    const userMsgId = `user-${Date.now()}`;
    const newMessages: ChatMessage[] = [
      ...messages,
      {
        id: userMsgId,
        sender: 'user',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        query: queryText,
        selectedOptionId: clarificationSelection,
      },
    ];

    setMessages(newMessages);
    setInputQuery('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/text-to-sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: queryText,
          database_id: schema.databaseId,
          clarification_selection: clarificationSelection,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned error ${response.status}`);
      }

      const data = await response.json();
      const assistantMsgId = `assistant-${Date.now()}`;

      // Convert backend snake_case to frontend camelCase
      const formattedResponse = {
        query: data.query,
        databaseId: data.database_id,
        sql: data.sql,
        clarification: data.clarification ? {
          needsClarification: data.clarification.needs_clarification,
          ambiguityType: data.clarification.ambiguity_type,
          ambiguousTerm: data.clarification.ambiguous_term,
          question: data.clarification.question,
          confidenceScore: data.clarification.confidence_score,
          options: (data.clarification.options || []).map((o: any) => ({
            id: o.id,
            label: o.label,
            description: o.description,
            targetColumn: o.target_column,
            targetTable: o.target_table,
            exampleValue: o.example_value,
          })),
        } : null,
        explanation: data.explanation,
        tablesInvolved: data.tables_involved || [],
        columnsInvolved: data.columns_involved || [],
        engine: data.engine || 'ClarifySQL Engine',
      };

      setMessages((prev) => [
        ...prev,
        {
          id: assistantMsgId,
          sender: 'assistant',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          response: formattedResponse,
          sql: formattedResponse.sql || undefined,
        },
      ]);

      if (formattedResponse.clarification && formattedResponse.clarification.needsClarification) {
        setPendingClarificationMsgId(assistantMsgId);
      } else {
        setPendingClarificationMsgId(null);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          sender: 'assistant',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          error: `Error communicating with ClarifySQL engine: ${err.message}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectClarification = (option: ClarificationOption, parentMsg: ChatMessage) => {
    const originalQuery = messages.find((m) => m.sender === 'user' && m.query)?.query || 'Sales analysis';
    handleSend(originalQuery, option.id);
  };

  const handleExecuteSqlMessage = async (msgId: string, sqlToRun: string) => {
    setExecutingSqlMap((prev) => ({ ...prev, [msgId]: true }));
    try {
      const result = await onExecuteSql(sqlToRun);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId ? { ...m, executionResult: result } : m
        )
      );
    } catch (err: any) {
      console.error(err);
    } finally {
      setExecutingSqlMap((prev) => ({ ...prev, [msgId]: false }));
    }
  };

  const sampleQueries = SAMPLE_QUERIES[schema.databaseId] || [];

  return (
    <div className="flex flex-col h-full bg-stone-100 overflow-hidden">
      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((msg) => {
          if (msg.sender === 'user') {
            return (
              <div key={msg.id} className="flex justify-end">
                <div className="max-w-xl bg-stone-900 text-white rounded-xl px-4 py-3 text-xs shadow-sm">
                  <p className="font-medium text-stone-100 leading-relaxed">{msg.query}</p>
                  {msg.selectedOptionId && (
                    <div className="mt-1.5 pt-1.5 border-t border-stone-800 text-[11px] text-amber-300 font-mono">
                      Selected Clarification: {msg.selectedOptionId}
                    </div>
                  )}
                  <div className="text-[10px] text-stone-400 mt-1 text-right">{msg.timestamp}</div>
                </div>
              </div>
            );
          }

          if (msg.error) {
            return (
              <div key={msg.id} className="flex justify-start">
                <div className="max-w-2xl bg-rose-50 border border-rose-200 text-rose-900 rounded-lg p-4 text-xs shadow-sm">
                  <p className="font-semibold">Generation Problem</p>
                  <p className="mt-1 font-mono text-[11px]">{msg.error}</p>
                </div>
              </div>
            );
          }

          const res = msg.response;
          if (!res) return null;

          return (
            <div key={msg.id} className="flex justify-start">
              <div className="max-w-3xl w-full bg-white border border-stone-200 rounded-lg p-5 text-xs shadow-sm space-y-3">
                {/* Explanation text */}
                <div className="text-stone-800 leading-relaxed">
                  <p>{res.explanation}</p>
                </div>

                {/* If clarification required */}
                {res.clarification && res.clarification.needsClarification && (
                  <ClarificationCard
                    clarification={res.clarification}
                    onSelectOption={(opt) => handleSelectClarification(opt, msg)}
                    selectedOptionId={msg.selectedOptionId}
                    disabled={isLoading}
                  />
                )}

                {/* If SQL generated */}
                {res.sql && (
                  <SQLResultDisplay
                    sql={res.sql}
                    explanation={res.explanation}
                    engine={res.engine}
                    tablesInvolved={res.tablesInvolved}
                    columnsInvolved={res.columnsInvolved}
                    onExecute={(code) => handleExecuteSqlMessage(msg.id, code)}
                    executionResult={msg.executionResult}
                    isExecuting={executingSqlMap[msg.id] || false}
                  />
                )}

                <div className="flex items-center justify-between pt-2 border-t border-stone-100 text-[10px] text-stone-400">
                  <span className="font-mono">{res.engine}</span>
                  <span>{msg.timestamp}</span>
                </div>
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-stone-200 rounded-lg px-4 py-3 text-xs shadow-sm flex items-center gap-2.5 text-stone-600">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-stone-500" />
              <span>Analyzing query, inspecting schema graph, and checking ambiguity...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested benchmark prompts */}
      {sampleQueries.length > 0 && (
        <div className="bg-stone-50 border-t border-stone-200 px-6 py-2.5 flex items-center gap-2 overflow-x-auto text-xs shrink-0">
          <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider shrink-0 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-500" /> Benchmark Queries:
          </span>
          {sampleQueries.map((sample, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(sample.query)}
              disabled={isLoading}
              className="px-2.5 py-1 bg-white hover:bg-stone-100 border border-stone-300 rounded-full text-stone-700 whitespace-nowrap transition-colors text-[11px] font-medium shadow-2xs cursor-pointer flex items-center gap-1.5"
            >
              <span>{sample.label}</span>
              {sample.category === 'Ambiguous' && (
                <span className="text-[9px] bg-amber-100 text-amber-800 px-1 py-0.2 rounded font-semibold">
                  Ambiguity Gate
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Input query field */}
      <div className="bg-white border-t border-stone-200 p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(inputQuery);
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            disabled={isLoading}
            placeholder={`Ask a question in plain English about ${schema.databaseName} (e.g. "Calculate total sales by month")...`}
            className="flex-1 px-4 py-2.5 text-xs bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-stone-900 focus:bg-white text-stone-900"
          />
          <button
            type="submit"
            disabled={isLoading || !inputQuery.trim()}
            className="px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm disabled:opacity-40 transition-colors cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Generate SQL</span>
          </button>
        </form>
      </div>
    </div>
  );
};
