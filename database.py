import sqlite3
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), 'cardiopulse.db')

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Create or upgrade the predictions table with patient name and diet type."""
    conn = get_connection()
    # For development ease, we recreate the table to support new schema fields: patient_name, diet_type
    conn.execute('DROP TABLE IF EXISTS predictions')
    conn.execute('''
        CREATE TABLE predictions (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp     TEXT    NOT NULL,
            patient_name  TEXT    NOT NULL,
            diet_type     TEXT    NOT NULL,
            age           INTEGER NOT NULL,
            sex           INTEGER NOT NULL,
            cp            INTEGER NOT NULL,
            trestbps      REAL    NOT NULL,
            chol          REAL    NOT NULL,
            fbs           INTEGER NOT NULL,
            thalach       REAL    NOT NULL,
            exang         INTEGER NOT NULL,
            prediction    INTEGER NOT NULL,
            probability   REAL    NOT NULL,
            risk_label    TEXT    NOT NULL,
            model_used    TEXT    NOT NULL
        )
    ''')
    conn.commit()
    conn.close()

def save_prediction(inputs: dict, result: dict, model_name: str):
    """Save a single prediction session to the database."""
    conn = get_connection()
    conn.execute('''
        INSERT INTO predictions
            (timestamp, patient_name, diet_type, age, sex, cp, trestbps, chol, fbs, thalach, exang,
             prediction, probability, risk_label, model_used)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        inputs.get('patient_name', 'Anonymous'),
        inputs.get('diet_type', 'Standard'),
        int(inputs['age']),
        int(inputs['sex']),
        int(inputs['cp']),
        float(inputs['trestbps']),
        float(inputs['chol']),
        int(inputs['fbs']),
        float(inputs['thalach']),
        int(inputs['exang']),
        int(result['prediction']),
        float(result['probability']),
        result['label'],
        model_name
    ))
    conn.commit()
    conn.close()

def get_all_predictions(limit: int = 50):
    """Retrieve the most recent predictions, newest first."""
    conn = get_connection()
    rows = conn.execute(
        'SELECT * FROM predictions ORDER BY id DESC LIMIT ?', (limit,)
    ).fetchall()
    conn.close()
    return [dict(row) for row in rows]

def clear_all_predictions():
    """Delete all stored predictions."""
    conn = get_connection()
    conn.execute('DELETE FROM predictions')
    conn.commit()
    conn.close()

# Auto-initialise the DB when this module is imported
init_db()
