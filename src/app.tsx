
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

const App = () => {
    const [data, setData] = useState<AnalysisData[]>([]);
    const [startSample, setStartSample] = useState(1);
    const [numSamples, setNumSamples] = useState(50); // Fetch more samples at a time for smoother scrolling
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('overview');
    const [chartVisible, setChartVisible] = useState(true);
    const [tableVisible, setTableVisible] = useState(true);
    const [showDistPlot, setShowDistPlot] = useState(true);
    const [showDataPoints, setShowDataPoints] = useState(true);
    const [dataType, setDataType] = useState<'percentage' | 'raw'>('percentage');
    const tableContainerRef = useRef<HTMLDivElement>(null);
    const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 });

    useEffect(() => {
        if (!hasMore || loading) return;

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

                if (transformedData.length === 0) {
                    setHasMore(false);
                } else {
                    setData(prevData => [...prevData, ...transformedData]);
                    setStartSample(prev => prev + numSamples);
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

        fetchData();
    }, [startSample, numSamples, hasMore, loading]);

    const handleScroll = () => {
        if (!tableContainerRef.current) return;

        const { scrollTop, scrollHeight, clientHeight } = tableContainerRef.current;
        const rowHeight = 50; // Approximate height of a row
        const start = Math.floor(scrollTop / rowHeight);
        const end = Math.min(data.length, Math.ceil((scrollTop + clientHeight) / rowHeight));
        setVisibleRange({ start, end });

        if (scrollHeight - scrollTop - clientHeight < 200 && hasMore && !loading) {
            setLoading(true);
            setStartSample(prev => prev + numSamples);
        }
    };


    const getPieChartData = () => {
        const populationData = data.reduce((acc, row) => {
            if (!acc[row.population]) {
                acc[row.population] = { totalPercentage: 0, count: 0 };
            }
            acc[row.population].totalPercentage += row.percentage;
            acc[row.population].count++;
            return acc;
        }, {} as Record<string, { totalPercentage: number, count: number }>);

        return Object.keys(populationData).map(population => ({
            x: population,
            y: populationData[population].totalPercentage / populationData[population].count,
        }));
    };

    const getDistPlotData = () => {
        const populationData = data.reduce((acc, row) => {
            if (!acc[row.population]) {
                acc[row.population] = [];
            }
            acc[row.population].push(dataType === 'percentage' ? row.percentage : row.count);
            return acc;
        }, {} as Record<string, number[]>);

        return Object.keys(populationData).map(population => {
            const values = populationData[population];
            const min = Math.min(...values);
            const max = Math.max(...values);
            const points = [];
            for (let i = min; i <= max; i += (max - min) / 20) {
                points.push({
                    x: i,
                    y: values.filter(v => v >= i && v < i + (max - min) / 20).length
                });
            }
            return { population, data: points };
        });
    };

    const getScatterData = () => {
        return data.map(d => ({
            x: d.population,
            y: dataType === 'percentage' ? d.percentage : d.count
        }));
    };

    const getStackedBarData = () => {
        const sampleData = data.reduce((acc, row) => {
            if (!acc[row.sample]) {
                acc[row.sample] = { name: `Sample ${row.sample}` };
            }
            acc[row.sample][row.population] = row.percentage;
            return acc;
        }, {} as Record<string, any>);

        return Object.values(sampleData);
    };

    const handleCheckboxChange = (type: 'dist' | 'points') => {
        if (type === 'dist') {
            setShowDistPlot(!showDistPlot);
        } else {
            setShowDataPoints(!showDataPoints);
        }
    };

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF'];
    const populations = Array.from(new Set(data.map(item => item.population)));


    const renderTabContent = () => {
        const pieData = getPieChartData();
        const distData = getDistPlotData();
        const scatterData = getScatterData();
        const stackedBarData = getStackedBarData();

        const visibleRows = data.slice(visibleRange.start, visibleRange.end);
        const paddingTop = visibleRange.start * 50;
        const paddingBottom = (data.length - visibleRange.end) * 50;

        return (
            <>
                {error && <p className="error-message">{error}</p>}
                <div>
                    <h1>Population Frequency Overview</h1>
                </div>

                <div className="collapsible-section">
                    <div className="collapsible-header" onClick={() => setChartVisible(!chartVisible)}>
                        <span className={`collapsible-icon ${chartVisible ? 'open' : ''}`}>&#9656;</span>
                        <h3>Graphics</h3>
                    </div>
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
                     <div className="chart-options">
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
                </div>

                <div className="collapsible-section">
                    <div className="collapsible-header" onClick={() => setTableVisible(!tableVisible)}>
                        <span className={`collapsible-icon ${tableVisible ? 'open' : ''}`}>&#9656;</span>
                        <h3>Data</h3>
                    </div>
                    {tableVisible && (
                        <div className="table-container" ref={tableContainerRef} onScroll={handleScroll}>
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
                                <tbody style={{ paddingTop, paddingBottom }}>
                                    {visibleRows.map((row, index) => (
                                        <tr key={visibleRange.start + index} className="table-row">
                                            <td className="table-entry">{row.sample}</td>
                                            <td className="table-entry">{row.total_count}</td>
                                            <td className="table-entry">{row.population}</td>
                                            <td className="table-entry">{row.count}</td>
                                            <td className="table-entry">{row.percentage.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {loading && <p>Loading more data...</p>}
                            {!hasMore && <p>No more data to load.</p>}
                        </div>
                    )}
                </div>
            </>
        );
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

export default App;
