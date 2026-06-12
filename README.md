# Teiko Teknikal Trial
### Robert R. Strauss

## Contents

1. [Quickstart](#quickstart)
2. [The Schema](#the-schema)
3. [Code Structure](#code-structure)


## Quickstart

REQUIRES: Python 3.11+

It is reccomended to use a fresh environment with the latest version of Python 3.

Install Python and React dependencies:
```sh
make setup
```

Pipeline (create all outputs in `./outputs/`, no server or dashboard):
```sh
make pipeline
```

Interactive dashboard:
```sh
make dashboard
```
Navigate to `localhost:3000` in a browser if running locally, or the appropriate address to access port 3000 if on GitHub codespaces.



## The Schema

The database is split into `samples`, `subjects`, and `cell_counts` tables, for database stability and integrity as well as ease of use.
Most notably, the structure is not wide like that of the provided `.csv` file: there are not individual collumns for each cell type with count. Instead, in the `cell_counts` table there are multiple rows for each sample `sample_id` with a `cell_type` collumn specifying the population counted by the `count` collumn. Though this somewhat increases redundancy by repeating the same cell phenotype options and sample_ids, it makes the database more stable and flexible. If later projects were added which measured different markers, the schema would not have to be altered to add on extra collumns for new cell types or other markers. This also makes it convenient to compute the relative frequency of cell types by summing all values of `count` with a matching `sample_id`, withut having to store a hard-coded list of collumns to sum over, which would also be brittle if different markers were considered as mentioned above.

The seperation of the subjects table elliminates redundancy by reporting subject-specific information only once, since the same subject can be used in multiple samples. This can easily be found and correlated to variables of interest with the `subject_id` kept in the `samples` table, and from the `cell_counts` table through the `sample_id` used to look up the sample and then similarly use the `subject_id` to get patient information. This also makes the database convenient for use: adding new patient information or altering patient information after a diagnosis is easily done without sifting through cytometry data. This could also be used for precise access control, with some actors only able to read/write one of these tables.

The `samples` table contains the following collumns:
* sample_id
* project_id
* time_from_treatment_start
* sample_type

The `subjects` table contains the following collumns:
* subject_id (correlated with samples.subject_id)
* condition
* age
* sex
* treatment
* response

The `cell_counts` table contains cytometry data through the following collumns:
* id
* sample_id (correlated with samples.sample_id)
* cell_type
* count


## Code Structure

There are two primary components: the database server `load_data.py` and the React app in `src/`

`load_data.py` implements Part 1, loading and initializing the database. It includes methods to query the database in ways useful for the analysis tasks requested. It also includes a more universal sanitized querying tool for investigating the database in more flexible ways not specifically described, which may be critical for discovery of patterns that lead to a hypothesis. It can serve either as the pipeline producing the specific data and visuals requested in Parts 1-4 of the assignment via `./load_data.py` (no arguments), or a backend server for accessing the database through the React interactive dashboard via `./load_data.py server` (not neceessary if using `make dashboard`, which already initializes this).

The React entry point is `src/index.tsx` which just points to `src/app.tsx`, which includes the basic page layout for selecting what analysis to look at, and the content area for displaying tables and figures. Part 2 is implemented with `src/FreqOverview.tsx`, which fetches from the database server as an API and renders the requested table with pagination (to not overload the browser or network, since the database may be very large). Part 3 is achieved in `src/TreatmentStats.tsx` where statistics on the cell type populations for responders and non-responders is fetched through the API (the python backend) and rendered as box plots. Again due to database size, we compute the statistics on the backend to not overload the network or browser. Part 4 is implemented in `src/SubsetAnalysis.tsx` which queries the backend for the condition-, treatment-, baseline-, and sample type-constrained dataa on how the samples break down among the properties specified (project, sex, and responder status). This is computed on the backend to prevent pushing large amounts of data over the network or filling up memmory and crashing the browser. These stats are rendered in numerous useful or informative ways: tables showing the number of samples belonging to each  combination of project, sex, and response, and pie charts aggregating the samples on other dimensions to show the total split in the constrained set of samples, and a sankey diagram visualizing male and female response or non-response correlations and project membership. 



