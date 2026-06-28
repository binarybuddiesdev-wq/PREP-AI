export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

export interface IUserPayload {
  id: string;
  clerkId: string;
  email: string;
  role: UserRole;
}
