import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { AuthUser, Role } from '../api/types';
import { AuthContext } from './AuthContext';
import { RequireRole } from './RequireRole';

function renderAt(path: string, user: AuthUser | null, roles?: Role[]) {
  return render(
    <AuthContext.Provider value={{ user, loading: false, login: vi.fn(), logout: vi.fn() }}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/login" element={<p>Login page</p>} />
          <Route path="/" element={<p>Home page</p>} />
          <Route path="/approvals" element={<p>Approvals page</p>} />
          <Route element={<RequireRole roles={roles} />}>
            <Route path="/admin" element={<p>Admin page</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

const user = (role: Role): AuthUser => ({ id: 1, name: 'Test', email: 't@example.com', role, managerId: null });

describe('RequireRole', () => {
  it('sends signed-out visitors to the login page', () => {
    renderAt('/admin', null, ['admin']);
    expect(screen.getByText('Login page')).toBeInTheDocument();
  });

  it('lets an allowed role in', () => {
    renderAt('/admin', user('admin'), ['admin']);
    expect(screen.getByText('Admin page')).toBeInTheDocument();
  });

  it('sends an employee away from admin pages', () => {
    renderAt('/admin', user('employee'), ['admin']);
    expect(screen.queryByText('Admin page')).not.toBeInTheDocument();
    expect(screen.getByText('Home page')).toBeInTheDocument();
  });

  it('sends an admin who hits a page for staff to the approvals page', () => {
    renderAt('/admin', user('admin'), ['employee', 'manager']);
    expect(screen.getByText('Approvals page')).toBeInTheDocument();
  });
});
