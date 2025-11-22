import { usePayment, type CreditScore } from '@/contexts/PaymentContext';
import { DollarSign, TrendingUp } from 'lucide-react';

const CREDIT_SCORE_OPTIONS: { value: CreditScore; label: string; description: string }[] = [
  { value: 'excellent', label: 'Excellent', description: '720+' },
  { value: 'good', label: 'Good', description: '680-719' },
  { value: 'fair', label: 'Fair', description: '620-679' },
  { value: 'poor', label: 'Poor', description: '<620' },
];

export function StickyPaymentBar() {
  const { creditScore, setCreditScore, downPayment, setDownPayment, apr } = usePayment();

  return (
    <div className="sticky top-16 z-40 bg-gradient-to-r from-primary to-blue-700 text-white shadow-lg border-b border-blue-800">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            <span className="font-bold text-sm">Payment Calculator</span>
          </div>

          {/* Credit Score Selector */}
          <div className="flex items-center gap-3 flex-1">
            <label className="text-xs font-medium whitespace-nowrap" htmlFor="credit-score">
              Credit Score:
            </label>
            <select
              id="credit-score"
              value={creditScore}
              onChange={(e) => setCreditScore(e.target.value as CreditScore)}
              className="bg-white/20 backdrop-blur border border-white/30 rounded-lg px-3 py-2 text-white text-sm font-bold focus:outline-none focus:ring-2 focus:ring-white/50 cursor-pointer min-w-[140px]"
              data-testid="select-credit-score"
            >
              {CREDIT_SCORE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value} className="text-slate-900">
                  {option.label} ({option.description})
                </option>
              ))}
            </select>
            <span className="text-xs font-medium bg-white/20 px-3 py-2 rounded-lg">
              APR: {apr}%
            </span>
          </div>

          {/* Down Payment Input */}
          <div className="flex items-center gap-3">
            <label className="text-xs font-medium whitespace-nowrap" htmlFor="down-payment">
              Down Payment:
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/70" />
              <input
                id="down-payment"
                type="number"
                min="0"
                step="500"
                value={downPayment}
                onChange={(e) => setDownPayment(Math.max(0, parseInt(e.target.value) || 0))}
                className="bg-white/20 backdrop-blur border border-white/30 rounded-lg pl-9 pr-3 py-2 text-white text-sm font-bold focus:outline-none focus:ring-2 focus:ring-white/50 w-32"
                placeholder="0"
                data-testid="input-down-payment"
              />
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
