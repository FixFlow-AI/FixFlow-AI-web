import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverEffect?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  hoverEffect = false,
  className = '',
  ...props
}) => {
  return (
    <div
      className={`glass-card rounded-xl p-5 ${
        hoverEffect ? 'glass-card-hover' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
export default Card;
