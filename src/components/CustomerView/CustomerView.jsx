import React from 'react';
import CustomerTickets from './CustomerTickets';

const CustomerView = () => {
  return (
    <div className="container mx-auto">
      <CustomerTickets isWidget={false} />
    </div>
  );
};

export default CustomerView; 