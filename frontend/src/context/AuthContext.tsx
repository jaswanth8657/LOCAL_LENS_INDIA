import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  UserAuthData,
  UserProfileData,
  registerAPI,
  loginAPI,
  logoutAPI,
  fetchProfileAPI,
  updateProfileAPI,
  getAuthToken,
} from '../api/client';
import { useTheme } from './ThemeContext';

interface AuthContextType {
  user: UserAuthData | null;
  profile: UserProfileData | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (emailOrUsername: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, confirmPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<UserProfileData>) => Promise<UserProfileData>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setTokenState] = useState<string | null>(getAuthToken());
  const [user, setUser] = useState<UserAuthData | null>(null);
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { setTheme } = useTheme();

  const syncProfileState = (prof: UserProfileData) => {
    setProfile(prof);
    setUser({
      id: prof.id,
      username: prof.username,
      email: prof.email,
      name: prof.name || prof.username,
    });
    if (prof.theme_preference === 'light' || prof.theme_preference === 'dark') {
      setTheme(prof.theme_preference);
    }
  };

  const refreshProfile = async () => {
    const curToken = getAuthToken();
    if (!curToken) {
      setUser(null);
      setProfile(null);
      setIsLoading(false);
      return;
    }
    try {
      const prof = await fetchProfileAPI();
      if (prof) {
        syncProfileState(prof);
      } else {
        setUser(null);
        setProfile(null);
        setTokenState(null);
      }
    } catch {
      setUser(null);
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshProfile();
  }, []);

  const login = async (emailOrUsername: string, password: string): Promise<void> => {
    setIsLoading(true);
    try {
      const res = await loginAPI({ email_or_username: emailOrUsername, password });
      setTokenState(res.token);
      syncProfileState(res.profile);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string, confirmPassword: string): Promise<void> => {
    setIsLoading(true);
    try {
      const res = await registerAPI({
        name,
        email,
        password,
        confirm_password: confirmPassword,
      });
      setTokenState(res.token);
      syncProfileState(res.profile);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await logoutAPI();
    } finally {
      setTokenState(null);
      setUser(null);
      setProfile(null);
      setIsLoading(false);
    }
  };

  const updateProfile = async (data: Partial<UserProfileData>): Promise<UserProfileData> => {
    const updated = await updateProfileAPI(data);
    syncProfileState(updated);
    return updated;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        register,
        logout,
        updateProfile,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
