import { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Delete, ShieldCheck, ArrowLeft, UserRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { listLoginUsers, loginWithPin } from '@/lib/auth';
import { cn } from '@/lib/cn';

const KEYS = ['1','2','3','4','5','6','7','8','9','','0','del'];

export default function Login() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const dest = location.state?.from?.pathname || '/app';

  useEffect(() => {
    listLoginUsers()
      .then((u) => {
        setUsers(u);
        // Auto-select first user — go straight to PIN entry.
        if (u.length > 0) setSelected(u[0]);
      })
      .catch((err) => {
        console.error(err);
        toast.error('Could not load users. Check your connection.');
      })
      .finally(() => setLoading(false));
  }, []);

  async function submit(value) {
    if (busy || !selected) return;
    setBusy(true);
    try {
      const session = await loginWithPin(selected.id, value);
      toast.success(`Welcome, ${session.name}`);
      navigate(dest, { replace: true });
    } catch (err) {
      if (err.code === 'invalid_pin') {
        toast.error('Wrong PIN.');
      } else {
        console.error(err);
        toast.error('Login failed.');
      }
      setPin('');
    } finally {
      setBusy(false);
    }
  }

  function press(k) {
    if (busy) return;
    if (k === 'del') return setPin((p) => p.slice(0, -1));
    if (!k) return;
    setPin((p) => {
      const next = (p + k).slice(0, 4);
      if (next.length === 4) submit(next);
      return next;
    });
  }

  function pickUser(u) {
    setSelected(u);
    setShowSwitcher(false);
    setPin('');
  }

  return (
    <div className="bg-carbon-hero flex min-h-full items-center justify-center p-4 text-white">
      <div className="w-full max-w-md">
        <Link to="/" className="block text-center text-lg font-bold tracking-tight">
          <span className="text-white">Smart</span>
          <span className="text-burgundy-300">Snap</span>
        </Link>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          {loading && (
            <div className="py-12 text-center text-sm text-ink-300">Loading…</div>
          )}

          {!loading && users.length === 0 && (
            <div className="py-8 text-center text-sm text-ink-300">
              No users configured. Run install.sql first.
            </div>
          )}

          {!loading && selected && !showSwitcher && (
            <>
              <div className="flex items-center justify-center gap-2 text-sm text-ink-200">
                <ShieldCheck size={16} className="text-gold-400" />
                Sign in as <span className="font-semibold text-white">{selected.name}</span>
              </div>

              <div className="mt-6 flex justify-center gap-3">
                {[0,1,2,3].map((i) => (
                  <div
                    key={i}
                    className={cn(
                      'h-4 w-4 rounded-full border border-white/30 transition',
                      i < pin.length ? 'border-gold-400 bg-gold-400' : ''
                    )}
                  />
                ))}
              </div>

              <div className="mt-8 grid grid-cols-3 gap-3">
                {KEYS.map((k, i) => (
                  <button
                    key={i}
                    onClick={() => press(k)}
                    disabled={busy || k === ''}
                    className={cn(
                      'flex h-14 items-center justify-center rounded-xl text-lg font-semibold transition',
                      k === ''
                        ? 'invisible'
                        : 'bg-white/5 text-white hover:bg-white/10 active:bg-white/20 disabled:opacity-50'
                    )}
                  >
                    {k === 'del' ? <Delete size={20} /> : k}
                  </button>
                ))}
              </div>

              {users.length > 1 && (
                <button
                  onClick={() => setShowSwitcher(true)}
                  className="mt-6 block w-full text-center text-xs text-ink-300 hover:text-white"
                >
                  Sign in as someone else
                </button>
              )}
            </>
          )}

          {!loading && showSwitcher && (
            <>
              <button
                onClick={() => setShowSwitcher(false)}
                className="inline-flex items-center gap-1 text-xs text-ink-300 hover:text-white"
              >
                <ArrowLeft size={14} /> Back
              </button>
              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-ink-200">
                <UserRound size={16} className="text-gold-400" /> Pick an account
              </div>
              <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
                {users.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => pickUser(u)}
                    className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:bg-white/10"
                  >
                    <div>
                      <div className="text-sm font-semibold text-white">{u.name}</div>
                      <div className="text-xs text-ink-300">{u.roleName}</div>
                    </div>
                    <span className="text-xs text-ink-300">Tap →</span>
                  </button>
                ))}
              </div>
            </>
          )}

          <p className="mt-6 text-center text-xs text-ink-300">
            Forgot your PIN? Ask an admin to re-issue it.
          </p>
        </div>

        <Link to="/" className="mt-6 block text-center text-sm text-ink-300 hover:text-white">
          ← Back to home
        </Link>
      </div>
    </div>
  );
}
