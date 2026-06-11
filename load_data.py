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


# define allowed columns for querying to prevent SQL injection and ensure only valid queries are made
allowed_cols_samples = ['sample_id', 'project_id', 'subject_id', 'time_from_treatment_start', 'sample_type']
allowed_cols_subjects = ['subject_id', 'condition', 'age', 'sex', 'treatment', 'response']
allowed_cols_cell_counts = ['sample_id', 'cell_type', 'count']

def table_prefix(colname):
    if colname in allowed_cols_cell_counts: return 'c'
    elif colname in allowed_cols_subjects: return 'p'
    elif colname in allowed_cols_samples: return 's'

# Most abstract injection-safe query, access to fields from all tables
@app.get(f"/query/")
def query(*fields, constraint, sort='sample_id', offset: int = 0, limit: int = 100):
    if limit > 1000:
        limit = 1000 # cap n to prevent overload, can implement pagination on frontend if more data is needed

    # build SQL query based on provided query parameters, checking field is allowed to prevent injection and ensure valid queries
    conn = sqlite3.connect(DB)
    params = (*fields,
                *sum(zip(
                    list([table_prefix(k)+'.'+k for k in constraint.keys()]),
                    constraint.values()),
                    ()), # zip then flatten, for pair wise inserting (... ? = ? AND ? = ? ...) <=> [..., table.col, value, table.col2, value2, ...]
                sort,
                limit,
                offset)
    df = pd.read_sql_query(f"""SELECT {", ".join(["?"]*len(fields))} FROM samples s
                JOIN subjects p ON p.subject_id = s.subject_id
                JOIN cell_counts c ON c.sample_id = s.sample_id
                WHERE {" AND ".join(["? = ?"]*len(constraint))}
                ORDER BY ?
                LIMIT ?
                OFFSET ?
        """, conn, params=params)

    conn.close()

    return df.to_dict(orient='list')



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




def box_plot(stats, title, save_path):
    # Extract unique categories (cell types) and calculate X positions
    cell_types = sorted(list(set(stats['cell_type'])))
    x_positions = np.arange(len(cell_types))
    
    width = 0.35
    offset = width / 2

    # Helper function to format data dictionaries for matplotlib's bxp engine
    def format_bxp_data(response):
        boxdata = []
        cohort_indices = np.where(np.equal(stats['response'], response))[0]
        
        for idx in cohort_indices:
            boxdata.append({
                'label': stats['cell_type'][idx],
                'med': stats['median'][idx],
                'q1': stats['q1'][idx],
                'q3': stats['q3'][idx],
                'whislo': stats['adj_min'][idx],
                'whishi': stats['adj_max'][idx],
                'fliers': stats['outliers'][idx] # bxp automatically plots these as scatter dots
            })
        return boxdata

    fig, ax = plt.subplots(figsize=(10, 6))

    # 5. Draw Responders (Shifted Left)
    ax.bxp(format_bxp_data(response='yes'), 
           positions=x_positions - offset, 
           widths=width,
           patch_artist=True, 
           boxprops=dict(facecolor='#bbf7d0', edgecolor='#22c55e', linewidth=2),
           medianprops=dict(color='#22c55e'),
           flierprops=dict(marker='o', markerfacecolor='#16a34a', markeredgecolor='none'))

    # 6. Draw Non-Responders (Shifted Right)
    ax.bxp(format_bxp_data(response='no'), 
           positions=x_positions + offset, 
           widths=width,
           patch_artist=True, 
           boxprops=dict(facecolor='#fef08a', edgecolor='#eab308', linewidth=2),
           medianprops=dict(color='#eab308'),
           flierprops=dict(marker='o', markerfacecolor='#ca8a04', markeredgecolor='none'))

    # 7. Aesthetics & Formatting
    ax.set_title(title)
    ax.set_ylabel('Relative Frequency')
    
    # Fix X-axis ticks to center between the grouped boxes
    ax.set_xticks(x_positions)
    ax.set_xticklabels(cell_types, rotation=45, ha='right')
    
    # Hide vertical grid lines, keep horizontal
    ax.grid(axis='y', linestyle='--', alpha=0.7)
    ax.grid(axis='x', visible=False)

    # 8. Legend
    legend_elements = [
        Patch(facecolor='#bbf7d0', edgecolor='#22c55e', linewidth=2, label='Responder'),
        Patch(facecolor='#fef08a', edgecolor='#eab308', linewidth=2, label='Non-Responder')
    ]
    ax.legend(handles=legend_elements, loc='lower right')

    plt.tight_layout() # Ensures rotated labels aren't cut off

    # Either save for the CLI pipeline or show for local debugging
    if save_path:
        plt.savefig(save_path, dpi=300, bbox_inches='tight')
        print(f"Plot saved to {save_path}")
    else:
        plt.show()
    
    plt.close()


if __name__ == "__main__":
    init_db() # init schema in case it doesn't exist, and load data from CSV

    if 'server' in sys.argv:
        import uvicorn
        uvicorn.run(app, host="0.0.0.0", port=8000)
    else:
        import matplotlib.pyplot as plt
        from matplotlib.patches import Patch
        import numpy as np

        outdir = 'output/'
        os.makedirs(outdir, exist_ok=True)

        print("Part 2...")
        # PART 2: Display Table Overview
        # TODO: save entire table to file?
        overview = get_overview(0, 100)
        summarytablepath = outdir + '/part2_summary_table.txt'
        with open(summarytablepath, 'w') as outfile:
            outfile.write('\t'.join(overview.keys()) + '\n')
            for i in range(len(overview['cell_type'])):
                outfile.write('\t'.join([str(overview[col][i]) for col in overview.keys()]) + '\n')
        print("successfully wrote summary table to " + summarytablepath)
        print("Part 2 successful")

        print("Part 3...")
        # PART 3: Statistical Analysis of cell frequencies
        stats = get_statistics('melanoma', 'miraclib', 'PBMC')

        boxplotpath = outdir + '/part3_boxplot.pdf'
        # plot the baseline responder vs non-responder cell population distributions
        baseline_indices = np.where(np.equal(stats['time_from_treatment_start'], 0))[0]
        baseline_stats = {
            key: [stats[key][i] for i in baseline_indices] for key in stats
        }
        box_plot(baseline_stats, "Cell Type Frequencies at Baseline", boxplotpath)
        # TODO: report significant differences?
        print("Part 3 successful")


        print("Part 4...")
        constraint = {'condition':'melanoma', 
                      'treatment':'miraclib',
                      'sample_type':'PBMC',
                      'time_from_treatment_start': 0}
        subset_samples = query('sample_id', constraint=constraint)
        subsetsamplepath = outdir + '/part4_subset_sample_ids.txt'
        with open(subsetsamplepath, 'w') as outfile:
            outfile.write('\n'.join(subset_samples))
        print("successfully wrote summary table to " + subsetsamplepath)

        subset_splits = get_subset(**constraint)
        def getTotal(filter): # helper to get totals of the different slices of the samples
            total = 0
            def matches(i):
                for key in filter.keys():
                    if subset_splits[key][i] != filter[key]: return False
                return True

            for i in range(len(subset_splits['n_samples'])):
                if matches(i):
                    total += subset_splits['n_samples'][i]
            return total
        

        subsettablepath = outdir + '/part4_subset_table.txt'
        with open(subsettablepath, 'w') as outfile:
            for project_id in sorted(list(set(subset_splits['project_id']))):
                outfile.write('Project: ' + project_id + '\n')
                outfile.write(f'''Num. Samples:\tResponse\tNo Response\tTotal
Male\t{getTotal({'project_id': project_id, 'sex': 'M', 'response': 'yes'})}\t{getTotal({'project_id': project_id, 'sex': 'M', 'response': 'no'})}\t{getTotal({'project_id': project_id, 'sex': 'M'})}
Female\t{getTotal({'project_id': project_id, 'sex': 'F', 'response': 'yes'})}\t{getTotal({'project_id': project_id, 'sex': 'F', 'response': 'no'})}\t{getTotal({'project_id': project_id, 'sex': 'F'})}
Total\t{getTotal({'project_id': project_id, 'response': 'yes'})}\t{getTotal({'project_id': project_id, 'response': 'no'})}\t{getTotal({'project_id': project_id})}
    
''')
        print('successfully wrote to', subsettablepath)
        # PART 4: Subsetting the dataset and analyzing breakdown
        print("Part 4 successful")
