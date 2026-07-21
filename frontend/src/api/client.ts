const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export type Skill = {
  id: string;
  subject: string;
  name: string;
  difficulty: number;
  prerequisites: string[];
  objectives: string[];
};

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem('nexus_token');
  const response = await fetch(`${API_URL}/api/v1${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function demoLogin() {
  const email = 'explorer@nexus.local';
  const password = 'nexus-demo';
  try {
    return await api<{ access_token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, role: 'learner' }),
    });
  } catch {
    return api<{ access_token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }
}

