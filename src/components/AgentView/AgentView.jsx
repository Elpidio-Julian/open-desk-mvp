import React from 'react';
import SupportQueue from './SupportQueue';
import AgentPerformanceMetrics from './AgentPerformanceMetrics';

const AgentView = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-8">
        <AgentPerformanceMetrics />
        <SupportQueue isWidget={false} />
      </div>
    </div>
  );
};

export default AgentView; 