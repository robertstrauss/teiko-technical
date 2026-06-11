#!/usr/bin/env python3

import sqlite3
import csv
import pandas as pd
import re
import sys, os

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
    if c.fetchone()[0] > 0: # check if data is already loaded (samples db not empty)
        print("Data already loaded, skipping CSV import.")
        conn.close()
        print("EXISTING DATABASE FOUND")
        return

    # load data in from csv
    print("POPULATING DATABASE...")
    
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

    print("DATABASE INITIALIZED.")



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


# define allowed columns for querying to prevent SQL injection and ensure only valid queries are made
COLUMN_REGISTRY = {
    'sample_id': 'samples.sample_id',
    'project_id': 'samples.project_id',
    'subject_id': 'samples.subject_id',
    'time_from_treatment_start': 'samples.time_from_treatment_start',
    'sample_type': 'samples.sample_type',
    'n_samples': 'COUNT(samples.sample_id) AS n_samples',

    # 'subject_id': 'subjects.subject_id',
    'condition': 'subjects.condition',
    'age': 'subjects.age',
    'sex': 'subjects.sex',
    'treatment': 'subjects.treatment',
    'response': 'subjects.response',

    # 'sample_id': 'cell_counts.sample_id',
    'cell_type': 'cell_counts.cell_type',
    'count': 'cell_counts.count',
    'total': 'SUM(cell_counts.count) OVER (PARTITION BY cell_counts.sample_id) AS total',
}




@app.get('/possible_values/')
def api_possible_values(col: str, constraint = {}, limit=100, offset=0):
    offset = int(offset)
    limit = min(int(limit), 1000)
    return get_possible_values(col, constraint, limit, offset)

def get_possible_values(col: str, constraint = {}, limit=None, offset=0):
    if not col in COLUMN_REGISTRY: return []

    params = [*constraint.values()]
    if limit is not None:
        params = params + [offset, limit]

    conn = sqlite3.connect(DB)
    df = pd.read_sql_query(f"""
            SELECT {COLUMN_REGISTRY[col]}
            FROM samples
            JOIN subjects ON subjects.subject_id = samples.subject_id
            JOIN cell_counts ON cell_counts.sample_id = samples.sample_id
            {f"WHERE {" AND ".join([f"{COLUMN_REGISTRY[col]} = ?" for col in constraint if col in COLUMN_REGISTRY])}" if len(constraint) > 0 else ""}
            GROUP BY {COLUMN_REGISTRY[col]}
            {"LIMIT ? OFFSET ?" if limit is not None else ""}
        """, conn, params=params)
    conn.close()
    
    return df[col]


# Most abstract injection-safe query, access to fields from all tables
@app.get(f"/query/")
def api_query(*fields, constraint, sort=['sample_id'], offset: int = 0, limit: int = 100):
    limit = min(limit, 1000) # cap n rows returned to prevent overload, can implement pagination on frontend if more data is needed
    # return in list format for minimal redundancy, minimize network footprint
    return query(*fields, constraint=constraint, sort=sort, offset=offset, limit=limit).to_dict(format='list')

def query(*fields, constraint, sort=['sample_id'], join_cell_counts = True, offset: int = 0, limit = None):
    
    # sanitize arbitrary column names by taking only values specified in COLUMN_REGISTRY

    # build SQL query based on provided query parameters, checking field is allowed to prevent injection and ensure valid queries
    conn = sqlite3.connect(DB)
    params = [*constraint.values(),]
    if limit is not None:
        params = params + [limit, offset]
    
    sortpriority = [COLUMN_REGISTRY[col] for col in sort if col in COLUMN_REGISTRY]
    if len(sortpriority) < 1:
        sortpriority = ['sample_id']
    df = pd.read_sql_query(f"""SELECT {", ".join([COLUMN_REGISTRY[col] for col in fields if col in COLUMN_REGISTRY])} FROM samples
                JOIN subjects ON subjects.subject_id = samples.subject_id
                {"JOIN cell_counts ON cell_counts.sample_id = samples.sample_id" if join_cell_counts else ""}
                WHERE {" AND ".join([f"{COLUMN_REGISTRY[col]} = ?" for col in constraint.keys() if col in COLUMN_REGISTRY])}
                ORDER BY {", ".join(sortpriority)}
                {"LIMIT ? OFFSET ?" if limit is not None else ""}
        """, conn, params=params)

    conn.close()

    return df





@app.get("/analysis/frequency_overview/")
def api_get_summary(start_sample_id, n_samples, offset = '0', limit = '1000'):
    offset = int(offset)
    limit = min(int(limit), 1000)
    return get_overview_summary.to_dict(format='list', offset=offset, limit=limit)

def get_overview_summary(offset = 0, limit = None):
    params = []
    if limit is not None:
        params = params + [limit, offset]

    # get the requested info: sample, cell population, count, and total. Also process into relative frequency
    # single source of truth: only compute cell count totals on query
    conn = sqlite3.connect(DB)
    df = pd.read_sql_query(f"""
            WITH counts_and_total AS (
                SELECT
                    sample_id,
                    SUM(count) OVER (PARTITION BY sample_id) AS total,
                    cell_type,
                    count
                FROM cell_counts
                {"LIMIT ? OFFSET ?" if limit is not None else ""}
            )
            SELECT
                sample_id,
                total,
                cell_type,
                count,
                count * 1.0 / total AS relative_freq
            FROM counts_and_total
        """, conn, params=params)
    conn.close()

    return df
    


@app.get("/analysis/treatment_statistics/")
def api_treatment_stats(condition, treatment, sample_type):
    return get_treatment_statistics(condition=condition, treatment=treatment, sample_type=sample_type).to_dict(format='list')

def get_treatment_statistics(condition, treatment, sample_type):
    conn = sqlite3.connect(DB)

    # get the cell populations and response data relevant to samples done on patients with the given condition and treatment.
    # patient and cell count data is seperated out for DB stability, need to use JOIN to look get corresponding records.
    df = pd.read_sql_query("""            
        WITH condition_cell_counts AS (SELECT
                s.time_from_treatment_start,
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
        ) SELECT
            time_from_treatment_start,
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

    return final_data



@app.get("/analysis/subset/")
def api_get_subset_info(condition: str, treatment: str, sample_type: str, time_from_treatment_start: int):
    # don't need limit or offset, only returns the total samples in a few possible subsets, very small data.
    return get_subset_info(condition, treatment, sample_type, time_from_treatment_start).to_dict(format='list')

def get_subset_info(condition: str, treatment: str, sample_type: str, time_from_treatment_start: int):
    partitions = ['sex', 'response', 'project_id'];
    partitionquery = []
    for field in partitions:
        partitionquery.append(COLUMN_REGISTRY[field])
    pq = ', '.join(partitionquery)
    # f-strings safe from here, since we explicitly check it is one of limited options.

    conn = sqlite3.connect(DB)
    df = pd.read_sql_query(f"""
        SELECT
            COUNT(samples.sample_id) AS n_samples,
            {pq}
        FROM samples
        JOIN subjects ON samples.subject_id = subjects.subject_id
        JOIN cell_counts ON cell_counts.sample_id = samples.sample_id
        WHERE subjects.condition = ? 
        AND samples.sample_type = ? 
        AND samples.time_from_treatment_start = ? 
        AND subjects.treatment = ?
        GROUP BY {pq};
    """, conn, params=(condition, sample_type, time_from_treatment_start, treatment))
    conn.close()
    
    return df


def boxplot(treatment_data):
    fig = plt.figure(figsize=(10, 6))

    # sns.boxplot automatically handles the grouping and coloring
    sns.boxplot(
        data=treatment_data, 
        x='cell_type', 
        y='count', 
        hue='response', # This is the magic argument that creates side-by-side boxes
        palette={'yes': '#bbf7d0', 'no': '#fef08a'}, # Match your ECharts colors
        linewidth=2,
        fliersize=5 # Size of the outlier dots
    )

    # Formatting
    plt.ylabel('Relative Frequency (Percent)')
    plt.xlabel('')
    plt.xticks(rotation=45)
    plt.legend(title='Response')
    plt.grid(axis='y', linestyle='--', alpha=0.7)

    plt.tight_layout()

    return fig

if __name__ == "__main__":
    init_db() # init schema in case it doesn't exist, and load data from CSV

    if 'server' in sys.argv:
        import uvicorn
        uvicorn.run(app, host="0.0.0.0", port=8000)
    else:
        import matplotlib.pyplot as plt
        from matplotlib.patches import Patch
        import seaborn as sns
        import numpy as np

        outdir = 'output/'
        os.makedirs(outdir, exist_ok=True)

        # PART 2: Display Table Overview
        # TODO: save entire table to file?
        overview = get_overview_summary(0, 1000)
        overview[['relative_freq']] = overview[['relative_freq']] * 100 # convert to percentage
        
        summarytablepath = outdir + '/part2_summary_table.csv'

        # write the summary table out to disk as csv
        overview.rename(columns={ # rename to match format requested
            'relative_freq': 'percentage',
            'total': 'total_count',
            'sample_id': 'sample',
            'cell_type': 'population',
            # reorder to match desired format as well
            }).loc[:, ['sample', 'total_count', 'population', 'count', 'percentage']
            ].to_csv(summarytablepath)
        
        print("[PART 2] successfully wrote summary table to " + summarytablepath)



        # PART 3: Statistical Analysis of cell frequencies
        # stats = get_statistics('melanoma', 'miraclib', 'PBMC')
        constraint = {'condition':'melanoma', 
                      'treatment':'miraclib',
                      'sample_type':'PBMC',
                      'time_from_treatment_start': 0}
        treatment_data = query('sample_id', 'response', 'cell_type', 'count', 'total', constraint=constraint)
        treatment_data['percentage'] = treatment_data['count'] / treatment_data['total'] * 100
        # cell_type_pops = treatment_data.pivot(index='sample_id', columns='cell_type', values=['percentage', 'response'])
        # cell_type_pops['percentage'] = cell_type_pops['count'] / cell_type_pops['total'] * 100
        # print(cell_type_pops)
        # boxplot = cell_type_pops.boxplot()
        # boxplot = treatment_data.boxplot(column='count', by=['cell_type', 'response'], rot=45)
        boxplotfig = boxplot(treatment_data)
        plt.suptitle('')
        plt.title(f'Cell Frequency in {constraint['condition']} Patients Treated with {constraint['treatment']}')

        # plot the baseline responder vs non-responder cell population distributions
        boxplotpath = outdir + '/part3_boxplot.pdf'
        boxplotfig.savefig(boxplotpath, bbox_inches='tight')
        print('[PART 3] successfully saved cell population boxplots to ', boxplotpath)
        # TODO: report significant differences?



        # PART 4: Subsetting the dataset and analyzing breakdown
        subset_samples = query('sample_id', 'project_id', 'response', 'sex', constraint=constraint, join_cell_counts=False)
        
        subsetsamplepath = outdir + f'/part4_melanoma_miraclib_PBMC_baseline_sample_info.csv'
        
        subset_samples.to_csv(subsetsamplepath)
        print("[PART 4] successfully wrote subset sample list to " + subsetsamplepath)

        subset_info = get_subset_info(**constraint)

        subset_breakdown_table_path = outdir + '/part4_subset_info.csv'

        breakdown = pd.DataFrame()
        
        # gather the samples split by sex, response, or project_id to see how the total breaks down
        breakdown = pd.concat([breakdown, subset_info.groupby('sex')[['n_samples']].sum()])
        breakdown = pd.concat([breakdown, subset_info.groupby('response')[['n_samples']].sum()])
        breakdown = pd.concat([breakdown, subset_info.groupby('project_id')[['n_samples']].sum()])
        breakdown['percentage'] = breakdown['n_samples']/subset_info['n_samples'].sum() * 100
        
        breakdown = pd.DataFrame(breakdown.__array__(), pd.MultiIndex.from_tuples([
                ('sex', 'Male'),        
                ('sex', 'Female'),
                ('response', 'Resonder'),
                ('response', 'Non-responder'),
                ('Project', '1'),
                ('Project', '3')
            ], names=["split by", "portion"])).rename(columns={0:'n_samples', 1:'percentage'})
        
        breakdown.to_csv(subset_breakdown_table_path)
        
        print('[PART 4] successfully wrote project, sex, and responder status sample counts to', subset_breakdown_table_path)

        print('PARTS 1-4 COMPLETE')