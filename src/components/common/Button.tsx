import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  variant?: 'primary' | 'secondary' | 'glass';
  children: React.ReactNode;
}

export function Button({
  isLoading = false,
  variant = 'primary',
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const getVariantStyle = () => {
    switch (variant) {
      case 'secondary':
        return { background: 'rgba(255, 255, 255, 0.1)', color: '#fff' };
      case 'glass':
        return { background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: '#fff' };
      default:
        return { background: 'linear-gradient(135deg, var(--accent-orange), var(--accent-amber))', color: '#fff' };
    }
  };

  return (
    <button
      disabled={isLoading || disabled}
      style={{
        ...getVariantStyle(),
        padding: '12px 20px',
        borderRadius: '25px',
        fontWeight: 700,
        fontSize: '14px',
        border: 'none',
        cursor: isLoading || disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        opacity: isLoading || disabled ? 0.7 : 1,
        transition: 'transform 0.2s ease, opacity 0.2s ease',
      }}
      className={className}
      {...props}
    >
      {isLoading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
}
