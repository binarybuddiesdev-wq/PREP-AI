import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { useUser, useAuth } from '@clerk/clerk-react';

export default function SettingsPage() {
  const { isLoaded: clerkLoaded, isSignedIn } = useUser();
  const { getToken } = useAuth();
  const [user, setUser] = useState<Record<string, unknown> | null>(null);
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Form state
  const [targetRole, setTargetRole] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [dailyReminder, setDailyReminder] = useState(true);
  const [weeklyReport, setWeeklyReport] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        console.error('LOAD START');
        const token = await getToken();
        console.error('TOKEN RETRIEVED:', token ? 'YES' : 'NO');
        if (!token) return;

        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
        console.error('FETCHING USER FROM:', `${apiBaseUrl}/api/v1/users/me`);

        // Fetch User Info
        const userRes = await fetch(`${apiBaseUrl}/api/v1/users/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        console.error('USER RES STATUS:', userRes.status);
        if (!userRes.ok) throw new Error(`Failed to fetch user: ${userRes.status}`);
        const userData = await userRes.json();
        if (!active) return;
        setUser(userData.data);
        console.error('USER SET SUCCESS');

        // Fetch Settings Info
        const settingsRes = await fetch(`${apiBaseUrl}/api/v1/users/settings`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        console.error('SETTINGS RES STATUS:', settingsRes.status);
        if (!settingsRes.ok) throw new Error(`Failed to fetch settings: ${settingsRes.status}`);
        const settingsData = await settingsRes.json();
        if (!active) return;
        setSettings(settingsData.data);
        console.error('SETTINGS SET SUCCESS');

        const s = settingsData.data;
        if (s?.profile && typeof s.profile === 'object') {
          const profile = s.profile as Record<string, unknown>;
          if (profile.targetRole) setTargetRole(profile.targetRole as string);
          if (profile.experienceLevel) setExperienceLevel(profile.experienceLevel as string);
        }
        if (s?.notifications && typeof s.notifications === 'object') {
          const notifs = s.notifications as Record<string, unknown>;
          if (typeof notifs.dailyReminder === 'boolean') setDailyReminder(notifs.dailyReminder as boolean);
          if (typeof notifs.weeklyReport === 'boolean') setWeeklyReport(notifs.weeklyReport as boolean);
        }
      } catch (err) {
        console.error('Failed to load in SettingsPage:', err);
      } finally {
        if (active) {
          console.error('SETTING LOADING TO FALSE');
          setLoading(false);
        }
      }
    }

    if (clerkLoaded && isSignedIn) {
      load();
    }

    return () => {
      active = false;
    };
  }, [clerkLoaded, isSignedIn, getToken]);

  async function handleSave() {
    setSaving(true);
    setMessage('');
    try {
      const token = await getToken();
      if (!token) throw new Error('No token found');

      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      const res = await fetch(`${apiBaseUrl}/api/v1/users/settings`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          profile: { targetRole, experienceLevel },
          notifications: { dailyReminder, weeklyReport },
        }),
      });

      if (!res.ok) throw new Error('Failed to save settings');
      const data = await res.json();
      setSettings(data.data);
      setMessage('Settings saved successfully!');
    } catch (err) {
      setMessage('Failed to save settings');
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  if (!clerkLoaded || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090b]">
        <div className="text-zinc-400">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link to="/dashboard" className="inline-flex items-center gap-2 font-bold text-lg">
            <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center text-black text-xs font-extrabold">P</div>
            PrepAI
          </Link>
          <Link to="/dashboard" className="text-sm text-zinc-400 hover:text-white transition-colors">Back to Dashboard</Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold mb-2">Settings</h1>
        <p className="text-zinc-400 mb-8">Test both User and UserSettings models</p>

        {/* User Model Info */}
        <section className="bg-[#18181b] border border-white/10 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 text-amber-400">User Model (MongoDB)</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-zinc-500">clerkUserId:</span>
              <p className="font-mono text-zinc-300 break-all">{user?.clerkUserId as string}</p>
            </div>
            <div>
              <span className="text-zinc-500">email:</span>
              <p className="text-zinc-300">{user?.email as string}</p>
            </div>
            <div>
              <span className="text-zinc-500">name:</span>
              <p className="text-zinc-300">{user?.name as string}</p>
            </div>
            <div>
              <span className="text-zinc-500">role:</span>
              <p className="text-zinc-300">{user?.role as string}</p>
            </div>
            <div>
              <span className="text-zinc-500">isNewUser:</span>
              <p className="text-zinc-300">{String(user?.isNewUser)}</p>
            </div>
            <div>
              <span className="text-zinc-500">DB id:</span>
              <p className="font-mono text-zinc-300">{user?.id as string}</p>
            </div>
          </div>
        </section>

        {/* UserSettings Model */}
        <section className="bg-[#18181b] border border-white/10 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 text-amber-400">UserSettings Model (MongoDB)</h2>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Target Role</label>
              <select
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                className="w-full px-3 py-2 bg-[#09090b] border border-white/10 rounded-lg text-sm text-white focus:border-amber-500 focus:outline-none"
              >
                <option value="">Select role</option>
                <option value="Frontend">Frontend</option>
                <option value="FullStack">FullStack</option>
                <option value="Backend">Backend</option>
                <option value="DevOps">DevOps</option>
                <option value="EngManager">Eng Manager</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Experience Level</label>
              <select
                value={experienceLevel}
                onChange={(e) => setExperienceLevel(e.target.value)}
                className="w-full px-3 py-2 bg-[#09090b] border border-white/10 rounded-lg text-sm text-white focus:border-amber-500 focus:outline-none"
              >
                <option value="">Select level</option>
                <option value="Junior">Junior</option>
                <option value="Mid">Mid</option>
                <option value="Senior">Senior</option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={dailyReminder}
                onChange={(e) => setDailyReminder(e.target.checked)}
                className="w-4 h-4 rounded border-white/20 bg-[#09090b] text-amber-500 focus:ring-amber-500"
              />
              <label className="text-sm text-zinc-300">Daily Practice Reminder</label>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={weeklyReport}
                onChange={(e) => setWeeklyReport(e.target.checked)}
                className="w-4 h-4 rounded border-white/20 bg-[#09090b] text-amber-500 focus:ring-amber-500"
              />
              <label className="text-sm text-zinc-300">Weekly Progress Report</label>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-amber-500 text-black font-semibold rounded-lg hover:bg-amber-400 transition-colors disabled:opacity-50 text-sm"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
            {message && (
              <span className={`text-sm ${message.includes('success') ? 'text-green-400' : 'text-red-400'}`}>
                {message}
              </span>
            )}
          </div>
        </section>

        {/* Raw JSON for debugging */}
        <section className="bg-[#18181b] border border-white/10 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4 text-zinc-400">Raw UserSettings JSON</h2>
          <pre className="text-xs text-zinc-400 bg-[#09090b] rounded-lg p-4 overflow-x-auto">
            {JSON.stringify(settings, null, 2)}
          </pre>
        </section>
      </main>
    </div>
  );
}
