import type { IUserModelCardProps } from './UserModelCard.types';

export const UserModelCard = (props: IUserModelCardProps) => {
  const { user } = props;
  const rows: { label: string; value: string | undefined; isMonospace?: boolean }[] = [
    { label: 'clerkUserId', value: user?.clerkUserId, isMonospace: true },
    { label: 'email', value: user?.email },
    { label: 'name', value: user?.name },
    { label: 'role', value: user?.role },
    { label: 'isNewUser', value: user ? String(user.isNewUser) : undefined },
    { label: 'DB id', value: user?.id, isMonospace: true },
  ];

  return (
    <section className="bg-[#18181b] border border-white/10 rounded-xl p-6 mb-6">
      <h2 className="text-lg font-semibold mb-4 text-amber-400">User Model (MongoDB)</h2>
      <div className="grid grid-cols-2 gap-4 text-sm">
        {rows.map((row) => (
          <div key={row.label}>
            <span className="text-zinc-500">{row.label}:</span>
            <p className={`text-zinc-300 break-all${row.isMonospace ? ' font-mono' : ''}`}>
              {row.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
};
