import { createContext, useContext, useState, ReactNode } from 'react';

export type CreditScore = 'poor' | 'fair' | 'good' | 'excellent';

interface PaymentContextType {
  creditScore: CreditScore;
  setCreditScore: (score: CreditScore) => void;
  downPayment: number;
  setDownPayment: (amount: number) => void;
  apr: number;
}

const PaymentContext = createContext<PaymentContextType | undefined>(undefined);

const APR_RATES: Record<CreditScore, number> = {
  poor: 12.99,
  fair: 9.99,
  good: 7.99,
  excellent: 5.99,
};

export function PaymentProvider({ children }: { children: ReactNode }) {
  const [creditScore, setCreditScore] = useState<CreditScore>('good');
  const [downPayment, setDownPayment] = useState(0);
  
  const apr = APR_RATES[creditScore];

  return (
    <PaymentContext.Provider value={{ creditScore, setCreditScore, downPayment, setDownPayment, apr }}>
      {children}
    </PaymentContext.Provider>
  );
}

export function usePayment() {
  const context = useContext(PaymentContext);
  if (!context) {
    throw new Error('usePayment must be used within PaymentProvider');
  }
  return context;
}
