import { UserButton } from '@clerk/clerk-react';

export const UserMenu = () => (
  <UserButton
    appearance={{
      elements: {
        avatarBox: 'w-[34px] h-[34px]',
      },
    }}
  />
);
