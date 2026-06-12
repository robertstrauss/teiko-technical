#!/usr/bin/env python3

import sqlite3
import pandas as pd

conn = sqlite3.connect('cytometry.db')
df = pd.read_sql_query(f'''
        SELECT
            c.cell_type,
            c.count,
            p.condition,
            p.sex,
            samples.sample_type
        FROM samples
        JOIN cell_counts c ON c.sample_id = samples.sample_id
        JOIN subjects p ON p.subject_id = samples.subject_id
        WHERE
            p.condition = 'melanoma'
            AND p.sex = 'M'
            AND samples.time_from_treatment_start = 0
            AND c.cell_type = 'b_cell'
        ''', conn)

print(df)

print('Avg. B Cells of Male Melanoma patient at Baseline (PBMC only):', df[df['sample_type'] == 'PBMC']['count'].mean())
print('Avg. B Cells of Male Melanoma patient at Baseline (All samples):', df['count'].mean())
