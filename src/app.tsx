
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, ZAxis, BarChart, Bar } from 'recharts';

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
    const [numSamples, setNumSamples] = useState(5);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('overview');
    const [chartVisible, setChartVisible] = useState(true);
    const [tableVisible, setTableVisible] = useState(true);
    const [showDistPlot, setShowDistPlot] = useState(true);
    const [showDataPoints, setShowDataPoints] = useState(true);
    const [dataType, setDataType] = useState<'percentage' | 'raw'>('percentage');

    useEffect(() => {
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
    }, [startSample, numSamples]);

    const handlePrev = () => {
        setStartSample(prev => Math.max(1, prev - numSamples));
    };

    const handleNext = () => {
        setStartSample(prev => prev + numSamples);
    };

    const handleNumSamplesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(e.target.value, 10);
        if (!isNaN(value) && value > 0) {
            setNumSamples(value);
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
            name: population,
            value: populationData[population].totalPercentage / populationData[population].count,
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
            const values = populationData[population].sort((a, b) => a - b);
            const q1 = values[Math.floor(values.length / 4)];
            const median = values[Math.floor(values.length / 2)];
            const q3 = values[Math.floor((values.length * 3) / 4)];
            return { name: population, median, q1, q3 };
        });
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
            if (!showDistPlot && !showDataPoints) {
                setShowDataPoints(false);
            }
            setShowDistPlot(!showDistPlot);
        } else {
            if (!showDataPoints && !showDistPlot) {
                setShowDistPlot(false);
            }
            setShowDataPoints(!showDataPoints);
        }
    };

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF'];
    const populations = Array.from(new Set(data.map(item => item.population)));


    const renderTabContent = () => {
        switch (activeTab) {
            case 'overview':
                return (
                    <>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px', gap: '15px' }}>
                            <label htmlFor="numSamples">Number of samples to summarize:</label>
                            <input
                                id="numSamples"
                                type="number"
                                value={numSamples}
                                onChange={handleNumSamplesChange}
                                style={{ width: '60px', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
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

                        {loading && <p>Loading...</p>}
                        {error && <p style={{ color: 'red' }}>{error}</p>}

                        {!loading && !error && (
                            <>
                                <div style={{ marginBottom: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', padding: '10px', cursor: 'pointer', backgroundColor: '#f7f7f7' }} onClick={() => setChartVisible(!chartVisible)}>
                                        <span style={{ marginRight: '10px', transform: chartVisible ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>&#9656;</span>
                                        <h3>Graphics</h3>
                                    </div>
                                    {chartVisible && (
                                        <div style={{ display: 'flex', height: 400, overflowX: 'auto' }}>
                                            <ResponsiveContainer width="33%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={getPieChartData()}
                                                        cx="50%"
                                                        cy="50%"
                                                        labelLine={false}
                                                        outerRadius={150}
                                                        fill="#8884d8"
                                                        dataKey="value"
                                                        nameKey="name"
                                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(2)}%`}
                                                    >
                                                        {getPieChartData().map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip formatter={(value: number) => `${value.toFixed(2)}%`} />
                                                    <Legend />
                                                </PieChart>
                                            </ResponsiveContainer>
                                            <ResponsiveContainer width="33%" height="100%">
                                                <BarChart data={getDistPlotData()}>
                                                    <CartesianGrid />
                                                    <XAxis dataKey="name" />
                                                    <YAxis />
                                                    <Tooltip />
                                                    <Legend />
                                                    {showDistPlot && <Bar dataKey="median" fill="#8884d8" />}
                                                    {showDataPoints && (
                                                        <Scatter data={data.map(d => ({ name: d.population, value: dataType === 'percentage' ? d.percentage : d.count }))} fill="red" shape="cross" />
                                                    )}
                                                </BarChart>
                                            </ResponsiveContainer>
                                            <ResponsiveContainer width="33%" height="100%">
                                                <BarChart data={getStackedBarData()} layout="vertical">
                                                    <CartesianGrid />
                                                    <XAxis type="number" />
                                                    <YAxis type="category" dataKey="name" />
                                                    <Tooltip />
                                                    <Legend />
                                                    {populations.map((pop, i) => (
                                                        <Bar key={pop} dataKey={pop} stackId="a" fill={COLORS[i % COLORS.length]} />
                                                    ))}
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    )}
                                     <div style={{ padding: '10px', display: 'flex', gap: '20px' }}>
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

                                <div style={{ border: '1px solid #ddd', borderRadius: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', padding: '10px', cursor: 'pointer', backgroundColor: '#f7f7f7' }} onClick={() => setTableVisible(!tableVisible)}>
                                        <span style={{ marginRight: '10px', transform: tableVisible ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>&#9656;</span>
                                        <h3>Data</h3>
                                    </div>
                                    {tableVisible && (
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr style={{ backgroundColor: '#f2f2f2' }}>
                                                    <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left' }}>Sample</th>
                                                    <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left' }}>Total Count</th>
                                                    <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left' }}>Population</th>
                                                    <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left' }}>Count</th>
                                                    <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left' }}>Percentage</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {data.map((row, index) => (
                                                    <tr key={index} style={{ borderBottom: '1px solid #ddd' }}>
                                                        <td style={{ padding: '12px', border: '1px solid #ddd' }}>{row.sample}</td>
                                                        <td style={{ padding: '12px', border: '1px solid #ddd' }}>{row.total_count}</td>
                                                        <td style={{ padding: '12px', border: '1px solid #ddd' }}>{row.population}</td>
                                                        <td style={{ padding: '12px', border: '1px solid #ddd' }}>{row.count}</td>
                                                        <td style={{ padding: '12px', border: '1px solid #ddd' }}>{row.percentage.toFixed(2)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </>
                        )}
                    </>
                );
            case 'statistics':
                return <h2>Treatment Statistics (Not Implemented)</h2>;
            case 'analysis':
                return <h2>Subset Analysis (Not Implemented)</h2>;
            default:
                return null;
        }
    };

    return (
        <div style={{ fontFamily: 'Arial, sans-serif', margin: '0 auto', maxWidth: '1200px', padding: '20px' }}>
            <header style={{
                position: 'sticky',
                top: 0,
                zIndex: 1,
                backgroundColor: '#007bff',
                color: 'white',
                padding: '10px 20px',
                borderRadius: '8px',
                marginBottom: '20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <h1>Interactive Dashboard</h1>
                <nav>
                    <button onClick={() => setActiveTab('overview')} style={{ background: activeTab === 'overview' ? '#0056b3' : 'transparent', color: 'white', border: 'none', padding: '10px 15px', cursor: 'pointer', borderRadius: '5px', marginRight: '10px' }}>
                        Population Frequency Overview
                    </button>
                    <button onClick={() => setActiveTab('statistics')} style={{ background: activeTab === 'statistics' ? '#0056b3' : 'transparent', color: 'white', border: 'none', padding: '10px 15px', cursor: 'pointer', borderRadius: '5px', marginRight: '10px' }}>
                        Treatment Statistics
                    </button>
                    <button onClick={() => setActiveTab('analysis')} style={{ background: activeTab === 'analysis' ? '#0056b3' : 'transparent', color: 'white', border: 'none', padding: '10px 15px', cursor: 'pointer', borderRadius: '5px' }}>
                        Subset Analysis
                    </button>
                </nav>
            </header>
            <main>
                {renderTabContent()}
            </main>
        </div>
    );
};

export default App;
