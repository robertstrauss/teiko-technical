import React, { useState, useEffect, useRef } from 'react';
import './style.css';
import FreqOverview from './FreqOverview';
import TreatmentStats from './TreatmentStats';
import SubsetAnalysis from './SubsetAnalysis';


const COLUMNS_SAMPLES = ['sample_id', 'project_id', 'subject_id', 'time_from_treatment', 'sample_type'];
const COLUMNS_SUBJECTS = ['subject_id', 'condition', 'age', 'sex', 'treatment', 'response'];
const COLUMNS_CELLS = ['sample_id', 'cell_type', 'count'];




const App = () => {
    const [activeTab, setActiveTab] = useState('overview');
    let myFreqOverview:(React.JSX.Element | null) = null;


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
                {activeTab == 'overview' && <FreqOverview/>}
                {activeTab == 'statistics' && <TreatmentStats/>}
                {activeTab == 'analysis' && <SubsetAnalysis/>}
            </main>
        </div>
    );
};


export default App;
