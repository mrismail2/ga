import React from 'react';
import { StatusBadge } from './StatusBadge';

type PaymentStatus = 'paid' | 'unpaid' | 'partial' | 'free';

export const PaymentBadge: React.FC<{ status: PaymentStatus }> = ({ status }) => (
  <StatusBadge variant={status} />
);
