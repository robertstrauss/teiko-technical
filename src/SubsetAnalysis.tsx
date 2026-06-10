import { useEffect, useState } from "react";
import axios from "axios";
import ReactECharts from 'echarts-for-react';
import ChartRow from "./ChartRow";

type SubsetData = any;

const SubsetAnalysis = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<SubsetData[]>([]);
    const [condition, setCondition] = useState<string>('melanoma');
    const [treatment, setTreatment] = useState<string>('miraclib');
    const [sample_type, setSampleType] = useState<string>('pbmc');
    const [time_from_treatment_start, setTFTS] = useState<string>('0');

    const getTotal = (filter: {[key: string]: string}) => {
        let filtered = data.filter(d => {
            for (let key in filter) {
                if (d[key] !== filter[key]) return false;
            }
            return true;
        });
        return filtered.reduce((subtotal, current) => subtotal + current.n_samples, 0);
    }

    useEffect(() => {
        if (loading) return;

        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await axios.get(`http://localhost:8000/analysis/subset/?condition=${condition}&treatment=${treatment}&sample_type=${sample_type}&time_from_treatment_start=${time_from_treatment_start}`);
                const rawData = response.data;
                // unpack list intro records ( {col: [val1, val2, ...]} -> [{col: val1}, {col: val2}, ...] )
                const transformedData: SubsetData[] = rawData.n_samples.map((_: any, index: number) => (
                    Object.fromEntries(Object.keys(rawData).map((key: string) => [key, rawData[key][index]]))
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
    }, [condition, treatment, sample_type, time_from_treatment_start]);

    const pieOptions = {
        tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
        legend: { orient: 'vertical', left: 'left' },
        series: [
            {
                type: 'pie',
                radius: '60%',
                emphasis: {
                    itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' }
                }
            }
        ]
    }

    const sankeyOptions = () => {
        return {

        }
    }

    return (<>
        {error && <p className="error-message">{error}</p>}

        {JSON.stringify(data)}

        {data && (<div>
            <table>
                <thead style={{textAlign: 'center'}}><tr><td colSpan={4}>Total Samples</td></tr></thead>
                <tbody>
                <tr><td colSpan={4} style={{textAlign: 'center'}}> {getTotal({})}</td></tr>
                <tr><td>Male</td><td> {getTotal({sex: 'M'})}</td> <td>Female</td><td> {getTotal({sex: 'F'})}</td></tr>
                <tr><td>Responder</td><td> {getTotal({response: 'yes'})}</td> <td>Non-responder</td><td> {getTotal({response: 'no'})}</td></tr>
                <tr><td>Project breakdown</td><td> prj1: {getTotal({project_id: 'prj1'})}, prj2: {getTotal({project_id: 'prj2'})}</td></tr>
                </tbody>
            </table>
            <div className="section">
                <ChartRow minCardWidth="350px">
                {/* <div className="sectionblock"> */}
                    <ReactECharts option={{...pieOptions,
                        title: { text: 'Subject Gender Breakdown', left: 'center' },
                        series: [{...pieOptions.series[0], data: [
                            {name: 'Male', value: getTotal({sex: 'M'})},
                            {name: 'Female', value: getTotal({sex: 'F'})}
                        ]}]
                    }} notMerge={true} style={{ height: '400px', width: '100%' }} />
                {/* </div>
                <div className="sectionblock"> */}
                    <ReactECharts option={{...pieOptions,
                        title: { text: 'Treatment Response Breakdown', left: 'center' },
                        series: [{...pieOptions.series[0], data: [
                            {name: 'Responders', value: getTotal({response: 'yes'})},
                            {name: 'Non-responders', value: getTotal({response: 'no'})}
                    ]}]}} notMerge={true} style={{ height: '400px', width: '100%' }} />
                {/* </div>
                <div className="sectionblock"> */}
                    <ReactECharts option={{...pieOptions, 
                        title: { text: 'Project Sample Breakdown', left: 'center' },
                        series: [{...pieOptions.series[0], data: [
                            {name: 'prj1', value: getTotal({project_id: 'prj1'})},
                            {name: 'prj2', value: getTotal({project_id: 'prj2'})},
                            {name: 'prj3', value: getTotal({project_id: 'prj3'})}
                    ]}]}} notMerge={true} style={{ height: '400px', width: '100%' }} />
                {/* </div> */}
                </ChartRow>
            </div>
            {/* Sankey Diagram Container */}
            <div className="section">
                {/* <ReactECharts option={sankeyOptions()} style={{ height: '500px', width: '100%' }} /> */}
            </div>
        </div>)}
    </>);
};


export default SubsetAnalysis;