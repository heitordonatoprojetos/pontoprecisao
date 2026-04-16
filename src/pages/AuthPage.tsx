import { useState } from 'react';
import { Clock, Mail, Lock, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    const { error } = isLogin
      ? await signIn(email, password)
      : await signUp(email, password);

    if (error) {
      setError(error.message);
    } else if (!isLogin) {
      setSuccess('Conta criada! Verifique seu email para confirmar.');
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="mb-8 flex flex-col items-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground mb-3">
          <Clock className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold">Ponto Precisão</h1>
        <p className="text-sm text-muted-foreground mt-1">Controle de ponto pessoal</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email"
            required
            className="w-full rounded-xl border border-input bg-background py-3 pl-10 pr-4 text-sm"
          />
        </div>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Senha"
            required
            minLength={6}
            className="w-full rounded-xl border border-input bg-background py-3 pl-10 pr-4 text-sm"
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {success && <p className="text-sm text-success">{success}</p>}

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {isLogin ? 'Entrar' : 'Criar conta'}
        </button>

        <p className="text-center text-sm text-muted-foreground">
          {isLogin ? 'Não tem conta? ' : 'Já tem conta? '}
          <button type="button" onClick={() => { setIsLogin(!isLogin); setError(''); setSuccess(''); }} className="text-primary font-medium">
            {isLogin ? 'Criar conta' : 'Entrar'}
          </button>
        </p>
      </form>
    </div>
  );
}
