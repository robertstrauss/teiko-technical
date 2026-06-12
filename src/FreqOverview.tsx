import { useRef, useEffect, useState } from "react";
import axios from "axios";
import ReactECharts from 'echarts-for-react';
import { TreatmentBoxStats, getBoxPlotOptions, BOX_STATS } from "./TreatmentStats";

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
    const [offset, setoffset] = useState(0);
    const [limit, setlimit] = useState(50); // Fetch more samples at a time for smoother scrolling
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [cellTypes, setCellTypes] = useState<string[]>([]);
    // const [cellMeanFreqs, setCMF] = useState<{[key:string]: number}>({});
    const [cellFreqData, setCellFreqData] = useState<TreatmentBoxStats[]>([]);
    const tableContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (loading) return;

        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await axios.get(`/analysis/frequency_overview/?offset=${offset}&limit=${limit}`);
                const rawData = response.data;
                // unpack list into records ( {col: [val1, val2, ...]} -> [{col: val1}, {col: val2}, ...] )
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
    }, [offset, limit]);

    useEffect(() => {
        if (cellFreqData && Object.entries(cellFreqData).length > 0) return;
        const fetchData = async () => {
            setError(null);
            try {
                for (let ct of cellTypes) {
                    const response = await axios.get(`/analysis/treatment_statistics/?condition=*&treatment=*&sample_type=*`);
                    const rawData = response.data;
                    if (rawData && rawData.cell_type) {
                        const transformedData: TreatmentBoxStats[] = rawData.cell_type.map((_: any, index: number) => (
                            Object.fromEntries(BOX_STATS.map(key => [key, rawData[key][index]]))
                        ));

                        setCellFreqData(transformedData);
                    }
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
            }
        };

        fetchData();
    }, [cellTypes]);

    // useEffect(() => {
    //     if (cellMeanFreqs && Object.entries(cellMeanFreqs).length > 0) return;
    //     const fetchData = async () => {
    //         setError(null);
    //         try {
    //             console.log("CELL TYPES", cellTypes);
    //             for (let ct of cellTypes) {
    //                 const response = await axios.get(`/analysis/column_mean/?col=relative_freq&cell_type=${ct}`);
    //                 const rawData = response.data;
    //                 if (!isNaN(rawData)) {
    //                     cellMeanFreqs[ct] = rawData;
    //                     setCMF(cellMeanFreqs)
    //                 }
    //             }
    //         } catch (err) {
    //             if (axios.isAxiosError(err)) {
    //                 if (err.response) {
    //                     setError(`Error: ${err.response.status} ${err.response.statusText}`);
    //                 } else if (err.request) {
    //                     setError('Network Error: No response received from server.');
    //                 } else {
    //                     setError(`Error: ${err.message}`);
    //                 }
    //             } else {
    //                 setError('An unexpected error occurred.');
    //             }
    //             console.error(err);
    //         }
    //     };

    //     fetchData();
    // }, [cellTypes]);

    // fetch cell types
    useEffect(() => {
        if (cellTypes && cellTypes.length > 0) return;
        (async () => {
            try {
                const response = await axios.get(`/possible_values/?col=cell_type`);
                const rawData = response.data;
                if (rawData && Object.values(rawData) && Object.values(rawData).length > 0) {
                    setCellTypes(Object.values(rawData));
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
            }
        })();
    });


    const handlePrev = () => {
        setoffset(prev => Math.max(1, prev - limit));
    };

    const handleNext = () => {
        setoffset(prev => prev + limit);
    };

    const handlelimitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(e.target.value, 10);
        if (!isNaN(value) && value > 0 && value <= 250) {
            setlimit(value);
        }
    };

    const handleOffsetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(e.target.value, 10);
        if (!isNaN(value) && value >= 0) {
            setoffset(value);
        }
    }

    const pieOptions = {
        tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
        legend: { orient: 'vertical', left: 'left' },
        series: [
            {
                type: 'pie',
                radius: '60%',
                label: {
                    position: 'inside',
                    formatter: '{b}\n{c}\n{d}%'
                },
                emphasis: {
                    itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' }
                }
            }
        ]
    }


    return (<>
                {error && <p className="error-message">{error}</p>}
                <div>
                    <h1>Cell Population Frequency Overview</h1>
                </div>

                <div className="section">
                    {data && (<div className="pagedtable">
                        <div className="table-paginator">
                            <label htmlFor="limit">Number of samples to display:</label>
                            <input
                                id="limit"
                                type="number"
                                value={limit}
                                onChange={handlelimitChange}
                                style={{ width: '30px', padding: '5px', borderRadius: '4px', border: '1px solid #ccc' }}
                            />
                            <button onClick={handlePrev} style={{ padding: '8px 12px', borderRadius: '4px', border: 'none', background: '#007bff', color: 'white', cursor: 'pointer' }}>
                                &larr;
                            </button>
                            <span style={{ fontStyle: 'italic', color: '#555' }}>
                                Samples <input 
                                    style={{ width: '30px', padding: '5px', borderRadius: '4px', border: '1px solid #ccc' }}
                                    onChange={handleOffsetChange}
                                    value={offset} />
                                - {String(offset + limit - 1).padStart(4, '0')}

                            </span>
                            <button onClick={handleNext} style={{ padding: '8px 12px', borderRadius: '4px', border: 'none', background: '#007bff', color: 'white', cursor: 'pointer' }}>
                                &rarr;
                            </button>
                        </div>
                        <div className="table-container" ref={tableContainerRef}>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Sample</th>
                                        <th>Total Count</th>
                                        <th>Population</th>
                                        <th>Count</th>
                                        <th>Percentage</th>
                                    </tr>
                                </thead>
                                <tbody >
                                    {data.map((row, index) => (
                                        <tr className="table-row" key={index}>
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
                    <div className="sectionblock">
                    {/* {JSON.stringify(cellFreqData)} */}
                    {/* Cell types in data: {cellTypes.join(', ')} */}
                    {cellFreqData && 
                        <ReactECharts
                            option={{...getBoxPlotOptions(cellFreqData.filter(d => d.time_from_treatment_start == 0)),
                                    title: {text: `Cell Population Relative \nFrequency (whole dataset)`, left: 'center', top: '0'}
                            }} notMerge={true} style={{height: '500px', width: '500px'}}/>
                    }
                    </div>
                </div>
            </>
        );
}

export default FreqOverview;