import type { IAuthSession } from '@/service/auth';

export type SessionReaderResult = Pick<IAuthSession, 'isLoaded' | 'isSignedIn' | 'user'>;
