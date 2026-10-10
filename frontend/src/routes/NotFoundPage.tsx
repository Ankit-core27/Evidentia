import React from 'react';
import { Link } from 'react-router-dom';
import { primaryButtonClass, secondaryButtonClass } from '@/components/shared/formStyles';

interface NotFoundPageProps {
  title?: string;
  message?: string;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({
  title = 'Page not found',
  message = 'This address does not match any page.'
}) => {
  return (
    <div className="max-w-lg py-16 space-y-3">
      <h1 className="text-xl font-semibold text-ink">{title}</h1>
      <p className="text-body text-ink-muted">{message}</p>
      <div className="flex items-center gap-2 pt-2">
        <Link to="/cases" className={primaryButtonClass}>
          Go to cases
        </Link>
        <Link to="/" className={secondaryButtonClass}>
          Dashboard
        </Link>
      </div>
    </div>
  );
};
