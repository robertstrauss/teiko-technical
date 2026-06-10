import { useRef, useEffect, useState } from "react";
import axios from "axios";


// interface TreatmentData {
    
// }

const SubsetAnalysis = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // const [data, setData] = useState<FrequencyData[]>([]);

    useEffect(() => {
        if (loading) return;

        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                // const response = await axios.get(`http://localhost:8000/analysis/treatment_statistics/?condition=${condition}&treatment=${treatment}`);
                // const rawData = response.data;
                // const transformedData: FrequencyData[] = rawData.cell_type.map((_: any, index: number) => ({
                //     sample: rawData.sample_id[index],
                //     total_count: rawData.total[index],
                //     population: rawData.cell_type[index],
                //     count: rawData.count[index],
                //     percentage: (rawData.count[index] / rawData.total[index]) * 100,
                // }));

                // setData(transformedData);
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
    }, [loading]);



    return (<>
        {error && <p className="error-message">{error}</p>}
    </>);
};


export default SubsetAnalysis;