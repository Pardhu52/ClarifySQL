import { DatabaseSchema, SchemaGraphResponse } from '../types';

export const BENCHMARK_DATABASES: DatabaseSchema[] = [
  {
    databaseId: 'retail_store',
    databaseName: 'Retail & E-Commerce Benchmark',
    databaseType: 'SQLite 3.40',
    summary: 'Multi-table commercial store schema with customers, orders, inventory products, line items, and financial invoices. Features real-world ambiguities across revenue columns and date timestamps.',
    tables: [
      {
        name: 'customers',
        rowCount: 12,
        description: 'Registered shoppers and membership demographics',
        primaryKeys: ['customer_id'],
        foreignKeys: [],
        columns: [
          { name: 'customer_id', dataType: 'INTEGER', isPrimaryKey: true, sampleValues: [1, 2, 3, 4] },
          { name: 'first_name', dataType: 'TEXT', sampleValues: ['Alice', 'Bob', 'Carlos', 'Diana'] },
          { name: 'last_name', dataType: 'TEXT', sampleValues: ['Miller', 'Chen', 'Rodriguez', 'Prince'] },
          { name: 'email', dataType: 'TEXT', sampleValues: ['alice.m@example.com', 'bchen@example.com'] },
          { name: 'city', dataType: 'TEXT', sampleValues: ['Austin', 'Seattle', 'Chicago', 'Miami'] },
          { name: 'signup_date', dataType: 'TEXT', sampleValues: ['2023-01-15', '2023-03-22', '2023-05-10'] },
        ],
      },
      {
        name: 'categories',
        rowCount: 4,
        description: 'High-level product classification hierarchy',
        primaryKeys: ['category_id'],
        foreignKeys: [],
        columns: [
          { name: 'category_id', dataType: 'INTEGER', isPrimaryKey: true, sampleValues: [1, 2, 3, 4] },
          { name: 'category_name', dataType: 'TEXT', sampleValues: ['Electronics', 'Footwear', 'Apparel', 'Home Office'] },
          { name: 'department', dataType: 'TEXT', sampleValues: ['Hardware', 'Lifestyle', 'Lifestyle', 'Furniture'] },
        ],
      },
      {
        name: 'products',
        rowCount: 8,
        description: 'Sellable catalog items with inventory stock levels and pricing',
        primaryKeys: ['product_id'],
        foreignKeys: [
          { constrainedColumn: 'category_id', referencedTable: 'categories', referencedColumn: 'category_id' },
        ],
        columns: [
          { name: 'product_id', dataType: 'INTEGER', isPrimaryKey: true, sampleValues: [101, 102, 103, 104] },
          { name: 'product_name', dataType: 'TEXT', sampleValues: ['Pro Laptop 15', 'Noise-Cancelling Headphones', 'Trail Running Shoes'] },
          { name: 'category_id', dataType: 'INTEGER', isForeignKey: true, foreignKeyTarget: 'categories.category_id', sampleValues: [1, 2, 3] },
          { name: 'sale_price', dataType: 'REAL', sampleValues: [1499.99, 299.50, 129.99, 899.00] },
          { name: 'stock_quantity', dataType: 'INTEGER', sampleValues: [45, 120, 80, 15] },
        ],
      },
      {
        name: 'orders',
        rowCount: 10,
        description: 'Customer transactions, fulfillment statuses, and gross amounts',
        primaryKeys: ['order_id'],
        foreignKeys: [
          { constrainedColumn: 'customer_id', referencedTable: 'customers', referencedColumn: 'customer_id' },
        ],
        columns: [
          { name: 'order_id', dataType: 'INTEGER', isPrimaryKey: true, sampleValues: [1001, 1002, 1003, 1004] },
          { name: 'customer_id', dataType: 'INTEGER', isForeignKey: true, foreignKeyTarget: 'customers.customer_id', sampleValues: [1, 2, 3, 4] },
          { name: 'order_date', dataType: 'TEXT', sampleValues: ['2024-06-01', '2024-06-03', '2024-06-10'] },
          { name: 'total_amount', dataType: 'REAL', sampleValues: [1699.49, 549.00, 899.00, 199.50] },
          { name: 'order_status', dataType: 'TEXT', sampleValues: ['completed', 'pending', 'cancelled', 'refunded'] },
          { name: 'shipping_city', dataType: 'TEXT', sampleValues: ['Austin', 'Seattle', 'Chicago', 'Denver'] },
        ],
      },
      {
        name: 'order_items',
        rowCount: 14,
        description: 'Line item breakdown of each ordered product, quantity, and unit price',
        primaryKeys: ['item_id'],
        foreignKeys: [
          { constrainedColumn: 'order_id', referencedTable: 'orders', referencedColumn: 'order_id' },
          { constrainedColumn: 'product_id', referencedTable: 'products', referencedColumn: 'product_id' },
        ],
        columns: [
          { name: 'item_id', dataType: 'INTEGER', isPrimaryKey: true, sampleValues: [501, 502, 503, 504] },
          { name: 'order_id', dataType: 'INTEGER', isForeignKey: true, foreignKeyTarget: 'orders.order_id', sampleValues: [1001, 1002, 1003] },
          { name: 'product_id', dataType: 'INTEGER', isForeignKey: true, foreignKeyTarget: 'products.product_id', sampleValues: [101, 102, 103] },
          { name: 'quantity', dataType: 'INTEGER', sampleValues: [1, 2, 3] },
          { name: 'unit_price', dataType: 'REAL', sampleValues: [1499.99, 299.50, 129.99] },
          { name: 'discount', dataType: 'REAL', sampleValues: [0.0, 0.1, 0.15] },
        ],
      },
      {
        name: 'invoices',
        rowCount: 6,
        description: 'Accounts receivable billing records, payment methods, and settlements',
        primaryKeys: ['invoice_id'],
        foreignKeys: [
          { constrainedColumn: 'order_id', referencedTable: 'orders', referencedColumn: 'order_id' },
        ],
        columns: [
          { name: 'invoice_id', dataType: 'INTEGER', isPrimaryKey: true, sampleValues: [9001, 9002, 9003] },
          { name: 'order_id', dataType: 'INTEGER', isForeignKey: true, foreignKeyTarget: 'orders.order_id', sampleValues: [1001, 1002, 1003] },
          { name: 'amount_due', dataType: 'REAL', sampleValues: [1699.49, 549.00, 899.00] },
          { name: 'payment_method', dataType: 'TEXT', sampleValues: ['Credit Card', 'PayPal', 'Apple Pay'] },
          { name: 'payment_status', dataType: 'TEXT', sampleValues: ['settled', 'pending', 'refunded'] },
          { name: 'invoice_date', dataType: 'TEXT', sampleValues: ['2024-06-01', '2024-06-03', '2024-06-10'] },
        ],
      },
    ],
  },
  {
    databaseId: 'university',
    databaseName: 'University & Academic Benchmark',
    databaseType: 'SQLite 3.40',
    summary: 'Academic relational structure covering departments, professors, course curriculums, student enrollments, and GPA academic standing.',
    tables: [
      {
        name: 'departments',
        rowCount: 4,
        description: 'Academic colleges and division buildings',
        primaryKeys: ['dept_id'],
        foreignKeys: [],
        columns: [
          { name: 'dept_id', dataType: 'TEXT', isPrimaryKey: true, sampleValues: ['CS', 'MATH', 'ENG', 'BIO'] },
          { name: 'dept_name', dataType: 'TEXT', sampleValues: ['Computer Science', 'Mathematics', 'Engineering', 'Biology'] },
          { name: 'building', dataType: 'TEXT', sampleValues: ['Turing Hall', 'Euler Building', 'Tesla Center', 'Darwin Lab'] },
        ],
      },
      {
        name: 'instructors',
        rowCount: 6,
        description: 'Faculty professors and appointed compensation',
        primaryKeys: ['instructor_id'],
        foreignKeys: [
          { constrainedColumn: 'dept_id', referencedTable: 'departments', referencedColumn: 'dept_id' },
        ],
        columns: [
          { name: 'instructor_id', dataType: 'INTEGER', isPrimaryKey: true, sampleValues: [101, 102, 103] },
          { name: 'name', dataType: 'TEXT', sampleValues: ['Dr. Ada Lovelace', 'Dr. Alan Turing', 'Dr. Katherine Johnson'] },
          { name: 'dept_id', dataType: 'TEXT', isForeignKey: true, foreignKeyTarget: 'departments.dept_id', sampleValues: ['CS', 'MATH', 'BIO'] },
          { name: 'salary', dataType: 'REAL', sampleValues: [115000.0, 120000.0, 98000.0] },
        ],
      },
      {
        name: 'courses',
        rowCount: 8,
        description: 'Curriculum catalog and unit credit allocations',
        primaryKeys: ['course_id'],
        foreignKeys: [
          { constrainedColumn: 'dept_id', referencedTable: 'departments', referencedColumn: 'dept_id' },
        ],
        columns: [
          { name: 'course_id', dataType: 'TEXT', isPrimaryKey: true, sampleValues: ['CS101', 'CS201', 'MATH301', 'ENG105'] },
          { name: 'title', dataType: 'TEXT', sampleValues: ['Intro to Computer Science', 'Algorithms & Data Structures', 'Linear Algebra'] },
          { name: 'dept_id', dataType: 'TEXT', isForeignKey: true, foreignKeyTarget: 'departments.dept_id', sampleValues: ['CS', 'MATH', 'ENG'] },
          { name: 'credits', dataType: 'INTEGER', sampleValues: [3, 4, 3, 4] },
        ],
      },
      {
        name: 'students',
        rowCount: 10,
        description: 'Undergraduate student roster and cumulative GPA',
        primaryKeys: ['student_id'],
        foreignKeys: [
          { constrainedColumn: 'dept_id', referencedTable: 'departments', referencedColumn: 'dept_id' },
        ],
        columns: [
          { name: 'student_id', dataType: 'INTEGER', isPrimaryKey: true, sampleValues: [202101, 202102, 202103] },
          { name: 'name', dataType: 'TEXT', sampleValues: ['Marcus Vance', 'Sarah Jenkins', 'Elena Rostova'] },
          { name: 'dept_id', dataType: 'TEXT', isForeignKey: true, foreignKeyTarget: 'departments.dept_id', sampleValues: ['CS', 'MATH', 'BIO'] },
          { name: 'enrollment_year', dataType: 'INTEGER', sampleValues: [2021, 2022, 2023] },
          { name: 'gpa', dataType: 'REAL', sampleValues: [3.88, 3.42, 3.95, 2.85] },
        ],
      },
      {
        name: 'enrollments',
        rowCount: 15,
        description: 'Course registrations, academic terms, and letter grades',
        primaryKeys: ['enrollment_id'],
        foreignKeys: [
          { constrainedColumn: 'student_id', referencedTable: 'students', referencedColumn: 'student_id' },
          { constrainedColumn: 'course_id', referencedTable: 'courses', referencedColumn: 'course_id' },
        ],
        columns: [
          { name: 'enrollment_id', dataType: 'INTEGER', isPrimaryKey: true, sampleValues: [1, 2, 3, 4] },
          { name: 'student_id', dataType: 'INTEGER', isForeignKey: true, foreignKeyTarget: 'students.student_id', sampleValues: [202101, 202102] },
          { name: 'course_id', dataType: 'TEXT', isForeignKey: true, foreignKeyTarget: 'courses.course_id', sampleValues: ['CS101', 'MATH301'] },
          { name: 'grade', dataType: 'TEXT', sampleValues: ['A', 'A-', 'B+', 'B', 'C'] },
          { name: 'term', dataType: 'TEXT', sampleValues: ['Fall 2023', 'Spring 2024'] },
        ],
      },
    ],
  },
];

export function buildSchemaGraph(schema: DatabaseSchema): SchemaGraphResponse {
  const nodes: SchemaGraphResponse['nodes'] = [];
  const edges: SchemaGraphResponse['edges'] = [];

  let colCount = 0;
  let fkCount = 0;

  for (const table of schema.tables) {
    nodes.push({
      id: table.name,
      label: table.name,
      nodeType: 'table',
      tableName: table.name,
    });

    for (const col of table.columns) {
      colCount++;
      const colId = `${table.name}.${col.name}`;
      nodes.push({
        id: colId,
        label: col.name,
        nodeType: 'column',
        tableName: table.name,
        dataType: col.dataType,
        isPrimaryKey: col.isPrimaryKey,
        isForeignKey: col.isForeignKey,
      });

      edges.push({
        source: table.name,
        target: colId,
        relationType: 'has_column',
        label: 'contains',
      });
    }

    for (const fk of table.foreignKeys) {
      fkCount++;
      edges.push({
        source: `${table.name}.${fk.constrainedColumn}`,
        target: `${fk.referencedTable}.${fk.referencedColumn}`,
        relationType: 'foreign_key',
        label: `FK (${table.name} -> ${fk.referencedTable})`,
      });
    }
  }

  return {
    databaseId: schema.databaseId,
    nodes,
    edges,
    tableCount: schema.tables.length,
    columnCount: colCount,
    foreignKeyCount: fkCount,
  };
}

export interface SampleQueryPrompt {
  label: string;
  query: string;
  category: 'Ambiguous' | 'Complex Join' | 'Aggregation' | 'Direct';
  ambiguityHint?: string;
}

export const SAMPLE_QUERIES: Record<string, SampleQueryPrompt[]> = {
  retail_store: [
    {
      label: 'Ambiguous "Sales" Calculation',
      query: 'Show me total sales by month for this year',
      category: 'Ambiguous',
      ambiguityHint: 'Triggers clarification: orders.total_amount vs order_items line-item subtotal vs products.sale_price.',
    },
    {
      label: 'Top Spenders (Cross-table Join)',
      query: 'Who are our top 5 customers by total completed purchase amount?',
      category: 'Complex Join',
      ambiguityHint: 'Joins customers and orders, grouping by customer ID.',
    },
    {
      label: 'Ambiguous "Date" Reference',
      query: 'Find records from the latest recent date in Austin',
      category: 'Ambiguous',
      ambiguityHint: 'Disambiguates customer signup_date vs order_date.',
    },
    {
      label: 'Inventory Stock Depletion',
      query: 'Which products have low stock under 20 units with their category?',
      category: 'Direct',
    },
  ],
  university: [
    {
      label: 'Ambiguous "Grades" Assessment',
      query: 'Show me top performing students with the highest scores',
      category: 'Ambiguous',
      ambiguityHint: 'Triggers clarification between cumulative GPA vs specific course letter grades.',
    },
    {
      label: 'Dean Honor Roll',
      query: 'List all computer science students with a cumulative GPA of 3.75 or higher',
      category: 'Direct',
    },
    {
      label: 'Course Department Enrollment',
      query: 'Show each department along with the number of courses offered and their credit totals',
      category: 'Aggregation',
    },
  ],
};
