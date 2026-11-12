export type IncidentStatus = 
  | 'recebida'
  | 'triagem'
  | 'andamento'
  | 'aguardando_material'
  | 'resolvida'
  | 'indeferida';

export interface StatusHistoryItem {
  status: string;
  date: string;
  author: string;
  note: string;
  badge?: string;
}

export interface Incident {
  id: string;
  protocol: string;
  title: string;
  description: string;
  category: string;
  categoryLabel: string;
  icon: string;
  photoUrl: string;
  address: string;
  neighborhood: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  isUrgent: boolean;
  status: IncidentStatus;
  statusLabel: string;
  statusHistory: StatusHistoryItem[];
  upvotesCount: number;
  upvoters: string[];
  createdAt: string;
  updatedAt: string;
  userId: string;
  userEmail: string;
  userName: string;
  currentActionStep: string;
  actionIcon?: string;
}

export type UserRole = 'cidadao' | 'agente' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl: string;
  neighborhood: string;
  phone?: string;
  soundEffectsEnabled: boolean;
  termsAccepted: boolean;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  subtitle: string;
  icon: string;
  count?: number;
}
