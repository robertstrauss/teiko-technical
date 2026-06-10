
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { VictoryPie, VictoryChart, VictoryBar, VictoryScatter, VictoryArea, VictoryStack, VictoryLegend, VictoryTooltip, VictoryVoronoiContainer } from 'victory';
import './style.css';


interface AnalysisData {
    sample: string;
    total_count: number;
    population: string;
    count: number;
    percentage: number;
}

const COLUMNS_SAMPLES = ['sample_id', 'project_id', 'subject_id', 'time_from_treatment', 'sample_type'];
const COLUMNS_SUBJECTS = ['subject_id', 'condition', 'age', 'sex', 'treatment', 'response'];
const COLUMNS_CELLS = ['sample_id', 'cell_type', 'count'];


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
    


const App = () => {
    const [data, setData] = useState<AnalysisData[]>([]);
    const [startSample, setStartSample] = useState(0);
    const [numSamples, setNumSamples] = useState(50); // Fetch more samples at a time for smoother scrolling
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('overview');
    // const [chartVisible, setChartVisible] = useState(true);
    // const [tableVisible, setTableVisible] = useState(true);
    // const [showDistPlot, setShowDistPlot] = useState(true);
    // const [showDataPoints, setShowDataPoints] = useState(true);
    // const [dataType, setDataType] = useState<'percentage' | 'raw'>('percentage');
    const tableContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (loading) return;

        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await axios.get(`http://localhost:8000/analysis/frequency_overview/?start_sample_id=${startSample}&n_samples=${numSamples}`);
                const rawData = response.data;
                const transformedData: AnalysisData[] = rawData.cell_type.map((_: any, index: number) => ({
                    sample: rawData.sample_id[index],
                    total_count: rawData.total[index],
                    population: rawData.cell_type[index],
                    count: rawData.count[index],
                    percentage: (rawData.count[index] / rawData.total[index]) * 100,
                }));

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
    }, [startSample, numSamples, loading]);


    // const getPieChartData = () => {
    //     const populationData = data.reduce((acc, row) => {
    //         if (!acc[row.population]) {
    //             acc[row.population] = { totalPercentage: 0, count: 0 };
    //         }
    //         acc[row.population].totalPercentage += row.percentage;
    //         acc[row.population].count++;
    //         return acc;
    //     }, {} as Record<string, { totalPercentage: number, count: number }>);

    //     return Object.keys(populationData).map(population => ({
    //         x: population,
    //         y: populationData[population].totalPercentage / populationData[population].count,
    //     }));
    // };

    // const getDistPlotData = () => {
    //     const populationData = data.reduce((acc, row) => {
    //         if (!acc[row.population]) {
    //             acc[row.population] = [];
    //         }
    //         acc[row.population].push(dataType === 'percentage' ? row.percentage : row.count);
    //         return acc;
    //     }, {} as Record<string, number[]>);

    //     return Object.keys(populationData).map(population => {
    //         const values = populationData[population];
    //         const min = Math.min(...values);
    //         const max = Math.max(...values);
    //         const points = [];
    //         for (let i = min; i <= max; i += (max - min) / 20) {
    //             points.push({
    //                 x: i,
    //                 y: values.filter(v => v >= i && v < i + (max - min) / 20).length
    //             });
    //         }
    //         return { population, data: points };
    //     });
    // };

    // const getScatterData = () => {
    //     return data.map(d => ({
    //         x: d.population,
    //         y: dataType === 'percentage' ? d.percentage : d.count
    //     }));
    // };

    // const getStackedBarData = () => {
    //     const sampleData = data.reduce((acc, row) => {
    //         if (!acc[row.sample]) {
    //             acc[row.sample] = { name: `Sample ${row.sample}` };
    //         }
    //         acc[row.sample][row.population] = row.percentage;
    //         return acc;
    //     }, {} as Record<string, any>);

    //     return Object.values(sampleData);
    // };

    // const handleCheckboxChange = (type: 'dist' | 'points') => {
    //     if (type === 'dist') {
    //         setShowDistPlot(!showDistPlot);
    //     } else {
    //         setShowDataPoints(!showDataPoints);
    //     }
    // };

    const handlePrev = () => {
        setStartSample(prev => Math.max(1, prev - numSamples));
    };

    const handleNext = () => {
        setStartSample(prev => prev + numSamples);
    };

    const handleNumSamplesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(e.target.value, 10);
        if (!isNaN(value) && value > 0 && value <= 250) {
            setNumSamples(value);
        }
    };

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF'];
    const populations = Array.from(new Set(data.map(item => item.population)));

    const renderTabContent = () => {
        // const pieData = getPieChartData();
        // const distData = getDistPlotData();
        // const scatterData = getScatterData();
        // const stackedBarData = getStackedBarData();

        if (activeTab == 'overview') return (<>
                {error && <p className="error-message">{error}</p>}
                <div>
                    <h1>Population Frequency Overview</h1>
                </div>

                {/* <div className="collapsible-section"> */}
                    {/* <div className="collapsible-header" onClick={() => setChartVisible(!chartVisible)}>
                        <span className={`collapsible-icon ${chartVisible ? 'open' : ''}`}>&#9656;</span>
                        <h3>Graphics</h3>
                    </div> */}
                    {/* {chartVisible && (
                        <div className="chart-container">
                            <div style={{ width: '33%' }}>
                                <VictoryPie
                                    data={pieData}
                                    colorScale={COLORS}
                                    labels={({ datum }) => `${datum.x}: ${datum.y.toFixed(2)}%`}
                                    labelComponent={<VictoryTooltip/>}
                                />
                            </div>
                            <div style={{ width: '33%' }}>
                                <VictoryChart containerComponent={<VictoryVoronoiContainer/>}>
                                    {showDistPlot && distData.map((popData, index) => (
                                        <VictoryArea
                                            key={popData.population}
                                            data={popData.data}
                                            style={{ data: { fill: COLORS[index % COLORS.length], opacity: 0.5 } }}
                                        />
                                    ))}
                                    {showDataPoints && (
                                        <VictoryScatter
                                            data={scatterData}
                                            style={{ data: { fill: "red" } }}
                                            size={2}
                                        />
                                    )}
                                </VictoryChart>
                            </div>
                            <div style={{ width: '33%' }}>
                                <VictoryChart>
                                    <VictoryStack colorScale={COLORS}>
                                        {populations.map(pop => (
                                            <VictoryBar
                                                key={pop}
                                                data={stackedBarData}
                                                x="name"
                                                y={pop}
                                            />
                                        ))}
                                    </VictoryStack>
                                    <VictoryLegend
                                        x={125} y={10}
                                        orientation="horizontal"
                                        gutter={20}
                                        style={{ border: { stroke: "black" } }}
                                        data={populations.map((pop, i) => ({ name: pop, symbol: { fill: COLORS[i % COLORS.length] } }))}
                                    />
                                </VictoryChart>
                            </div>
                        </div>
                    )} */}
                    {/* <div className="chart-options">
                        <div>
                            <input type="checkbox" id="showDistPlot" checked={showDistPlot} onChange={() => handleCheckboxChange('dist')} />
                            <label htmlFor="showDistPlot">Show Distribution</label>
                        </div>
                        <div>
                            <input type="checkbox" id="showDataPoints" checked={showDataPoints} onChange={() => handleCheckboxChange('points')} />
                            <label htmlFor="showDataPoints">Show Data Points</label>
                        </div>
                        <div>
                            <label>
                                <input type="radio" value="percentage" checked={dataType === 'percentage'} onChange={() => setDataType('percentage')} />
                                Percentage
                            </label>
                            <label>
                                <input type="radio" value="raw" checked={dataType === 'raw'} onChange={() => setDataType('raw')} />
                                Raw Count
                            </label>
                        </div>
                    </div>
                </div> */}

                <div className="collapsible-section">
                    {/* <div className="collapsible-header" onClick={() => setTableVisible(!tableVisible)}>
                        <span className={`collapsible-icon ${tableVisible ? 'open' : ''}`}>&#9656;</span>
                        <h3>Data</h3>
                    </div> */}
                    {/* <div>
                        Get data on <select onInput={}>
                                <option value={COLUMNS_SAMPLES}>Samples</option>
                                <option value={COLUMNS_SUBJECTS}>Subjects</option>
                                <option value={COLUMNS_CELLS}>Cell Counts</option>
                            </select>: {FieldSelector()}
                    </div> */}
                    {(<div className="pagedtable">
                        <div className="table-paginator">
                            <label htmlFor="numSamples">Number of samples to summarize:</label>
                            <input
                                id="numSamples"
                                type="number"
                                value={numSamples}
                                onChange={handleNumSamplesChange}
                                style={{ width: '30px', padding: '5px', borderRadius: '4px', border: '1px solid #ccc' }}
                            />
                            <button onClick={handlePrev} style={{ padding: '8px 12px', borderRadius: '4px', border: 'none', background: '#007bff', color: 'white', cursor: 'pointer' }}>
                                &larr;
                            </button>
                            <span style={{ fontStyle: 'italic', color: '#555' }}>
                                Samples {String(startSample).padStart(4, '0')} - {String(startSample + numSamples - 1).padStart(4, '0')}
                            </span>
                            <button onClick={handleNext} style={{ padding: '8px 12px', borderRadius: '4px', border: 'none', background: '#007bff', color: 'white', cursor: 'pointer' }}>
                                &rarr;
                            </button>
                        </div>
                        <div className="table-container" ref={tableContainerRef}>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th className="table-header">Sample</th>
                                        <th className="table-header">Total Count</th>
                                        <th className="table-header">Population</th>
                                        <th className="table-header">Count</th>
                                        <th className="table-header">Percentage</th>
                                    </tr>
                                </thead>
                                <tbody >
                                    {data.map((row, index) => (
                                        <tr className="table-row">
                                            <td className="table-entry">{row.sample}</td>
                                            <td className="table-entry">{row.total_count}</td>
                                            <td className="table-entry">{row.population}</td>
                                            <td className="table-entry">{row.count}</td>
                                            <td className="table-entry">{row.percentage.toFixed(2)}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>)}
                </div>
            </>
        );
    if (activeTab == 'statistics') return (<>

    </>);
    if (activeTab == 'analysis') return (<>
    
    </>);
    };

    return (
        <div className="root">
            <div className="sidebar">
                <h1>Teiko Trial</h1>
                <nav>
                    <button onClick={() => setActiveTab('overview')} className={`nav-button ${activeTab === 'overview' ? 'active' : ''}`}>
                        Population Frequency Overview
                    </button>
                    <button onClick={() => setActiveTab('statistics')} className={`nav-button ${activeTab === 'statistics' ? 'active' : ''}`}>
                        Treatment Statistics
                    </button>
                    <button onClick={() => setActiveTab('analysis')} className={`nav-button ${activeTab === 'analysis' ? 'active' : ''}`}>
                        Subset Analysis
                    </button>
                </nav>
            </div>
            <main>
                {renderTabContent()}
            </main>
        </div>
    );
};


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

export default App;
