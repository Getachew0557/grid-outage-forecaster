import { create } from 'zustand';
import { User, BusinessType } from '../types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const MOCK_USERS: Record<string, { password: string; user: User }> = {
  'admin@gridforecast.rw': { 
    password: 'Admin123!', 
    user: { id: '1', name: 'Admin User', email: 'admin@gridforecast.rw', role: 'SUPER_ADMIN' } 
  },
  'salon@demo.rw': { 
    password: 'demo123', 
    user: { id: '2', name: 'Salon Owner', email: 'salon@demo.rw', role: 'BUSINESS_OWNER', businessType: 'salon' } 
  },
  'coldroom@demo.rw': { 
    password: 'demo123', 
    user: { id: '3', name: 'Cold Room Owner', email: 'coldroom@demo.rw', role: 'BUSINESS_OWNER', businessType: 'cold_room' } 
  },
  'tailor@demo.rw': { 
    password: 'demo123', 
    user: { id: '4', name: 'Tailor Owner', email: 'tailor@demo.rw', role: 'BUSINESS_OWNER', businessType: 'tailor' } 
  },
};

export const useAuthStore = create<AuthState>((set) => ({
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  isAuthenticated: !!localStorage.getItem('user'),
  login: async (email, password) => {
    const mockUser = MOCK_USERS[email];
    if (mockUser && mockUser.password === password) {
      localStorage.setItem('user', JSON.stringify(mockUser.user));
      set({ user: mockUser.user, isAuthenticated: true });
      return true;
    }
    return false;
  },
  logout: () => {
    localStorage.removeItem('user');
    set({ user: null, isAuthenticated: false });
  },
}));
