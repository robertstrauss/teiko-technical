import { useRef, useEffect, useState, ReactEventHandler } from "react";
import axios from "axios";
// import Plot from 'react-plotly.js';
import ChartRow from "./ChartRow";
import ReactECharts from "echarts-for-react";


export interface TreatmentBoxStats {
    cell_type: string;
    response: 'yes' | 'no' | '';
    time_from_treatment_start: number;
    adj_min: number;
    q1: number;
    median: number;
    q3: number;
    adj_max: number;
    outliers: number[];
}

export const BOX_STATS = ['cell_type', 'response', 'time_from_treatment_start', 'adj_min', 'q1', 'median', 'q3', 'adj_max', 'outliers'];


export const getBoxPlotOptions = (boxes: TreatmentBoxStats[]) => {
    const cellTypes = Array.from(new Set(boxes.reduce((types, box) => {
        types.push(box.cell_type);
        return types;
    }, [] as string[])));

    const cellXValues = Object.fromEntries(cellTypes.map((type, i) => [type, i]));
    const responders = boxes.filter(stat => stat.response == 'yes');
    const nonresponders = boxes.filter(stat => stat.response == 'no');
    const healthy = boxes.filter(stat => stat.response === '');
    const offset = 0.23;

    const labels: string[] = [];
    if (responders.length > 0) labels.push('Responder');
    if (nonresponders.length > 0) labels.push('Non-Responder');
    if (healthy.length > 0) labels.push('Healthy/No Treatment');

    return {
        title: { text: 'Cell Population Frequency by Phenotype', left: 'center'},
        tooltip: { trigger: 'item', axisPointer: { type: 'shadow' },  formatter: (params: any) => {
            // Extract the numerical X-coordinate from the data array
            const xValue = Math.round(params.value[0]);
            
            // Map it to cell category label
            const categoryName = cellTypes[xValue] || 'Unknown';

            if (params.value.length == 2) {
                return `
                    <div style="font-weight: bold; padding-bottom: 4px; border-bottom: 1px solid #ccc; margin-bottom: 4px;">
                        ${categoryName}
                    </div>
                    value: ${params.value[1]}
                `;
            } else {
                return `
                    <div style="font-weight: bold; padding-bottom: 4px; border-bottom: 1px solid #ccc; margin-bottom: 4px;">
                        ${categoryName}
                    </div>
                    Max: ${params.value[5]} <br/>
                    Q3: ${params.value[4]} <br/>
                    Median: ${params.value[3]} <br/>
                    Q1: ${params.value[2]} <br/>
                    Min: ${params.value[1]}
                `;
            }
        }},
        legend: { 
            data: labels,
             bottom: '0%' },
        // Define shared visual grids so scatter dots line up over the shifted boxes
        grid: { left: '10%', right: '10%', bottom: '25%' },
        xAxis: {
            type: 'value',
            min: -0.2, max: cellTypes.length-0.8,
            interval: 1,
            // data: cellTypes,
            splitLine: {show: false},
            axisLabel: {
                customValues: Object.values(cellXValues),
                formatter: (value: number) => cellTypes[value],
                rotate: 45,
            },
            axisTick: {
                customValues: Object.values(cellXValues)
            }
        },
        yAxis: {
            type: 'value',
            name: 'Relative Frequency',
            splitArea: { show: true }
        },
        series: [
            (responders.length > 0 && {
                name: 'Responder',
                type: 'boxplot',
                boxWidth: '30%',
                data: responders.map(box => [cellXValues[box.cell_type], box.adj_min, box.q1, box.median, box.q3, box.adj_max].map(v => v.toFixed(3))),
                itemStyle: { color: '#bbf7d0', borderColor: '#22c55e', borderWidth: 2 }
            }),
            (nonresponders.length > 0 && {
                name: 'Non-Responder',
                type: 'boxplot', 
                boxWidth: '30%',
                data: nonresponders.map(box => [cellXValues[box.cell_type], box.adj_min, box.q1, box.median, box.q3, box.adj_max].map(v => v.toFixed(3))),
                itemStyle: { color: '#fef08a', borderColor: '#eab308', borderWidth: 2 }
            }),
            (healthy.length > 0 && {
                name: 'Healthy/No Treatment',
                type: 'boxplot', 
                boxWidth: '30%',
                data: healthy.map(box => [cellXValues[box.cell_type], box.adj_min, box.q1, box.median, box.q3, box.adj_max].map(v => v.toFixed(3))),
                itemStyle: { color: '#9bd0e1', borderColor: '#3094b5', borderWidth: 2 }
            }),
            // OVERLAY SCATTER SERIES FOR OUTLIERS
            // ECharts automatically shifts scatter points to align with the box categories 
            // if they share the same 'name' identifier as the parent box series
            (responders.length > 0 && {
                name: 'Responder',
                type: 'scatter',
                data: responders.flatMap(box => {
                    const xCoord = cellXValues[box.cell_type] - offset;
                    return box.outliers.map(v => [
                        xCoord, 
                        parseFloat(v.toFixed(3))
                    ]);
                }),
                marker: 'circle',
                symbolSize: 5,
                itemStyle: { color: '#16a34a' }
            }),
            (nonresponders.length > 0 && {
                name: 'Non-Responder',
                type: 'scatter',
                data: nonresponders.flatMap(box => {
                    const xCoord = cellXValues[box.cell_type] + offset;
                    return box.outliers.map(v => [
                        xCoord, 
                        parseFloat(v.toFixed(3))
                    ]);
                }),
                marker: 'circle',
                symbolSize: 5,
                itemStyle: { color: '#ca8a04' }
            }),
            (healthy.length > 0 && {
                name: 'Healthy/No Treatment',
                type: 'scatter',
                data: healthy.flatMap(box => {
                    const xCoord = cellXValues[box.cell_type] + offset;
                    return box.outliers.map(v => [
                        xCoord, 
                        parseFloat(v.toFixed(3))
                    ]);
                }),
                marker: 'circle',
                symbolSize: 5,
                itemStyle: { color: '#9bd0e1' }
            })
        ]
    };
};



const TreatmentStats = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<TreatmentBoxStats[]>([]);
    const [condition, setCondition] = useState<string>('melanoma');
    const [conditions, setConditions] = useState<string[]>([]);
    const [treatment, setTreatment] = useState<string>('miraclib');
    const [treatments, setTreatments] = useState<string[]>([]);
    const [sample_type, setSampleType] = useState<string>('PBMC');

    useEffect(() => {
        if (loading) return;

        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await axios.get(`http://localhost:8000/analysis/treatment_statistics/?condition=${condition}&treatment=${treatment}&sample_type=${sample_type}`);
                const rawData = response.data;
                // unpack list into records
                const transformedData: TreatmentBoxStats[] = rawData.cell_type.map((_: any, index: number) => (
                    Object.fromEntries(BOX_STATS.map(key => [key, rawData[key][index]]))
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
    }, [treatment, condition, sample_type]);

    useEffect(() => {
        if (treatments && treatments.length > 0 && conditions && conditions.length > 0) return;
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const cresponse = await axios.get(`http://localhost:8000/possible_values/?col=condition`);
                setConditions(Object.values(cresponse.data));

                const tresponse = await axios.get(`http://localhost:8000/possible_values/?col=treatment`);
                setTreatments(Object.values(tresponse.data));
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
    });


    const handleConditionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        if (conditions.indexOf(e.target.value) > -1) {
            setCondition(e.target.value);
            if (e.target.value == 'healthy') setTreatment('none');
        }
    }

    const handleTreatmentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        if (treatments.indexOf(e.target.value) > -1) {
            setTreatment(e.target.value);
            if (e.target.value == 'none') setCondition('healthy');
        }
    }


    return (<>
        {error && <p className="error-message">{error}</p>}
        <div className="header">
            <h1>Cell population statistics: {treatment} response for {condition} patients</h1>
        </div>
        <div className="section">
            <div className="sectionblock">
                <h3>View statistics for:</h3>
                Condition: <select onChange={handleConditionChange} value={condition}>
                    {conditions.map((c, i) => {
                        return <option key={i} value={c}>{c}</option>
                    })}
                </select>
                <br/>
                Treatment: <select onChange={handleTreatmentChange} value={treatment}>
                    {treatments.map((t, i) => {
                        return <option key={i} value={t}>{t}</option>
                    })}
                </select>
            </div>
            <ChartRow minCardWidth="350px" cardHeight="450px">
                {[0, 7, 14].map((tfts, i) => {

                    return (data &&
                        <ReactECharts key={i}
                            option={{...getBoxPlotOptions(data.filter(box => box.time_from_treatment_start == tfts)),
                                    title: {text: `Cell Frequency ${tfts} days from Treatment`, left: 'center'}
                            }} notMerge={true} style={{height: '500px', width: '100%'}}/>

                )})}
            </ChartRow>
        {/* </div>))} */}
        </div>
    </>);
};

export default TreatmentStats;