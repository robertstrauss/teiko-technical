#!/usr/bin/env python3

import sqlite3
import csv
import pandas as pd
import re

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


DB = 'cytometry.db'
getnumber = re.compile(r'\d+') # extract integer from sampleXXXXX entries in the CSV

def init_db():
    conn = sqlite3.connect(DB)
    c = conn.cursor()

    # create table schema for samples and table for cell count cytometry data specifically.
    # 'samples' contains the metadata for each sample, while 'cell_counts' seperates out actual cytometry data
    # so DB structure is not dependent on which cell types are being measured,
    # and 'subjects' seperates patient data to eliminate redundancy
    c.execute('''
        CREATE TABLE IF NOT EXISTS samples (
            sample_id INTEGER PRIMARY KEY,
            project_id TEXT,
            subject_id TEXT,
            time_from_treatment INTEGER,
            sample_type TEXT
        )''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS subjects (
            subject_id TEXT PRIMARY KEY,
            condition TEXT,
            age INTEGER,
            sex TEXT,
            treatment TEXT,
            response TEXT,
            FOREIGN KEY (subject_id) REFERENCES samples(subject_id)
        )''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS cell_counts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sample_id INTEGER,
            cell_type TEXT,
            count INTEGER,
            FOREIGN KEY (sample_id) REFERENCES samples(sample_id)
        )''')

    # load data from CSV
    c.execute('SELECT COUNT(*) FROM samples')
    if c.fetchone()[0] > 0:
        print("Data already loaded, skipping CSV import.")
        conn.close()
        return
    
    with open('cell-count.csv', 'r') as file:
        csv_reader = csv.DictReader(file)

        for row in csv_reader:
            # read in the sample metadata to the samples table
            c.execute("""
                INSERT INTO samples (sample_id, project_id, subject_id, time_from_treatment, sample_type)
                VALUES (?, ?, ?, ?, ?);
            """, (int(getnumber.search(row['sample']).group()), row['project'], row['subject'], int(row['time_from_treatment_start']), row['sample_type']))

            # insert patient data if new subject_id is encountered
            c.execute("""
                INSERT OR IGNORE INTO subjects (subject_id, condition, age, sex, treatment, response)
                VALUES (?, ?, ?, ?, ?, ?);
            """, (row['subject'], row['condition'], int(row['age']), row['sex'], row['treatment'], row['response']))

            # insert cytometry data into cell_counts table
            for col in csv_reader.fieldnames:
                if col in ['project', 'subject', 'condition', 'age', 'sex', 'treatment', 'response', 
                           'sample', 'sample_type', 'time_from_treatment_start']:
                    continue  # skip metadata columns
                # must be cytometry data, insert into cell_counts table
                c.execute("""
                    INSERT INTO cell_counts (sample_id, cell_type, count)
                    VALUES (?, ?, ?);
                """, (int(getnumber.search(row['sample']).group()), col, int(getnumber.search(row[col]).group())))

    conn.commit()
    conn.close()


# initialize the dashboard app

app = FastAPI()

# # allow CORS for frontend/backend communication
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["http://localhost:5173", "http://localhost:3000"],
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

@app.get("/analysis/frequency_overview/")
def get_overview(start_sample_id: int, n_samples: int):
    # pull raw data from DB
    conn = sqlite3.connect(DB)
    df = pd.read_sql_query("""
            WITH counts_and_total AS (
                SELECT
                    sample_id,
                    cell_type,
                    count,
                    SUM(count) OVER (PARTITION BY sample_id) AS total
                FROM cell_counts WHERE sample_id >= ? AND sample_id < ? + ?
            )
            SELECT
                sample_id,
                cell_type,
                count,
                total,
                count * 100.0 / total AS percentage
            FROM counts_and_total
        """, conn, params=(start_sample_id, start_sample_id, n_samples))
    conn.close()
    # single source of truth: only compute cell count totals on query

    return df.to_dict(orient='list')
    


@app.get("/analysis/treatment_statistics")
def get_statistics():
    return

@app.get("/analysis/subset/")
def get_subset(condition: str, sample_type: str, time_from_treatment: int, treatment: str):
    conn = sqlite3.connect(DB)
    df = pd.read_sql_query("""
        SELECT
            sample_id,
            COUNT(SAMPLE_ID) AS n_samples,
            SUM(CASE WHEN response = 'yes' THEN 1 ELSE 0 END) AS n_responders,
            SUM(CASE WHEN response = 'no' THEN 1 ELSE 0 END) AS n_non_responders,
            SUM(CASE WHEN sex = 'M' THEN 1 ELSE 0 END) AS n_male,
            SUM(CASE WHEN sex = 'F' THEN 1 ELSE 0 END) AS n_female,
            project_id,
            COUNT(project_id) AS n_in_project
        FROM samples WHERE condition = ? AND sample_type = ? AND time_from_treatment = ? AND treatment = ?
    """, conn, params=(condition, sample_type, time_from_treatment, treatment))
    conn.close()

    return df.to_dict(orient='list')



if __name__ == "__main__":
    import uvicorn
    init_db() # init schema in case it doesn't exist, and load data from CSV
    uvicorn.run(app, host="127.0.0.1", port=8000)