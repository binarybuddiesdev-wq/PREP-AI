import { useUser, useClerk, UserButton } from '@clerk/clerk-react';
import { useEffect } from 'react';
import { Link } from 'react-router';
import { useApiClient, getMe } from '@/lib/api';

export default function DashboardPage() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const api = useApiClient();

  useEffect(() => {
    const syncUser = async () => {
      try {
        const data = await getMe(api);
        console.log('User synced with backend:', data);
      } catch (error) {
        console.error('Error syncing user with backend:', error);
      }
    };

    if (isLoaded && user) {
      syncUser();
    }
  }, [isLoaded, user, api]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090b]">
        <div className="text-zinc-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 font-bold text-lg">
            <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center text-black text-xs font-extrabold">
              P
            </div>
            PrepAI
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-400">{user?.emailAddresses[0]?.emailAddress}</span>
            <UserButton
              appearance={{
                elements: {
                  avatarBox: 'w-9 h-9',
                },
              }}
            />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold mb-2">
          Welcome, {user?.firstName || user?.emailAddresses[0]?.emailAddress}
        </h1>
        <p className="text-zinc-400 mb-8">You&apos;re signed in. This is your dashboard.</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#18181b] border border-white/10 rounded-xl p-6">
            <h3 className="font-semibold mb-1">User ID</h3>
            <p className="text-sm text-zinc-400 font-mono break-all">{user?.id}</p>
          </div>
          <div className="bg-[#18181b] border border-white/10 rounded-xl p-6">
            <h3 className="font-semibold mb-1">Email</h3>
            <p className="text-sm text-zinc-400">{user?.emailAddresses[0]?.emailAddress}</p>
          </div>
          <div className="bg-[#18181b] border border-white/10 rounded-xl p-6">
            <h3 className="font-semibold mb-1">Account Created</h3>
            <p className="text-sm text-zinc-400">
              {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
            </p>
          </div>
        </div>

        <div className="mt-8 flex gap-4">
          <Link
            to="/settings"
            className="px-4 py-2 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg hover:bg-amber-500/20 transition-colors text-sm font-medium"
          >
            Settings
          </Link>
          <button
            onClick={() => signOut()}
            className="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors text-sm font-medium"
          >
            Sign Out
          </button>
        </div>
      </main>
    </div>
  );
}
