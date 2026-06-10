import { useRef, useEffect, useState } from "react";
import axios from "axios";

// format of the incoming JSON from the python/SQL API containing relative cell population data
interface FrequencyData {
    sample_id: string;
    total: number;
    cell_type: string;
    count: number;
    relative_freq: number;
}

const DATA_KEYS = ['sample_id', 'total', 'cell_type', 'count', 'relative_freq'];

const FreqOverview = () => {
    const [data, setData] = useState<FrequencyData[]>([]);
    const [startSample, setStartSample] = useState(0);
    const [numSamples, setNumSamples] = useState(50); // Fetch more samples at a time for smoother scrolling
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const tableContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (loading) return;

        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await axios.get(`http://localhost:8000/analysis/frequency_overview/?start_sample_id=${startSample}&n_samples=${numSamples}`);
                const rawData = response.data;
                // unpack list into records
                const transformedData: FrequencyData[] = rawData.cell_type.map((_: any, index: number) => (
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
    }, [startSample, numSamples, loading]);



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

    return (<>
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
                                            <td className="table-entry">{row.sample_id}</td>
                                            <td className="table-entry">{row.total}</td>
                                            <td className="table-entry">{row.cell_type}</td>
                                            <td className="table-entry">{row.count}</td>
                                            <td className="table-entry">{(row.relative_freq*100).toFixed(2)}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>)}
                </div>
            </>
        );
}

export default FreqOverview;