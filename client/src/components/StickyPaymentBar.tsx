import { usePayment, type CreditScore } from '@/contexts/PaymentContext';
import { DollarSign, TrendingUp } from 'lucide-react';
import { useState, useEffect } from 'react';

function getCreditScoreFromValue(score: number): CreditScore {
  if (score >= 720) return 'excellent';
  if (score >= 680) return 'good';
  if (score >= 620) return 'fair';
  return 'poor';
}

function getCreditLabel(score: number): string {
  if (score >= 720) return 'Excellent';
  if (score >= 680) return 'Good';
  if (score >= 620) return 'Fair';
  return '<600 Poor';
}

function getInitialScoreValue(category: CreditScore): number {
  switch (category) {
    case 'excellent': return 720;
    case 'good': return 680;
    case 'fair': return 620;
    case 'poor': return 600;
  }
}

export function StickyPaymentBar() {
  const { creditScore, setCreditScore, downPayment, setDownPayment, apr } = usePayment();
  const [creditScoreValue, setCreditScoreValue] = useState(() => getInitialScoreValue(creditScore));

  // Sync slider value with context on credit score category change
  useEffect(() => {
    const currentCategory = getCreditScoreFromValue(creditScoreValue);
    if (currentCategory !== creditScore) {
      setCreditScoreValue(getInitialScoreValue(creditScore));
    }
  }, [creditScore]);

  const handleCreditScoreChange = (value: number) => {
    setCreditScoreValue(value);
    const category = getCreditScoreFromValue(value);
    setCreditScore(category);
  };

  return (
    <div className="sticky top-16 z-40 bg-gradient-to-r from-primary to-blue-700 text-white shadow-lg border-b border-blue-800">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            <span className="font-bold text-sm">Payment Calculator</span>
          </div>

          {/* Credit Score Slider */}
          <div className="flex-1 min-w-[200px]">
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-medium" htmlFor="credit-score">
                Credit Score: {creditScoreValue}
              </label>
              <span className="text-xs font-bold bg-white/20 px-2 py-1 rounded">
                {getCreditLabel(creditScoreValue)}
              </span>
            </div>
            <input
              id="credit-score"
              type="range"
              min="600"
              max="850"
              step="10"
              value={creditScoreValue}
              onChange={(e) => handleCreditScoreChange(parseInt(e.target.value))}
              className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-lg [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:shadow-lg"
              data-testid="slider-credit-score"
            />
            <div className="flex justify-between text-xs opacity-60 mt-0.5">
              <span>&lt;600</span>
              <span>APR: {apr}%</span>
              <span>850</span>
            </div>
          </div>

          {/* Down Payment Slider */}
          <div className="min-w-[200px]">
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-medium" htmlFor="down-payment">
                Down Payment
              </label>
              <span className="text-xs font-bold bg-white/20 px-2 py-1 rounded flex items-center gap-1">
                <DollarSign className="w-3 h-3" />
                {downPayment.toLocaleString()}
              </span>
            </div>
            <input
              id="down-payment"
              type="range"
              min="0"
              max="50000"
              step="500"
              value={downPayment}
              onChange={(e) => setDownPayment(parseInt(e.target.value))}
              className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-secondary [&::-webkit-slider-thumb]:shadow-lg [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-secondary [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:shadow-lg"
              data-testid="slider-down-payment"
            />
            <div className="flex justify-between text-xs opacity-60 mt-0.5">
              <span>$0</span>
              <span>$50K</span>
            </div>
          </div>

          <div className="hidden md:block text-xs opacity-75">
            Payments update instantly
          </div>
        </div>
      </div>
    </div>
  );
}
