

import React, { ReactNode } from 'react';

const TableTemplate: React.FC<{headers: (ReactNode | {name: ReactNode, className?: string})[], children: ReactNode, className?: string}> = ({headers, children, className}) => (
    <div className={`overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg ${className}`}>
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-700/50">
                <tr>
                    {headers.map((header, index) => {
                        // FIX: Check for custom object with 'name' property to differentiate from React elements
                        const isObj = typeof header === 'object' && header !== null && !React.isValidElement(header) && 'name' in header;
                        const name = isObj ? (header as any).name : header;
                        const thClassName = isObj ? (header as any).className : '';
                        return (
                            // FIX: The error "Expected 0-1 arguments, but got 2" might be caused by a complex object (`name` as ReactNode) being used as a key. Changed to use the loop index for a stable, primitive key.
                            <th key={index} scope="col" className={`px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider ${thClassName}`}>{name as ReactNode}</th>
                        )
                    })}
                </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                {children}
            </tbody>
        </table>
    </div>
);

export default TableTemplate;