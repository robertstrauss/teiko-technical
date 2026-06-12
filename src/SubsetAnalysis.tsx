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
    const [sample_type, setSampleType] = useState<string>('PBMC');
    const [time_from_treatment_start, setTFTS] = useState<string>('0');
    const [sankeyOptions, setSKO] = useState<any>({});

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
                const response = await axios.get(`/analysis/subset/?condition=${condition}&treatment=${treatment}&sample_type=${sample_type}&time_from_treatment_start=${time_from_treatment_start}`);
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

    

    useEffect(() => {
        // Redo sankey plot options when data is updated
        
        // We need to extract unique node names, and map explicit source -> target flows weighted by n_samples
        const nodesMap: Record<string, any> = {'all matches': {}};
        const linksMap: Record<string, number> = {};

        const COLOR_RESPONDER = '#22c55e';     // Emerald Green
        const COLOR_NON_RESPONDER = '#eab308'; // Amber/Yellow
        const COLOR_DEFAULT = '#94a3b8';       // Muted Slate for root/other nodes

        data.forEach(row => {
            // accumulate the amount of samples belonging to the subset at each level of specification: project, project+sex, project+sex+response
            const p = row.project_id;
            const s = `${p} ${row.sex}`;
            const r = `${p} ${row.response}`;

            // 1. Add unique nodes with their assigned structural colors
            // [s, r, p].forEach(nodeName => {
            //     if (!nodesMap[nodeName]) {
            //         nodesMap[nodeName] = {
            //         name: nodeName,
            //             itemStyle: { color: (row.response == 'yes' ? COLOR_RESPONDER : COLOR_NON_RESPONDER) } // Enforces node block color
            //         };
            //     }
            // });
            [p,s,r].forEach(n => nodesMap[n] = {name: n, itemStyle: {color: COLOR_DEFAULT}});
            nodesMap[r].itemStyle.color = (row.response == 'yes' ? COLOR_RESPONDER : COLOR_NON_RESPONDER);

            // Flow 0: Total split between Projects
            const link0 = `all matches-${p}`
            linksMap[link0] = (linksMap[link0] || 0) + row.n_samples;

            // Flow 1: Projects split over Sex
            const link1 = `${p}-${s}`;
            linksMap[link1] = (linksMap[link1] || 0) + row.n_samples;

            // Flow 2: Sex split by Response
            const link2 = `${s}-${r}`;
            linksMap[link2] = (linksMap[link2] || 0) + row.n_samples;
        });

        const sankeyNodes = Object.values(nodesMap).sort((node1, node2) => node1.name > node2.name ? 1 : -1);
        const sankeyLinks = Object.entries(linksMap).map(([key, value]) => {
            const [source, target] = key.split('-');
            return { source, target, value };
        });

        setSKO({
            title: { text: 'Patient Responder Status, Sex, and Project', left: 'center', top: 'top' },
            tooltip: { trigger: 'item', triggerOn: 'mousemove' },
            series: [
            {
                type: 'sankey',
                layout: 'none',
                emphasis: { focus: 'adjacency' },
                data: sankeyNodes,
                links: sankeyLinks,
                lineStyle: { color: 'gradient', curveness: 0.5 }
            }
            ]
        });
    }, [data]);

    return (<>
        {error && <p className="error-message">{error}</p>}

        {data && (<div>
            <h1>{sample_type} Samples on {condition} Patients Treated with {treatment} at Time={time_from_treatment_start}</h1>
            <div className="section">
                {/* <div className="sectionblock">
                <table>
                    <thead style={{textAlign: 'center'}}><tr><th colSpan={4}>Total Samples</th></tr></thead>
                    <tbody>
                    <tr><td colSpan={4} style={{textAlign: 'center'}}> {getTotal({})}</td></tr>
                    <tr><td>Male</td><td> {getTotal({sex: 'M'})}</td> <td>Female</td><td> {getTotal({sex: 'F'})}</td></tr>
                    <tr><td>Responder</td><td> {getTotal({response: 'yes'})}</td> <td>Non-responder</td><td> {getTotal({response: 'no'})}</td></tr>
                    <tr><td>Project breakdown</td><td> prj1: {getTotal({project_id: 'prj1'})}, prj2: {getTotal({project_id: 'prj2'})}</td></tr>
                    </tbody>
                </table>
                </div> */}

                {['prj1', 'prj2', 'prj3'].map((prj, i) => 
                    <div key={i} className="sectionblock">
                        <h3>Project {prj} Sample Counts</h3>
                        <table className="data-table">
                            <thead><tr>
                                    <th></th>
                                    <th>Responders</th>
                                    <th>Non-Responders</th>
                            </tr></thead>
                            <tbody><tr>
                                <th>Male</th>
                                <td>{getTotal({sex: 'M', response: 'yes', project_id: prj})}</td>
                                <td>{getTotal({sex: 'M', response: 'no', project_id: prj})}</td>
                            </tr>
                            <tr>
                                <th>Female</th>
                                <td>{getTotal({sex: 'F', response: 'yes', project_id: prj})}</td>
                                <td>{getTotal({sex: 'F', response: 'no', project_id: prj})}</td>
                            </tr></tbody>
                        </table>
                    </div>)}
            </div>
            <div className="section">
                {/* Pie Charts showing how samples greak down among sex, response, and projects */}
                <ChartRow minCardWidth="350px">
                    <ReactECharts option={{...pieOptions,
                        title: { text: 'Subject Gender Breakdown', left: 'center' },
                        series: [{...pieOptions.series[0], data: [
                            {name: 'Male', value: getTotal({sex: 'M'})},
                            {name: 'Female', value: getTotal({sex: 'F'})}
                        ]}]
                    }} notMerge={true} style={{ height: '400px', width: '100%' }} />

                    <ReactECharts option={{...pieOptions,
                        title: { text: 'Treatment Response Breakdown', left: 'center' },
                        series: [{...pieOptions.series[0], data: [
                            {name: 'Responders', value: getTotal({response: 'yes'})},
                            {name: 'Non-responders', value: getTotal({response: 'no'})}
                    ]}]}} notMerge={true} style={{ height: '400px', width: '100%' }} />

                    <ReactECharts option={{...pieOptions, 
                        title: { text: 'Project Sample Breakdown', left: 'center' },
                        series: [{...pieOptions.series[0], data: [
                            {name: 'prj1', value: getTotal({project_id: 'prj1'})},
                            {name: 'prj2', value: getTotal({project_id: 'prj2'})},
                            {name: 'prj3', value: getTotal({project_id: 'prj3'})}
                    ]}]}} notMerge={true} style={{ height: '400px', width: '100%' }} />
                </ChartRow>
            </div>
            {/* Sankey Diagram */}
            {(sankeyOptions && <div className="section">
                <ReactECharts option={sankeyOptions} style={{ height: '500px', width: '100%' }} />
            </div>)}
        </div>)}
    </>);
};


export default SubsetAnalysis;