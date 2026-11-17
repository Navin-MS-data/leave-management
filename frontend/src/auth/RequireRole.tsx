import { Navigate, Outlet, useLocation, useOutletContext } from 'react-router-dom';
import type { Role } from '../api/types';
import { homePath, useAuth } from './AuthContext';

/**
 * Route guard. It only decides what the UI shows: the API enforces roles on its own,
 * so a hand-typed URL still cannot reach data the role has no access to.
 */
export function RequireRole({ roles }: { roles?: Role[] }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  // A guard sits between the shell and its pages, so it passes the shell's context straight through.
  const shell = useOutletContext<unknown>();

  if (loading) return <p className="boot" role="status">Opening your passbook…</p>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homePath(user.role)} replace />;
  return <Outlet context={shell} />;
}
