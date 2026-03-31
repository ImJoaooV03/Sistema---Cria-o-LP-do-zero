import React, { useState } from 'react';
import { auth, googleProvider } from '../firebase';
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { Scale, Loader2, Mail, Lock, ArrowRight } from 'lucide-react';

export function LoginScreen() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
        console.log('Login popup closed or cancelled.');
      } else {
        console.error('Login error:', error);
        setError('Erro ao fazer login com Google. Tente novamente.');
      }
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Preencha todos os campos.');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      if (isRegistering) {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(userCred.user);
        setError('Conta criada! Verifique seu email para ativar o acesso de administrador.');
      } else {
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        if (userCred.user.email === 'joaovicrengel@gmail.com' && !userCred.user.emailVerified) {
          await sendEmailVerification(userCred.user);
          setError('Sua conta de administrador precisa ser verificada. Um email de verificação foi enviado.');
        }
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Email ou senha incorretos.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Este email já está em uso.');
      } else if (err.code === 'auth/weak-password') {
        setError('A senha deve ter pelo menos 6 caracteres.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('Login por email/senha não está ativado. Ative-o no Console do Firebase (Authentication > Sign-in method).');
      } else {
        setError('Ocorreu um erro na autenticação.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#050505] text-white font-sans overflow-hidden">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 border-r border-white/5 bg-[#0A0A0A]">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] rounded-full bg-[#d4af37]/5 blur-[120px]"></div>
          <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-[#d4af37]/5 blur-[100px]"></div>
        </div>
        
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#d4af37] rounded flex items-center justify-center text-[#0f172a]">
            <Scale className="w-6 h-6" />
          </div>
          <div className="flex flex-col">
            <span className="font-serif text-2xl font-semibold tracking-tight leading-none">Aura<span className="text-[#d4af37] italic">Law</span></span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-white/40 mt-1">Studio</span>
          </div>
        </div>

        <div className="relative z-10 max-w-md">
          <h2 className="text-4xl font-serif leading-tight mb-6">
            O futuro do design jurídico está aqui.
          </h2>
          <p className="text-white/50 text-lg leading-relaxed mb-8">
            Crie landing pages de alta conversão e extraia design systems completos em segundos com o poder da inteligência artificial.
          </p>
          <div className="flex items-center gap-4 text-sm text-white/40">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#d4af37]"></div>
              Design Inteligente
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#d4af37]"></div>
              Alta Conversão
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#d4af37]"></div>
              Exclusivo
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 relative">
        <div className="max-w-md w-full">
          <div className="lg:hidden flex items-center gap-3 mb-12 justify-center">
            <div className="w-10 h-10 bg-[#d4af37] rounded flex items-center justify-center text-[#0f172a]">
              <Scale className="w-6 h-6" />
            </div>
            <div className="flex flex-col">
              <span className="font-serif text-2xl font-semibold tracking-tight leading-none">Aura<span className="text-[#d4af37] italic">Law</span></span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-white/40 mt-1">Studio</span>
            </div>
          </div>

          <div className="mb-10 text-center lg:text-left">
            <h1 className="text-3xl font-serif mb-3">
              {isRegistering ? 'Criar sua conta' : 'Bem-vindo de volta'}
            </h1>
            <p className="text-white/50">
              {isRegistering 
                ? 'Preencha os dados abaixo para acessar o estúdio.' 
                : 'Insira suas credenciais para acessar seus projetos.'}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleEmailAuth} className="space-y-5 mb-8">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/70 block">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-white/30" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:border-[#d4af37]/50 focus:ring-1 focus:ring-[#d4af37]/50 transition-all"
                  placeholder="seu@email.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-white/70 block">Senha</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-white/30" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:border-[#d4af37]/50 focus:ring-1 focus:ring-[#d4af37]/50 transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-[#d4af37] text-[#0f172a] rounded-xl text-sm font-bold hover:bg-[#b4941f] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-2"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {isRegistering ? 'Criar Conta' : 'Entrar no Estúdio'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="relative mb-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-[#050505] text-white/40">ou continue com</span>
            </div>
          </div>

          <button 
            onClick={handleGoogleLogin}
            type="button"
            className="w-full py-3.5 bg-white text-[#0f172a] rounded-xl text-sm font-semibold hover:bg-gray-200 transition-all flex items-center justify-center gap-3"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Google
          </button>

          <div className="mt-8 text-center">
            <button 
              onClick={() => {
                setIsRegistering(!isRegistering);
                setError('');
              }}
              className="text-sm text-white/50 hover:text-white transition-colors"
            >
              {isRegistering 
                ? 'Já tem uma conta? Faça login' 
                : 'Não tem uma conta? Cadastre-se'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
