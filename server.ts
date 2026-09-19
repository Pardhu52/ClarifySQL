import dns from 'node:dns';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { executeSqlSafe } from './server/sqliteBridge';
import { generateGeminiSql } from './server/geminiService';
import { BENCHMARK_DATABASES } from './src/data/schemas';

// Ensure Node network stack prioritizes IPv4 to avoid broken/hanging IPv6 routes in containers
if (dns && typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // 1. API Health
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'ClarifySQL Express Full-Stack Server',
      databasesAvailable: BENCHMARK_DATABASES.map((d) => d.databaseId),
    });
  });

  // 2. List available introspected databases
  app.get('/api/databases', (req, res) => {
    res.json(BENCHMARK_DATABASES);
  });

  // 3. Schema inspection
  app.get('/api/schema/:databaseId', (req, res) => {
    const { databaseId } = req.params;
    const db = BENCHMARK_DATABASES.find((d) => d.databaseId === databaseId);
    if (!db) {
      return res.status(404).json({ error: `Database '${databaseId}' not found.` });
    }
    res.json(db);
  });

  // 4. Safe SQL Execution endpoint (via sqliteBridge)
  app.post('/api/sql/execute', async (req, res) => {
    const { database_id, sql, max_rows } = req.body;
    if (!database_id || !sql) {
      return res.status(400).json({ error: 'Missing database_id or sql query' });
    }

    try {
      const result = await executeSqlSafe(database_id, sql, max_rows || 100);
      res.json({
        execution: {
          success: result.success,
          database_id: result.database_id,
          columns: result.columns,
          rows: result.rows,
          row_count: result.row_count,
          execution_time_ms: result.execution_time_ms,
          error: result.error,
        },
        explainability: {
          status: result.success ? 'ANSWERABLE' : 'EXECUTION_ERROR',
          summary_reason: result.error || 'Query executed safely under read-only constraints.',
          safety_checks_passed: result.success,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 5. Text-to-SQL with Clarification
  app.post('/api/text-to-sql', async (req, res) => {
    const { query, database_id, clarification_selection } = req.body;
    const db = BENCHMARK_DATABASES.find((d) => d.databaseId === database_id) || BENCHMARK_DATABASES[0];

    const qLower = (query || '').toLowerCase();

    // Check for ambiguity if no clarification choice provided yet
    if (!clarification_selection) {
      if (database_id === 'retail_store') {
        if (/\b(sales|revenue|amount spent|earnings)\b/.test(qLower)) {
          return res.json({
            query,
            database_id,
            sql: null,
            clarification: {
              needs_clarification: true,
              ambiguity_type: 'COLUMN_AMBIGUITY',
              ambiguous_term: 'sales / revenue',
              question: "The term 'sales' can refer to different metrics in this schema. Which calculation do you intend?",
              confidence_score: 0.45,
              options: [
                {
                  id: 'orders_total',
                  label: 'Gross Order Volume (orders.total_amount)',
                  description: 'Calculates transaction amounts on completed and confirmed orders.',
                  target_table: 'orders',
                  target_column: 'total_amount',
                  example_value: '$1,699.49',
                },
                {
                  id: 'order_items_subtotal',
                  label: 'Merchandise Line Items (order_items.quantity * order_items.unit_price)',
                  description: 'Calculates pure product sales at the individual cart item level.',
                  target_table: 'order_items',
                  target_column: 'unit_price',
                  example_value: '3 x $299.50 = $898.50',
                },
                {
                  id: 'products_price',
                  label: 'Catalog Listed Price (products.sale_price)',
                  description: 'Analyzes inventory catalog unit sale prices regardless of orders.',
                  target_table: 'products',
                  target_column: 'sale_price',
                  example_value: '$1,499.99',
                },
              ],
            },
            explanation: "Ambiguity detected on 'sales': multiple candidate columns exist (orders.total_amount vs order_items.unit_price). Clarification requested.",
            tables_involved: ['orders', 'order_items', 'products'],
            columns_involved: ['total_amount', 'unit_price', 'sale_price'],
            engine: 'ClarifySQL Ambiguity Gate',
          });
        }

        if (/\b(date|recent|when|latest)\b/.test(qLower) && !/\b(order date|signup date)\b/.test(qLower)) {
          return res.json({
            query,
            database_id,
            sql: null,
            clarification: {
              needs_clarification: true,
              ambiguity_type: 'TEMPORAL_FILTER',
              ambiguous_term: 'date reference',
              question: 'Which chronological timestamp should this query filter by?',
              confidence_score: 0.5,
              options: [
                {
                  id: 'orders_date',
                  label: 'Order Purchase Date (orders.order_date)',
                  description: 'When the customer placed their transaction.',
                  target_table: 'orders',
                  target_column: 'order_date',
                },
                {
                  id: 'customers_signup',
                  label: 'User Account Registration (customers.signup_date)',
                  description: 'When the customer first registered their account.',
                  target_table: 'customers',
                  target_column: 'signup_date',
                },
              ],
            },
            explanation: "Ambiguity detected on date timestamps: customers.signup_date vs orders.order_date. Clarification requested.",
            tables_involved: ['orders', 'customers'],
            columns_involved: ['order_date', 'signup_date'],
            engine: 'ClarifySQL Ambiguity Gate',
          });
        }
      } else if (database_id === 'university') {
        if (/\b(score|grade|marks|performance)\b/.test(qLower)) {
          return res.json({
            query,
            database_id,
            sql: null,
            clarification: {
              needs_clarification: true,
              ambiguity_type: 'COLUMN_AMBIGUITY',
              ambiguous_term: 'academic performance',
              question: 'Do you want to evaluate cumulative GPA or course-specific letter grades?',
              confidence_score: 0.5,
              options: [
                {
                  id: 'students_gpa',
                  label: 'Cumulative GPA (students.gpa)',
                  description: 'Overall student GPA on a 4.0 scale.',
                  target_table: 'students',
                  target_column: 'gpa',
                  example_value: '3.88',
                },
                {
                  id: 'enrollments_grade',
                  label: 'Course Letter Grade (enrollments.grade)',
                  description: 'Individual course evaluation grade (e.g. A, B+, C).',
                  target_table: 'enrollments',
                  target_column: 'grade',
                  example_value: "'A'",
                },
              ],
            },
            explanation: "Ambiguity detected: students.gpa vs enrollments.grade. Clarification requested.",
            tables_involved: ['students', 'enrollments'],
            columns_involved: ['gpa', 'grade'],
            engine: 'ClarifySQL Ambiguity Gate',
          });
        }
      }
    }

    // Try Gemini first if key available
    const geminiResult = await generateGeminiSql(query, db, clarification_selection);
    if (geminiResult && geminiResult.sql) {
      return res.json({
        query,
        database_id,
        sql: geminiResult.sql,
        clarification: null,
        explanation: geminiResult.explanation,
        tables_involved: geminiResult.tablesInvolved,
        columns_involved: geminiResult.columnsInvolved,
        engine: geminiResult.modelUsed
          ? `Gemini ${geminiResult.modelUsed.replace('gemini-', '').replace('-preview', '')} (Schema-Grounded)`
          : 'Gemini (Schema-Grounded)',
      });
    }

    // Fallback schema heuristic generation
    if (database_id === 'retail_store') {
      if (clarification_selection === 'order_items_subtotal') {
        return res.json({
          query,
          database_id,
          sql: `SELECT p.product_name,
       SUM(oi.quantity) AS units_sold,
       ROUND(SUM(oi.quantity * oi.unit_price), 2) AS merchandise_sales
FROM order_items oi
JOIN products p ON oi.product_id = p.product_id
GROUP BY p.product_id
ORDER BY merchandise_sales DESC;`,
          clarification: null,
          explanation: 'Aggregating line-item merchandise sales (quantity * unit_price) per your clarification choice.',
          tables_involved: ['order_items', 'products'],
          columns_involved: ['product_name', 'quantity', 'unit_price'],
          engine: 'ClarifySQL Deterministic Engine',
        });
      }

      if (clarification_selection === 'products_price') {
        return res.json({
          query,
          database_id,
          sql: `SELECT product_id, product_name, sale_price, stock_quantity
FROM products
ORDER BY sale_price DESC;`,
          clarification: null,
          explanation: 'Listing catalog products by catalog sale price per your clarification selection.',
          tables_involved: ['products'],
          columns_involved: ['product_id', 'product_name', 'sale_price', 'stock_quantity'],
          engine: 'ClarifySQL Deterministic Engine',
        });
      }

      if (qLower.includes('customer') || qLower.includes('top') || qLower.includes('spend')) {
        return res.json({
          query,
          database_id,
          sql: `SELECT c.customer_id, c.first_name, c.last_name, c.email,
       COUNT(o.order_id) AS total_orders,
       ROUND(SUM(o.total_amount), 2) AS total_spent
FROM customers c
JOIN orders o ON c.customer_id = o.customer_id
WHERE o.order_status = 'completed'
GROUP BY c.customer_id
ORDER BY total_spent DESC
LIMIT 5;`,
          clarification: null,
          explanation: 'Traversed foreign key customers.customer_id = orders.customer_id and aggregated total_amount for completed orders.',
          tables_involved: ['customers', 'orders'],
          columns_involved: ['customer_id', 'first_name', 'last_name', 'total_amount', 'order_status'],
          engine: 'ClarifySQL Deterministic Engine',
        });
      }

      if (qLower.includes('stock') || qLower.includes('inventory')) {
        return res.json({
          query,
          database_id,
          sql: `SELECT p.product_id, p.product_name, c.category_name, p.sale_price, p.stock_quantity
FROM products p
JOIN categories c ON p.category_id = c.category_id
WHERE p.stock_quantity < 20
ORDER BY p.stock_quantity ASC;`,
          clarification: null,
          explanation: 'Filtered products where stock_quantity is below 20, joined with categories.',
          tables_involved: ['products', 'categories'],
          columns_involved: ['product_id', 'product_name', 'category_name', 'stock_quantity'],
          engine: 'ClarifySQL Deterministic Engine',
        });
      }

      // Default sales query
      return res.json({
        query,
        database_id,
        sql: `SELECT strftime('%Y-%m', order_date) AS order_month,
       COUNT(order_id) AS order_count,
       ROUND(SUM(total_amount), 2) AS gross_sales
FROM orders
WHERE order_status = 'completed'
GROUP BY order_month
ORDER BY order_month DESC;`,
        clarification: null,
        explanation: 'Aggregating monthly gross sales on orders.total_amount for completed orders.',
        tables_involved: ['orders'],
        columns_involved: ['order_date', 'order_id', 'total_amount', 'order_status'],
        engine: 'ClarifySQL Deterministic Engine',
      });
    }

    if (database_id === 'university') {
      if (qLower.includes('gpa') || qLower.includes('honor') || qLower.includes('student') || clarification_selection === 'students_gpa') {
        return res.json({
          query,
          database_id,
          sql: `SELECT s.student_id, s.name, d.dept_name, s.gpa
FROM students s
JOIN departments d ON s.dept_id = d.dept_id
WHERE s.gpa >= 3.75
ORDER BY s.gpa DESC;`,
          clarification: null,
          explanation: 'Listing high GPA students joined with their academic department.',
          tables_involved: ['students', 'departments'],
          columns_involved: ['student_id', 'name', 'dept_name', 'gpa'],
          engine: 'ClarifySQL Deterministic Engine',
        });
      }

      return res.json({
        query,
        database_id,
        sql: `SELECT c.course_id, c.title, d.dept_name, c.credits
FROM courses c
JOIN departments d ON c.dept_id = d.dept_id
ORDER BY c.course_id;`,
        clarification: null,
        explanation: 'Retrieving courses joined with academic departments.',
        tables_involved: ['courses', 'departments'],
        columns_involved: ['course_id', 'title', 'dept_name', 'credits'],
        engine: 'ClarifySQL Deterministic Engine',
      });
    }

    return res.json({
      query,
      database_id,
      sql: `SELECT * FROM ${db.tables[0].name} LIMIT 10;`,
      clarification: null,
      explanation: `Default inspection for ${database_id}.`,
      tables_involved: [db.tables[0].name],
      columns_involved: db.tables[0].columns.map((c: any) => c.name),
      engine: 'ClarifySQL Deterministic Engine',
    });
  });

  // Vite middleware in dev or static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[ClarifySQL Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
