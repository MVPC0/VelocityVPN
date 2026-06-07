import React from 'react';

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  href?: string;
}

const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  children,
  onClick,
  className = '',
  href,
}) => {
  const baseClasses =
    'inline-flex items-center justify-center font-medium transition-all duration-300 cursor-pointer';

  const sizeClasses = {
    sm: 'px-6 py-2.5 text-xs uppercase tracking-[0.04em]',
    md: 'px-8 py-3.5 text-sm uppercase tracking-[0.04em]',
    lg: 'px-12 py-5 text-sm uppercase tracking-[0.04em]',
  };

  const variantClasses = {
    primary:
      'bg-[#E85D4E] text-white rounded-lg hover:bg-[#D44A3C] hover:scale-[1.02] active:scale-[0.98]',
    secondary:
      'bg-transparent border border-[rgba(255,255,255,0.2)] text-white rounded-lg hover:border-[#E85D4E] hover:text-[#E85D4E]',
    ghost: 'bg-transparent text-[#E85D4E] hover:underline underline-offset-4',
  };

  const classes = `${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`;

  if (href) {
    return (
      <a href={href} className={classes} onClick={onClick}>
        {children}
      </a>
    );
  }

  return (
    <button className={classes} onClick={onClick}>
      {children}
    </button>
  );
};

export default Button;
