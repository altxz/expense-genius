import { useLocation } from 'react-router-dom';

export function AnimatedRoutes({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-page-enter" style={{ minHeight: '100%' }}>
      {children}
    </div>
  );
}
