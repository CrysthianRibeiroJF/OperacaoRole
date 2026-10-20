import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ErrorState, Spinner } from '../../components/misc';
import { useSession } from '../../lib/queries';

export function RequireAuth() {
  const { data, isPending, isError, refetch } = useSession();
  const location = useLocation();

  if (isPending) return <Spinner />;
  if (isError)
    return (
      <ErrorState message="Não consegui falar com o servidor." onRetry={() => void refetch()} />
    );
  if (!data.profile) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/entrar?next=${next}`} replace />;
  }
  return <Outlet />;
}
