import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { LeaveRequest } from '../api/types';
import { Statement } from './Statement';

// A fixed "today" so the cancel rule (leave that has ended cannot be cancelled) is predictable.
vi.mock('../lib/dates', async (importOriginal) => {
  const real = await importOriginal<typeof import('../lib/dates')>();
  return { ...real, todayISO: () => '2026-06-01' };
});

const leaveTypes = [
  { id: 1, name: 'Annual', yearlyAllowance: 20, isPaid: true },
  { id: 2, name: 'Sick', yearlyAllowance: 10, isPaid: true },
  { id: 3, name: 'Unpaid', yearlyAllowance: null, isPaid: false },
];

function req(id: number, overrides: Partial<LeaveRequest>): LeaveRequest {
  return {
    id,
    userId: 4,
    leaveTypeId: 1,
    startDate: '2026-06-08',
    endDate: '2026-06-10',
    days: 3,
    year: 2026,
    reason: 'Trip',
    status: 'pending',
    decidedById: null,
    decidedAt: null,
    decisionNote: null,
    cancelledAt: null,
    createdAt: '2026-05-20T09:00:00Z',
    leaveType: leaveTypes[0],
    ...overrides,
  };
}

const requests: LeaveRequest[] = [
  req(1, { status: 'approved', startDate: '2026-03-02', endDate: '2026-03-04', days: 3 }), // already ended
  req(2, { status: 'pending', startDate: '2026-06-08', endDate: '2026-06-12', days: 5 }),
  req(3, { status: 'rejected', startDate: '2026-07-06', endDate: '2026-07-07', days: 2, decisionNote: 'Release week' }),
  req(4, { status: 'cancelled', startDate: '2026-08-03', endDate: '2026-08-05', days: 3 }),
];

function mockApi() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
    if (url.includes('/leave-types')) return json(leaveTypes);
    if (url.includes('/balances/me')) {
      return json({
        userId: 4,
        userName: 'Emma Stone',
        year: 2026,
        balances: [
          { leaveTypeId: 1, leaveTypeName: 'Annual', allowance: 20, used: 3, pending: 5, remaining: 12 },
          { leaveTypeId: 2, leaveTypeName: 'Sick', allowance: 10, used: 0, pending: 0, remaining: 10 },
          { leaveTypeId: 3, leaveTypeName: 'Unpaid', allowance: null, used: 0, pending: 0, remaining: null },
        ],
      });
    }
    if (url.includes('/leave-requests/mine')) return json(requests);
    if (url.includes('/cancel') && init?.method === 'PATCH') return json({ ...requests[1], status: 'cancelled' });
    return json({ message: 'not mocked' }, 404);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderStatement() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Statement />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('Statement', () => {
  it('shows the balance with unlimited types marked as such', async () => {
    mockApi();
    renderStatement();
    const table = await screen.findByRole('table', { name: 'Balance by leave type' });
    expect(within(table).getByRole('row', { name: /Annual/ })).toHaveTextContent('12');
    expect(within(table).getByRole('row', { name: /Unpaid/ })).toHaveTextContent('Unlimited');
  });

  it('lists entries with a running balance, and reversed ones with no change', async () => {
    mockApi();
    renderStatement();
    const table = await screen.findByRole('table', { name: 'Leave entries for 2026' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(5); // three requests, a struck cancelled one, and its reversal line
    expect(rows[0]).toHaveTextContent('17 days'); // 20 - 3
    expect(rows[1]).toHaveTextContent('12 days'); // 20 - 3 - 5, pending counted
    expect(rows[2]).toHaveTextContent('Rejected');
    expect(rows[2]).toHaveTextContent('Release week');
    expect(within(rows[2]).getByLabelText('No change')).toBeInTheDocument();
  });

  it('pencils pending entries and follows a cancelled one with a reversal that returns its days', async () => {
    mockApi();
    renderStatement();
    const table = await screen.findByRole('table', { name: 'Leave entries for 2026' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows[0]).not.toHaveClass('is-pending'); // approved: full ink
    expect(rows[1]).toHaveClass('is-pending'); // pending: pencil
    expect(rows[3]).toHaveTextContent('Cancelled');
    expect(rows[3]).toHaveClass('is-reversed');
    expect(rows[4]).toHaveClass('is-reversal');
    expect(rows[4]).toHaveTextContent(/Reversal of/);
    expect(rows[4]).toHaveTextContent('+3');
    expect(rows[4]).toHaveTextContent('12 days'); // balance with the cancelled days handed back
  });

  it('only offers Cancel on a request that still holds days and has not ended', async () => {
    mockApi();
    renderStatement();
    const table = await screen.findByRole('table', { name: 'Leave entries for 2026' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(within(rows[0]).queryByRole('button')).not.toBeInTheDocument(); // approved but over
    expect(within(rows[1]).getByRole('button', { name: /Cancel request/ })).toBeInTheDocument();
    expect(within(rows[2]).queryByRole('button')).not.toBeInTheDocument(); // rejected
  });

  it('asks for confirmation before cancelling, then sends the cancel call', async () => {
    const fetchMock = mockApi();
    const user = userEvent.setup();
    renderStatement();
    await user.click(await screen.findByRole('button', { name: /Cancel request/ }));
    expect(screen.getByText('Reverse this entry?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Yes, cancel' }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([url, init]) => String(url).endsWith('/leave-requests/2/cancel') && init?.method === 'PATCH')).toBe(true),
    );
  });
});
