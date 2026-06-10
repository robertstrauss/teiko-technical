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

const TreatmentStats = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<TreatmentData[]>([]);
    const [condition, setCondition] = useState<string>('melanoma');
    const [treatment, setTreatment] = useState<string>('miraclib');
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
    }, [treatment, condition, sample_type]);



    return (<>
        {error && <p className="error-message">{error}</p>}
        
        {['yes', 'no'].map(resp => (
            <div className="graphrow">
                <h3>{resp == 'no' ? 'Non-' : ''}Responders</h3>
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
    </>);
};

export default TreatmentStats;