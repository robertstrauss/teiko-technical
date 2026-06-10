
import { useRef, useEffect, useState } from "react";


import axios from "axios";
import Plot from 'react-plotly.js';


interface TreatmentData {
    cell_type: string;
    response: 'yes' | 'no';
    time_from_treatment_start: number;
    adj_min: number;
    q1: number;
    median: number;
    q3: number;
    adj_max: number;
    outliers: number[];
}

const DATA_KEYS = ['cell_type', 'response', 'time_from_treatment_start', 'adj_min', 'q1', 'median', 'q3', 'adj_max', 'outliers'];

const CustomStats = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<TreatmentData[]>([]);
    const [possibleOptions, setPossibleOptions] = useState<{[key: string]: string[]}>({condition: [], treament: [], response: [], time_from_treatment_start: [], sample_type: [], project_id: []});
    const [query, setQuery] = useState<{[key: string]: string[]}>({});

    // setPossibleOptions({condition: [], treament: [], response: [], time_from_treatment_start: [], sample_type: [], project_id: []});

    useEffect(() => {
        if (loading) return;

        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const querystring = Object.entries(query).map(([col, vals]) => `${col}=${vals.join(',')}`).join('&')
                const response = await axios.get(`http://localhost:8000/analysis/treatment_statistics/?`);
                const rawData = response.data;
                // unpack list into records
                const transformedData: TreatmentData[] = rawData.cell_type.map((_: any, index: number) => (
                    Object.fromEntries(DATA_KEYS.map(key => [key, rawData[key][index]]))
                ));

                setData(transformedData);
            } catch (err) {
                if (axios.isAxiosError(err)) {
                    if (err.response) {
                        setError(`Error: ${err.response.status} ${err.response.statusText}`);
                    } else if (err.request) {
                        setError('Network Error: No response received from server.');
                    } else {
                        setError(`Error: ${err.message}`);
                    }
                } else {
                    setError('An unexpected error occurred.');
                }
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [query]);


    useEffect(() => {
        if (loading) return;

        const fetchEntries = async () => {
            setLoading(true);
            setError(null);
            try {

                for (let col in possibleOptions) {
                    axios.get(`http://localhost:8000/entry_values/?col=${col}`).then(response => {
                        if (response.data[col])
                        possibleOptions[col] = response.data[col];
                        setPossibleOptions(possibleOptions);
                    })
                }
            } catch (err) {
                if (axios.isAxiosError(err)) {
                    if (err.response) {
                        setError(`Error: ${err.response.status} ${err.response.statusText}`);
                    } else if (err.request) {
                        setError('Network Error: No response received from server.');
                    } else {
                        setError(`Error: ${err.message}`);
                    }
                } else {
                    setError('An unexpected error occurred.');
                }
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchEntries();
    }, []); // future: depend on dataset currently connected to



    return (<>
        {error && <p className="error-message">{error}</p>}
        <div className="header">
            <h1>Cell population statistics</h1>
        </div>
        <div className="section">
        <div className="options">
            Filter by:
            <table>
                <tr><td>Condition</td> <td> {possibleOptions.condition.map(opt => (<><input type="checkbox"/> {opt} &nbsp;</>))} </td></tr>
                <tr><td>Treatment</td> <td><select><option>miractrb</option></select></td></tr>
                <tr><td>Response</td> <td><input type="checkbox" checked/> yes &nbsp; <input type="checkbox" checked/> no</td></tr>
                <tr><td>Days from treatment</td> <td><input type="checkbox" checked/> 0 &nbsp; <input type="checkbox" checked/> 7 &nbsp;  <input type="checkbox" checked/> 14</td></tr>
                <tr><td>Sample types</td> <td><input type="checkbox" checked/> PBMC &nbsp; </td></tr>
                <tr><td>Projects</td> <td><input type="checkbox" checked/> 1 &nbsp; </td></tr>
            </table>
        </div>
        {['yes', 'no'].map(resp => (
            <div className="graphrow">
                <h3 style={{writingMode: 'sideways-lr', textAlign: 'center'}}>{resp == 'no' ? 'Non-' : ''}Responders</h3>
                {[0, 7, 14].map(tfts => {
                    const filteredData = data.filter(d => (d.response == resp && d.time_from_treatment_start == tfts));
                    return (
                    <div>
                        <Plot
                            data={[{
                                type: 'box',
                                name: `${tfts} days since treatment began`,
                                q1: filteredData.map(d => d.q1),
                                median: filteredData.map(d => d.median),
                                q3: filteredData.map(d => d.q3),
                                lowerfence: filteredData.map(d => d.adj_min),
                                upperfence: filteredData.map(d => d.adj_max),
                                x: filteredData.map(d => d.cell_type),
                                // y: filteredData.map(d => d.outliers).flat(),
                                // boxpoints: 'outliers',

                            } as any]}
                            layout={{
                                title: { text:`${tfts} days since treatment began` },
                                yaxis: { title: {text: 'Relative Frequency'} },
                                showlegend: false
                            }}
                            style={{ width: '100%', height: '500px' }}
                        />
                    </div>
                )})}
            </div>
        ))}
        </div>
    </>);
};

// const dataTool = () => {

//     const [table, setTable] = useState();


//     const handleTableChange = () => {

//     }

//     return (
//         <div className="tool">
//             <div>
//                 Get data on <select onChange={handleTableChange}>
//                         <option value={COLUMNS_SAMPLES}>Samples</option>
//                         <option value={COLUMNS_SUBJECTS}>Subjects</option>
//                         <option value={COLUMNS_CELLS}>Cell Counts</option>
//                     </select>: {renderFieldSelector}
//             </div>
//             {tableVisible && (
//                 <div className="table-container" ref={tableContainerRef} onScroll={handleScroll}>
//                     <table className="data-table">
//                         <thead>
//                             <tr>
//                                 <th className="table-header">Sample</th>
//                                 <th className="table-header">Total Count</th>
//                                 <th className="table-header">Population</th>
//                                 <th className="table-header">Count</th>
//                                 <th className="table-header">Percentage</th>
//                             </tr>
//                         </thead>
//                         <tbody style={{ paddingTop, paddingBottom }}>
//                             {visibleRows.map((row, index) => (
//                                 <tr key={visibleRange.start + index} className="table-row">
//                                     <td className="table-entry">{row.sample}</td>
//                                     <td className="table-entry">{row.total_count}</td>
//                                     <td className="table-entry">{row.population}</td>
//                                     <td className="table-entry">{row.count}</td>
//                                     <td className="table-entry">{row.percentage.toFixed(2)}</td>
//                                 </tr>
//                             ))}
//                         </tbody>
//                     </table>
//                     {loading && <p>Loading more data...</p>}
//                     {!hasMore && <p>No more data to load.</p>}
//                 </div>)
//             }
//         </div>
//     );
// }
 

export function FieldSelector(options: Array<string>) {
  const [selectedFields, setSelectedFields] = useState<string[]>(["React", "Python"]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Ref to detect clicks outside the dropdown to close it gracefully
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
        setSearchQuery(""); // Clear search when closing
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter out options that are already selected, then filter by search query
  const availableOptions = options
    .filter(option => !selectedFields.includes(option))
    .filter(option => option.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleRemoveField = (fieldToRemove: string) => {
    setSelectedFields(selectedFields.filter(field => field !== fieldToRemove));
  };

  const handleSelectField = (field: string) => {
    setSelectedFields([...selectedFields, field]);
    setIsDropdownOpen(false);
    setSearchQuery("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && availableOptions.length > 0) {
      handleSelectField(availableOptions[0]); // Selects the top filtered option
    }
  };

  return (
    <div style={{ display: 'inline-block', fontFamily: 'sans-serif' }}>
      
      {/* Main Container */}
      <div style={{ 
        display: 'flex', flexWrap: 'wrap', gap: '8px', 
        borderRadius: '4px',
        minHeight: '40px', alignItems: 'center'
      }}>
        
        {/* The Bubbles (Pills) */}
        {selectedFields.map(field => (
          <div key={field} style={{
            display: 'flex', alignItems: 'center', backgroundColor: '#e2e8f0', 
            padding: '4px 10px', borderRadius: '16px', fontSize: '14px'
          }}>
            {field}
            <button 
              onClick={() => handleRemoveField(field)}
              style={{ 
                background: 'none', border: 'none', marginLeft: '6px', 
                cursor: 'pointer', color: '#64748b', fontSize: '12px'
              }}
            >
              ✕
            </button>
          </div>
        ))}

        {/* The Plus Button & Dropdown Container */}
        <div style={{ position: 'relative' }} ref={dropdownRef}>
          <button 
            onClick={() => setIsDropdownOpen(true)}
            style={{
              background: '#3b82f6', color: 'white', border: 'none',
              borderRadius: '50%', width: '24px', height: '24px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            +
          </button>

          {/* The Dropdown Menu */}
          {isDropdownOpen && (
            <div style={{
              position: 'absolute', top: '30px', left: '0', zIndex: 10,
              background: 'white', border: '1px solid #ccc', borderRadius: '4px',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)', width: '200px',
              padding: '8px'
            }}>
              <input 
                type="text"
                autoFocus
                placeholder="Search fields..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{ 
                  width: '100%', padding: '6px', marginBottom: '8px', 
                  border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box'
                }}
              />
              <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                {availableOptions.length === 0 ? (
                  <div style={{ padding: '4px', color: '#666', fontSize: '14px' }}>No matches</div>
                ) : (
                  availableOptions.map(option => (
                    <div 
                      key={option} 
                      onClick={() => handleSelectField(option)}
                      style={{ 
                        padding: '6px 8px', cursor: 'pointer', fontSize: '14px',
                        borderRadius: '4px'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      {option}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}