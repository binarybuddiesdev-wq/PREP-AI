import { Link } from 'react-router';
import type { IDashboardActionsProps } from './DashboardActions.types';

export const DashboardActions = (props: IDashboardActionsProps) => {
  const { settingsTo, onSignOut } = props;

  return (
    <div className="mt-8 flex gap-4">
      <Link
        to={settingsTo}
        className="px-4 py-2 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg hover:bg-amber-500/20 transition-colors text-sm font-medium"
      >
        Settings
      </Link>
      <button
        type="button"
        onClick={onSignOut}
        className="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors text-sm font-medium"
      >
        Sign Out
      </button>
    </div>
  );
};
