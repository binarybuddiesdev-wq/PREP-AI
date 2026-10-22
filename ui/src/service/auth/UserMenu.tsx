import { UserButton } from '@clerk/clerk-react';

export const UserMenu = () => (
  <UserButton
    appearance={{
      elements: {
        avatarBox: 'w-9 h-9',
      },
    }}
  />
);
