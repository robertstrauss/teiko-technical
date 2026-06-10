import { useRef, useEffect, useState } from "react";
import React from "react";

interface ResponsiveGridProps {
    children: React.ReactElement | React.ReactElement[];
    minCardWidth?: string; // e.g., '350px' or '400px'
    rowGap?: string;       // e.g., '24px'
    cardHeight?: string;   // e.g., '350px'
}

const ChartRow = ({children, minCardWidth='350px', rowGap='24px', cardHeight='350px'}: ResponsiveGridProps) => {
    // automatically resize canvas-based charts in a flex row.

    const chartsRef = useRef<any[]>([]);

    // Helper function to register each chart instance dynamically as it mounts
    const registerChart = (instance: any, index: number) => {
        if (instance) {
        chartsRef.current[index] = instance;
        }
    };

    // resize listener
    useEffect(() => {
        const handleResize = () => {
        // Loop through our registry and trigger .resize() on every living chart
        chartsRef.current.forEach((chartRef) => {
            if (chartRef) {
            chartRef.getEchartsInstance().resize();
            }
        });
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    // Convert single children safely to an iterable array
    const childrenArray = React.Children.toArray(children);

    return (
    <div className="chartrow">
      {childrenArray.map((child, index) => {
        if (!React.isValidElement(child)) return null;

        return (
          <div 
            key={index} 
            className="responsive-grid-card"
            style={{
                flex: `1 0 ${minCardWidth}`,
                position: 'relative',
                overflow: 'hidden',
                backgroundColor: '#fff',
                padding: '16px',
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
            }}
          >
            {/* Clone the child component and inject the unique array ref mapping function */}
            {React.cloneElement(child as React.ReactElement, {
                ref: (el: any) => {
                    if (el) chartsRef.current[index] = el;
                },
                // Inject uniform styling overrides so the chart fits perfectly inside our card
                style: { width: '100%', height: cardHeight}
            })}
          </div>
        );
      })}
    </div>
  );
}

export default ChartRow;