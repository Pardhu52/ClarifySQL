import dns from 'node:dns';
import { GoogleGenAI } from '@google/genai';
import { DatabaseSchema } from '../src/types';

// Ensure Node network stack prioritizes IPv4 to avoid broken/hanging IPv6 routes in containers
if (dns && typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === 'MY_GEMINI_API_KEY') {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        timeout: 12000, // Meets Google API minimum deadline (>= 10s) and bounds latency
      },
    });
  }
  return aiClient;
}

const CANDIDATE_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash',
];

export async function generateGeminiSql(
  query: string,
  schema: DatabaseSchema,
  clarificationSelection?: string
): Promise<{
  sql: string;
  explanation: string;
  tablesInvolved: string[];
  columnsInvolved: string[];
  modelUsed?: string;
} | null> {
  const client = getAiClient();
  if (!client) {
    return null;
  }

  const schemaSummary = schema.tables
    .map((t) => {
      const cols = t.columns.map((c) => `${c.name} (${c.dataType})`).join(', ');
      const fks = t.foreignKeys
        .map((fk) => `${fk.constrainedColumn} -> ${fk.referencedTable}.${fk.referencedColumn}`)
        .join(', ');
      return `TABLE ${t.name}:\n  Columns: ${cols}\n  Foreign Keys: ${fks || 'None'}`;
    })
    .join('\n\n');

  const prompt = `You are ClarifySQL, an expert schema-grounded SQL engine.
Generate a valid SQLite read-only SQL query (SELECT or WITH) answering the user query.

SCHEMA:
${schemaSummary}

USER QUERY:
"${query}"
${clarificationSelection ? `\nUSER SELECTED CLARIFICATION CHOICE:\n${clarificationSelection}` : ''}

CRITICAL RULES:
1. Output JSON only with keys: "sql", "explanation", "tablesInvolved", "columnsInvolved".
2. Only use tables and columns that exist in the schema.
3. Strict read-only statements only. Never use DROP, DELETE, INSERT, UPDATE, ALTER.
`;

  for (const model of CANDIDATE_MODELS) {
    try {
      const response = await client.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const text = response.text?.trim() || '{}';
      const parsed = JSON.parse(text);

      if (parsed.sql && typeof parsed.sql === 'string') {
        return {
          sql: parsed.sql,
          explanation: parsed.explanation || `Synthesized via ${model}.`,
          tablesInvolved: Array.isArray(parsed.tablesInvolved) ? parsed.tablesInvolved : [],
          columnsInvolved: Array.isArray(parsed.columnsInvolved) ? parsed.columnsInvolved : [],
          modelUsed: model,
        };
      }
    } catch (error: any) {
      const status = error?.status || error?.statusCode || error?.code;
      const msg = error?.message || String(error);
      console.warn(`[Gemini Server Service] Model ${model} request failed (${status || 'error'}: ${msg.slice(0, 100)}). Trying fallback...`);
    }
  }

  console.warn('[Gemini Server Service] All Gemini model candidates failed; falling back to schema-grounded local SQL engine.');
  return null;
}
