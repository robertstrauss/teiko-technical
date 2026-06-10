
import { useRef, useEffect, useState } from "react";


// const dataTool = () => {

//     const [table, setTable] = useState();


//     const handleTableChange = () => {

//     }

//     return (
//         <div className="tool">
//             <div>
//                 Get data on <select onChange={handleTableChange}>
//                         <option value={COLUMNS_SAMPLES}>Samples</option>
//                         <option value={COLUMNS_SUBJECTS}>Subjects</option>
//                         <option value={COLUMNS_CELLS}>Cell Counts</option>
//                     </select>: {renderFieldSelector}
//             </div>
//             {tableVisible && (
//                 <div className="table-container" ref={tableContainerRef} onScroll={handleScroll}>
//                     <table className="data-table">
//                         <thead>
//                             <tr>
//                                 <th className="table-header">Sample</th>
//                                 <th className="table-header">Total Count</th>
//                                 <th className="table-header">Population</th>
//                                 <th className="table-header">Count</th>
//                                 <th className="table-header">Percentage</th>
//                             </tr>
//                         </thead>
//                         <tbody style={{ paddingTop, paddingBottom }}>
//                             {visibleRows.map((row, index) => (
//                                 <tr key={visibleRange.start + index} className="table-row">
//                                     <td className="table-entry">{row.sample}</td>
//                                     <td className="table-entry">{row.total_count}</td>
//                                     <td className="table-entry">{row.population}</td>
//                                     <td className="table-entry">{row.count}</td>
//                                     <td className="table-entry">{row.percentage.toFixed(2)}</td>
//                                 </tr>
//                             ))}
//                         </tbody>
//                     </table>
//                     {loading && <p>Loading more data...</p>}
//                     {!hasMore && <p>No more data to load.</p>}
//                 </div>)
//             }
//         </div>
//     );
// }
 

export function FieldSelector(options: Array<string>) {
  const [selectedFields, setSelectedFields] = useState<string[]>(["React", "Python"]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Ref to detect clicks outside the dropdown to close it gracefully
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
        setSearchQuery(""); // Clear search when closing
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter out options that are already selected, then filter by search query
  const availableOptions = options
    .filter(option => !selectedFields.includes(option))
    .filter(option => option.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleRemoveField = (fieldToRemove: string) => {
    setSelectedFields(selectedFields.filter(field => field !== fieldToRemove));
  };

  const handleSelectField = (field: string) => {
    setSelectedFields([...selectedFields, field]);
    setIsDropdownOpen(false);
    setSearchQuery("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && availableOptions.length > 0) {
      handleSelectField(availableOptions[0]); // Selects the top filtered option
    }
  };

  return (
    <div style={{ display: 'inline-block', fontFamily: 'sans-serif' }}>
      
      {/* Main Container */}
      <div style={{ 
        display: 'flex', flexWrap: 'wrap', gap: '8px', 
        borderRadius: '4px',
        minHeight: '40px', alignItems: 'center'
      }}>
        
        {/* The Bubbles (Pills) */}
        {selectedFields.map(field => (
          <div key={field} style={{
            display: 'flex', alignItems: 'center', backgroundColor: '#e2e8f0', 
            padding: '4px 10px', borderRadius: '16px', fontSize: '14px'
          }}>
            {field}
            <button 
              onClick={() => handleRemoveField(field)}
              style={{ 
                background: 'none', border: 'none', marginLeft: '6px', 
                cursor: 'pointer', color: '#64748b', fontSize: '12px'
              }}
            >
              ✕
            </button>
          </div>
        ))}

        {/* The Plus Button & Dropdown Container */}
        <div style={{ position: 'relative' }} ref={dropdownRef}>
          <button 
            onClick={() => setIsDropdownOpen(true)}
            style={{
              background: '#3b82f6', color: 'white', border: 'none',
              borderRadius: '50%', width: '24px', height: '24px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            +
          </button>

          {/* The Dropdown Menu */}
          {isDropdownOpen && (
            <div style={{
              position: 'absolute', top: '30px', left: '0', zIndex: 10,
              background: 'white', border: '1px solid #ccc', borderRadius: '4px',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)', width: '200px',
              padding: '8px'
            }}>
              <input 
                type="text"
                autoFocus
                placeholder="Search fields..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{ 
                  width: '100%', padding: '6px', marginBottom: '8px', 
                  border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box'
                }}
              />
              <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                {availableOptions.length === 0 ? (
                  <div style={{ padding: '4px', color: '#666', fontSize: '14px' }}>No matches</div>
                ) : (
                  availableOptions.map(option => (
                    <div 
                      key={option} 
                      onClick={() => handleSelectField(option)}
                      style={{ 
                        padding: '6px 8px', cursor: 'pointer', fontSize: '14px',
                        borderRadius: '4px'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      {option}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}