export interface IUser {
  id: string;
  clerkUserId: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  role: string;
  isNewUser: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface IUserProfile {
  targetRole?: string;
  experienceLevel?: string;
  [key: string]: unknown;
}

export interface IUserNotifications {
  dailyReminder?: boolean;
  weeklyReport?: boolean;
  [key: string]: unknown;
}

export interface IUserSettings {
  id: string;
  userId: string;
  profile: IUserProfile | null;
  preferences: Record<string, unknown> | null;
  notifications: IUserNotifications | null;
}

export interface IUpdateSettingsBody {
  profile?: IUserProfile;
  preferences?: Record<string, unknown>;
  notifications?: IUserNotifications;
}

export interface ISettingsFormValues {
  targetRole: string;
  experienceLevel: string;
  dailyReminder: boolean;
  weeklyReport: boolean;
}

export interface ISettingsSaveStatus {
  kind: 'success' | 'error';
  message: string;
}

export interface ISelectOption {
  value: string;
  label: string;
}
