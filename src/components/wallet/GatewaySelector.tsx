import React, { useId } from 'react';
import { Check } from 'lucide-react';
import { PaymentMethod } from '../../types';

interface GatewaySelectorProps {
  selectedMethod: PaymentMethod;
  onSelect: (method: PaymentMethod) => void;
}

const BkashCircleLogo: React.FC = () => (
  <span className="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm">
    <svg
      viewBox="0 0 36 36"
      fill="none"
      className="w-6 h-6"
      aria-hidden="true"
    >
      {/* Upper wing */}
      <path d="M9.5 7.5L19.6 15.1L15.7 18.8L9.5 7.5Z" fill="#E2136E" />
      {/* Upper crest */}
      <path d="M13.6 10.6L21.9 13.5L19.6 15.1L13.6 10.6Z" fill="#B50D57" />
      {/* Central folded body */}
      <path d="M15.7 18.8L19.6 15.1L23.1 19.7L16.5 23.6L15.7 18.8Z" fill="#D11165" />
      {/* Beak */}
      <path d="M19.6 15.1L29.2 16.3L23.1 19.7L19.6 15.1Z" fill="#E2136E" />
      {/* Lower wing */}
      <path d="M10.4 21.9L15.7 18.8L16.5 23.6L10.4 21.9Z" fill="#F2388A" />
      {/* Tail */}
      <path d="M16.5 23.6L12.3 28.8L13.6 22.8L16.5 23.6Z" fill="#9E0B4B" />
    </svg>
  </span>
);

const NagadCircleLogo: React.FC = () => {
  const gradId = useId();
  return (
    <span className="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm">
      <svg
        viewBox="0 0 36 36"
        fill="none"
        className="w-6 h-6"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradId} x1="7" y1="28" x2="29" y2="8" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ED1C24" />
            <stop offset="100%" stopColor="#F7941D" />
          </linearGradient>
        </defs>
        <path
          d="M25.8 10.7C23.85 8.65 21.08 7.4 18 7.4C12.15 7.4 7.4 12.15 7.4 18C7.4 23.85 12.15 28.6 18 28.6C23.85 28.6 28.6 23.85 28.6 18C28.6 16.45 28.26 14.98 27.66 13.65L24.28 15.3C24.68 16.12 24.9 17.03 24.9 18C24.9 21.81 21.81 24.9 18 24.9C14.19 24.9 11.1 21.81 11.1 18C11.1 14.19 14.19 11.1 18 11.1C19.98 11.1 21.77 11.94 23.03 13.28L25.8 10.7Z"
          fill={`url(#${gradId})`}
        />
        <path
          d="M21.9 17.85C21.9 20.0 20.15 21.75 18 21.75C15.85 21.75 14.1 20.0 14.1 17.85C14.1 15.92 15.51 14.32 17.36 14.02V16.58C16.86 16.81 16.52 17.29 16.52 17.85C16.52 18.67 17.18 19.33 18 19.33C18.82 19.33 19.48 18.67 19.48 17.85H21.9Z"
          fill="#ED1C24"
        />
        <circle cx="25.2" cy="11.4" r="1.9" fill="#F7941D" />
      </svg>
    </span>
  );
};

export const GatewaySelector: React.FC<GatewaySelectorProps> = ({
  selectedMethod,
  onSelect,
}) => {
  const gateways: { method: PaymentMethod; label: string }[] = [
    { method: 'bKash', label: 'BKASH' },
    { method: 'Nagad', label: 'NAGAD' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {gateways.map(({ method, label }) => {
        const isSelected = selectedMethod === method;
        return (
          <button
            key={method}
            type="button"
            onClick={() => onSelect(method)}
            aria-pressed={isSelected}
            className={`keep-dark-surface relative min-h-[54px] px-3.5 py-3 rounded-xl bg-[#090B10] flex items-center gap-3 transition-all duration-150 cursor-pointer text-left ${
              isSelected
                ? 'border border-amber-400 shadow-[0_0_16px_rgba(250,204,21,0.35)]'
                : 'border border-amber-500/25 opacity-80 hover:opacity-100 hover:border-amber-400/50'
            }`}
          >
            {/* Top-Right Yellow/Gold Checkmark Circle when Selected */}
            {isSelected && (
              <span
                aria-hidden="true"
                className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-amber-400 text-[#090B10] flex items-center justify-center shadow-[0_0_10px_rgba(250,204,21,0.85)] border border-amber-200"
              >
                <Check className="w-3 h-3 stroke-[3.5]" />
              </span>
            )}

            {/* Left Official Logo in Small Circle */}
            {method === 'bKash' ? <BkashCircleLogo /> : <NagadCircleLogo />}

            {/* Bold White Capital Letters: BKASH / NAGAD */}
            <span className="text-sm sm:text-base font-black font-gaming uppercase tracking-wider text-white whitespace-nowrap">
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
};
