import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireRole } from './auth/RequireRole';
import { Layout } from './components/Layout';
import { Admin } from './pages/Admin';
import { Approvals } from './pages/Approvals';
import { Calendar } from './pages/Calendar';
import { Login } from './pages/Login';
import { NewRequest } from './pages/NewRequest';
import { Statement } from './pages/Statement';
import { TeamBalances } from './pages/TeamBalances';

export function App() {
  return (
    <>
      <a href="#main" className="skip-link">Skip to content</a>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<RequireRole />}>
          <Route element={<Layout />}>
            <Route element={<RequireRole roles={['employee', 'manager']} />}>
              <Route index element={<Statement />} />
              <Route path="new" element={<NewRequest />} />
            </Route>
            <Route element={<RequireRole roles={['manager', 'admin']} />}>
              <Route path="approvals" element={<Approvals />} />
              <Route path="team" element={<TeamBalances />} />
            </Route>
            <Route path="calendar" element={<Calendar />} />
            <Route element={<RequireRole roles={['admin']} />}>
              <Route path="admin/*" element={<Admin />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
