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
            time_from_treatment_start INTEGER,
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
        print("EXISTING DATABASE FOUND")
        return

    print("INITIALIZING DATABASE...")
    
    with open('cell-count.csv', 'r') as file:
        csv_reader = csv.DictReader(file)

        for row in csv_reader:
            # read in the sample metadata to the samples table
            c.execute("""
                INSERT INTO samples (sample_id, project_id, subject_id, time_from_treatment_start, sample_type)
                VALUES (?, ?, ?, ?, ?);
            """, (int(getnumber.search(row['sample']).group()), row['project'], row['subject'], row['time_from_treatment_start'], row['sample_type']))

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

    print("DONE")



# initialize the dashboard app

app = FastAPI()

# allow CORS for frontend/backend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# # define allowed columns for querying to prevent SQL injection and ensure only valid queries are made
allowed_cols_samples = ['sample_id', 'project_id', 'subject_id', 'time_from_treatment_start', 'sample_type']
allowed_cols_subjects = ['subject_id', 'condition', 'age', 'sex', 'treatment', 'response']
allowed_cols_cell_counts = ['sample_id', 'cell_type', 'count']

# # define primary keys for each table to handle pagination and querying
# primary_key = {
#     'samples': 'sample_id',
#     'subjects': 'subject_id',
#     'cell_counts': 'id'
# }


# for table in ['samples', 'subjects', 'cell_counts']:
#     if table == 'samples':
#         allowed_cols = allowed_cols_samples
#     elif table == 'subjects':
#         allowed_cols = allowed_cols_subjects
#     elif table == 'cell_counts':
#         allowed_cols = allowed_cols_cell_counts
#     else:
#         break

#     @app.get(f"/query/{table}/")
#     def query(*fields, id_start: int = 0, n: int = 100, **kwargs,):
#         if n > 1000:
#             n = 1000 # cap n to prevent overload, can implement pagination on frontend if more data is needed

#         # build SQL query based on provided query parameters, checking field is allowed to prevent injection and ensure valid queries
#         query = f"SELECT {','.join(f for f in fields if f in allowed_cols)} FROM {table}"
#         conditions = []
#         params = []

#         for key, value in kwargs.items():
#             if key not in allowed_cols or key is primary_key[table]: # handle sample id seperately, to control pagination
#                 continue # avoid injection or invalid query
#             conditions.append(f"{key} = ?")
#             params.append(value)
        
#         # return rows in batches, don't overload by sending entire table at once.
#         conditions.append(f"{primary_key[table]} >= ? AND {primary_key[table]} < ? + ?")
#         params.extend([id_start, id_start, n])

#         if conditions:
#             query += " WHERE " + " AND ".join(conditions)

#         conn = sqlite3.connect(DB)
#         df = pd.read_sql_query(query, conn, params=params)
#         conn.close()

#         return df.to_dict(orient='list')

#     @app.get(f"/sum/{table}/")
#     def sum(field: str, **kwargs):
#         if field not in allowed_cols:
#             return {"error": f"Invalid field for summation: '{field}'"}

#         query = f"SELECT SUM({field}) as total FROM {table}"
#         conditions = []
#         params = []

#         for key, value in kwargs.items():
#             if key not in allowed_cols:
#                 continue
#             conditions.append(f"{key} = ?")
#             params.append(value)

#         if conditions:
#             query += " WHERE " + " AND ".join(conditions)

#         conn = sqlite3.connect(DB)
#         df = pd.read_sql_query(query, conn, params=params)
#         conn.close()

#         return df.to_dict(orient='list')


@app.get('/entry_values/')
def get_entry_values(col: str):
    conn = sqlite3.connect(DB)
    df = pd.read_sql_query("""
            SELECT ?
            FROM samples
            GROUP BY ?
        """, conn, params=(col, col))
    conn.close()
    
    return df.to_dict(orient='list')

@app.get("/analysis/frequency_overview/")
def get_overview(start_sample_id: int, n_samples: int):
    if (n_samples < 0 or n_samples > 250):
        n_samples = 250 # Limit max amount sent over in one request, don't overload connection

    # get the requested info: sample, cell population, count, and total. Also process into relative frequency
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
                count * 1.0 / total AS relative_freq
            FROM counts_and_total
        """, conn, params=(start_sample_id, start_sample_id, n_samples))
    conn.close()
    # single source of truth: only compute cell count totals on query

    return df.to_dict(orient='list') # serialize as dict of lists not list of dicts, to reduce size during push over the network
    


@app.get("/analysis/treatment_statistics/")
def get_statistics(condition, treatment, sample_type):
    conn = sqlite3.connect(DB)

    # get the cell populations and response data relevant to samples done on patients with the given condition and treatment.
    # patient and cell count data is seperated out for DB stability, need to use JOIN to look get corresponding records.
    df = pd.read_sql_query("""            
        WITH condition_cell_counts AS (SELECT """
                # p.subject_id,
                # p.condition,
                # s.sample_id,
                + """s.time_from_treatment_start,
                p.response,
                c.cell_type,
                c.count,
                SUM(c.count) OVER (PARTITION BY c.sample_id) AS total
            FROM subjects p
            JOIN samples s ON p.subject_id = s.subject_id
            JOIN cell_counts c ON s.sample_id = c.sample_id
            WHERE
                p.condition = ?
                AND p.treatment = ?
                AND s.sample_type = ?
        ) SELECT """
            # subject_id,
            # conditiion,
            # sample_id,
            +"""time_from_treatment_start,
            response,
            cell_type,
            count * 1.0 / total AS relative_freq
        FROM condition_cell_counts
        """, conn, params=(condition, treatment, sample_type))
    conn.close()
    
    # compute min, max, quartiles for box plot
    stats = df.groupby(['cell_type', 'response', 'time_from_treatment_start'])['relative_freq'].agg(
        min_val='min',
        q1= lambda x: x.quantile(0.25),
        median='median',
        q3 = lambda x: x.quantile(0.75),
        max ='max'
    ).reset_index()

    # caclulate outlier fences
    iqr = stats['q3']-stats['q1']
    stats['lower_fence'] = stats['q1'] - 1.5 * iqr
    stats['upper_fence'] = stats['q3'] + 1.5 * iqr

    # insert stats into data in order to compare with fences
    merged = df.merge(stats, on=['cell_type', 'response', 'time_from_treatment_start'])

    # Create a boolean mask of what is and isn't an outlier
    is_outlier = (merged['relative_freq'] < merged['lower_fence']) | \
                 (merged['relative_freq'] > merged['upper_fence'])
    
    # Whiskers of plot - min/max of non outlier in-fence datapoints
    whiskers = merged[~is_outlier].groupby(['cell_type', 'response', 'time_from_treatment_start'])['relative_freq'].agg(
            adj_min='min',
            adj_max='max'
        ).reset_index()
    
    # outliers - outside fences
    outliers = merged[is_outlier].groupby(['cell_type', 'response', 'time_from_treatment_start'])['relative_freq'].apply(list).reset_index(name='outliers')

    # all stats needed for plot
    final_data = stats.merge(whiskers, on=['cell_type', 'response', 'time_from_treatment_start'], how='left') \
                      .merge(outliers, on=['cell_type', 'response', 'time_from_treatment_start'], how='left')
    
    # prevent NaNs
    final_data['outliers'] = final_data['outliers'].apply(lambda d: d if isinstance(d, list) else [])

    return final_data.to_dict(orient='list')




@app.get("/analysis/subset/")
def get_subset(condition: str, treatment: str, sample_type: str, time_from_treatment_start: int):
    partitions = ['sex', 'response', 'project_id'];
    partitionquery = []
    for field in partitions:
        if field in allowed_cols_samples:
            partitionquery.append(f"s.{field}")
        elif field in allowed_cols_subjects:
            partitionquery.append(f"p.{field}")
        elif field in allowed_cols_cell_counts:
            partitionquery.append(f"c.{field}")
    pq = ', '.join(partitionquery)
    # f-strings safe from here, since we explicitly check it is one of limited options.

    conn = sqlite3.connect(DB)
    df = pd.read_sql_query(f"""
        SELECT
            COUNT(s.sample_id) AS n_samples,
            {pq}
        FROM samples s
        JOIN subjects p ON s.subject_id = p.subject_id
        JOIN cell_counts c ON c.sample_id = s.sample_id
        WHERE p.condition = ? 
        AND s.sample_type = ? 
        AND s.time_from_treatment_start = ? 
        AND p.treatment = ?
        GROUP BY {pq};
    """, conn, params=(condition, sample_type, time_from_treatment_start, treatment))
    conn.close()
    
    return df.to_dict(orient='list')



if __name__ == "__main__":
    import uvicorn
    init_db() # init schema in case it doesn't exist, and load data from CSV
    uvicorn.run(app, host="127.0.0.1", port=8000)