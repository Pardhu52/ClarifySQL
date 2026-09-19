"""Generates realistic benchmark SQLite databases for ClarifySQL testing and demos.

Includes schemas designed with real-world ambiguities (e.g. multiple sales columns,
status fields, cross-table foreign key relationships).
"""

import os
import sqlite3
from typing import List

SAMPLE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")


def create_retail_database(db_path: str) -> None:
    """Creates an E-commerce Retail database with intentional schema ambiguity points:

    - 'sales' could refer to: orders.total_amount, invoices.revenue, products.sale_price
    - 'date' could refer to: orders.order_date, invoices.invoice_date, customers.signup_date
    """
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    if os.path.exists(db_path):
        os.remove(db_path)

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    cur.executescript(
        """
        PRAGMA foreign_keys = ON;

        CREATE TABLE customers (
            customer_id INTEGER PRIMARY KEY,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            email TEXT UNIQUE,
            city TEXT,
            signup_date TEXT
        );

        CREATE TABLE categories (
            category_id INTEGER PRIMARY KEY,
            category_name TEXT NOT NULL,
            department TEXT
        );

        CREATE TABLE products (
            product_id INTEGER PRIMARY KEY,
            product_name TEXT NOT NULL,
            category_id INTEGER REFERENCES categories(category_id),
            sale_price REAL NOT NULL,
            stock_quantity INTEGER DEFAULT 0
        );

        CREATE TABLE orders (
            order_id INTEGER PRIMARY KEY,
            customer_id INTEGER REFERENCES customers(customer_id),
            order_date TEXT NOT NULL,
            total_amount REAL NOT NULL,
            order_status TEXT NOT NULL CHECK(order_status IN ('completed', 'pending', 'cancelled', 'refunded')),
            shipping_city TEXT
        );

        CREATE TABLE order_items (
            item_id INTEGER PRIMARY KEY,
            order_id INTEGER REFERENCES orders(order_id),
            product_id INTEGER REFERENCES products(product_id),
            quantity INTEGER NOT NULL,
            unit_price REAL NOT NULL,
            discount REAL DEFAULT 0.0
        );

        CREATE TABLE invoices (
            invoice_id INTEGER PRIMARY KEY,
            order_id INTEGER REFERENCES orders(order_id),
            revenue REAL NOT NULL,
            payment_method TEXT,
            payment_status TEXT,
            invoice_date TEXT NOT NULL
        );

        -- Seed Customers
        INSERT INTO customers VALUES 
            (1, 'Alice', 'Morgan', 'alice.m@example.com', 'Seattle', '2024-01-15'),
            (2, 'Bob', 'Chen', 'bchen@example.com', 'Austin', '2024-02-20'),
            (3, 'Carla', 'Santos', 'carla.s@example.com', 'New York', '2024-03-10'),
            (4, 'David', 'Kim', 'dkim@example.com', 'San Francisco', '2024-04-05'),
            (5, 'Elena', 'Rostova', 'elena.r@example.com', 'Chicago', '2024-05-18');

        -- Seed Categories
        INSERT INTO categories VALUES
            (1, 'Laptops & Computers', 'Electronics'),
            (2, 'Smartphones & Accessories', 'Electronics'),
            (3, 'Office Furniture', 'Home & Office'),
            (4, 'Audio & Headphones', 'Electronics');

        -- Seed Products
        INSERT INTO products VALUES
            (101, 'Zenith Pro 16 Laptop', 1, 1499.99, 45),
            (102, 'Aura Wireless Headphones', 4, 199.50, 120),
            (103, 'ErgoFlex Standing Desk', 3, 549.00, 30),
            (104, 'Nova 12 Smartphone', 2, 899.00, 65),
            (105, 'Quantum Mechanical Keyboard', 1, 129.99, 85);

        -- Seed Orders
        INSERT INTO orders VALUES
            (1001, 1, '2024-06-01', 1699.49, 'completed', 'Seattle'),
            (1002, 2, '2024-06-03', 549.00, 'completed', 'Austin'),
            (1003, 3, '2024-06-10', 899.00, 'pending', 'New York'),
            (1004, 1, '2024-06-15', 199.50, 'completed', 'Seattle'),
            (1005, 4, '2024-06-20', 1499.99, 'refunded', 'San Francisco'),
            (1006, 5, '2024-06-25', 1028.99, 'completed', 'Chicago');

        -- Seed Order Items
        INSERT INTO order_items VALUES
            (501, 1001, 101, 1, 1499.99, 0.0),
            (502, 1001, 102, 1, 199.50, 0.0),
            (503, 1002, 103, 1, 549.00, 0.0),
            (504, 1003, 104, 1, 899.00, 0.0),
            (505, 1004, 102, 1, 199.50, 0.0),
            (506, 1005, 101, 1, 1499.99, 0.0),
            (507, 1006, 104, 1, 899.00, 0.0),
            (508, 1006, 105, 1, 129.99, 0.0);

        -- Seed Invoices
        INSERT INTO invoices VALUES
            (9001, 1001, 1699.49, 'Credit Card', 'settled', '2024-06-01'),
            (9002, 1002, 549.00, 'PayPal', 'settled', '2024-06-03'),
            (9003, 1003, 899.00, 'Credit Card', 'pending', '2024-06-10'),
            (9004, 1004, 199.50, 'Apple Pay', 'settled', '2024-06-15'),
            (9005, 1005, 0.00, 'Credit Card', 'refunded', '2024-06-22'),
            (9006, 1006, 1028.99, 'Credit Card', 'settled', '2024-06-25');
        """
    )
    conn.commit()
    conn.close()


def create_university_database(db_path: str) -> None:
    """Creates a University benchmark database with courses, instructors, students, and enrollments."""
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    if os.path.exists(db_path):
        os.remove(db_path)

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    cur.executescript(
        """
        PRAGMA foreign_keys = ON;

        CREATE TABLE departments (
            dept_id TEXT PRIMARY KEY,
            dept_name TEXT NOT NULL,
            building TEXT
        );

        CREATE TABLE instructors (
            instructor_id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            dept_id TEXT REFERENCES departments(dept_id),
            salary REAL
        );

        CREATE TABLE courses (
            course_id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            dept_id TEXT REFERENCES departments(dept_id),
            credits INTEGER NOT NULL
        );

        CREATE TABLE students (
            student_id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            dept_id TEXT REFERENCES departments(dept_id),
            enrollment_year INTEGER,
            gpa REAL
        );

        CREATE TABLE enrollments (
            enrollment_id INTEGER PRIMARY KEY,
            student_id INTEGER REFERENCES students(student_id),
            course_id TEXT REFERENCES courses(course_id),
            semester TEXT,
            grade TEXT
        );

        INSERT INTO departments VALUES
            ('CS', 'Computer Science', 'Turing Hall'),
            ('MATH', 'Mathematics', 'Euler Hall'),
            ('PHYS', 'Physics', 'Newton Hall');

        INSERT INTO instructors VALUES
            (10, 'Dr. Alan Turing', 'CS', 115000),
            (20, 'Dr. Katherine Johnson', 'MATH', 110000),
            (30, 'Dr. Richard Feynman', 'PHYS', 120000);

        INSERT INTO courses VALUES
            ('CS101', 'Intro to Computer Systems', 'CS', 4),
            ('CS340', 'Database Management Systems', 'CS', 4),
            ('MATH201', 'Linear Algebra & Matrices', 'MATH', 3),
            ('PHYS150', 'Classical Mechanics', 'PHYS', 4);

        INSERT INTO students VALUES
            (1001, 'Ada Lovelace', 'CS', 2023, 3.95),
            (1002, 'Grace Hopper', 'CS', 2022, 3.88),
            (1003, 'Claude Shannon', 'MATH', 2023, 3.91),
            (1004, 'John von Neumann', 'CS', 2021, 4.00);

        INSERT INTO enrollments VALUES
            (1, 1001, 'CS340', 'Fall 2024', 'A'),
            (2, 1001, 'MATH201', 'Fall 2024', 'A'),
            (3, 1002, 'CS340', 'Fall 2024', 'A-'),
            (4, 1003, 'MATH201', 'Fall 2024', 'A'),
            (5, 1004, 'CS101', 'Spring 2024', 'A');
        """
    )
    conn.commit()
    conn.close()


def initialize_sample_databases() -> List[str]:
    """Generates default demo databases in data/ directory."""
    os.makedirs(SAMPLE_DIR, exist_ok=True)
    retail_db = os.path.join(SAMPLE_DIR, "retail_store.db")
    uni_db = os.path.join(SAMPLE_DIR, "university.db")

    create_retail_database(retail_db)
    create_university_database(uni_db)

    return [retail_db, uni_db]
