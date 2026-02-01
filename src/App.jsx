import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import {
  Brain, Zap, Search, Shield, Clock, Filter, Play, Menu, X, Check, ChevronRight,
  Coffee, BookOpen, Video, HelpCircle, Mail, Lock, Cpu, Wifi, Activity, Mic, MicOff,
  AlertTriangle, Radio, CreditCard, BarChart2, TrendingUp, User, LogOut, Sparkles, FileText, Users, Send
} from 'lucide-react';

// ============================================
// CONFIGURAZIONE SISTEMA
// ============================================
const SYSTEM_CONFIG = {
  OPENROUTER_KEY: import.meta.env.VITE_OPENROUTER_API_KEY || "",
  YOUTUBE_KEY: import.meta.env.VITE_YOUTUBE_API_KEY || "",
  USE_AI: true,
  FALLBACK_VIDEO_ID: "Y9EjnBmO2Jw",
  SYSTEM_FAILURE: false, // Flag for error testing
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  STRIPE_KEY: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
};

import { supabase } from './lib/supabase';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = SYSTEM_CONFIG.STRIPE_KEY ? loadStripe(SYSTEM_CONFIG.STRIPE_KEY) : null;

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md">
          <div className="bg-red-900 border-2 border-red-500 rounded-xl p-8 max-w-2xl text-white shadow-[0_0_50px_rgba(239,68,68,0.5)]">
            <h2 className="text-3xl font-black mb-4 flex items-center gap-3"><AlertTriangle className="w-8 h-8" /> SYSTEM FAILURE</h2>
            <div className="bg-black/50 p-4 rounded-lg font-mono text-sm mb-6 text-red-200 overflow-auto max-h-60">
              {this.state.error && this.state.error.toString()}
              <br />
              {this.state.errorInfo && this.state.errorInfo.componentStack}
            </div>
            <button onClick={() => window.location.reload()} className="w-full py-4 bg-red-600 hover:bg-red-700 font-bold rounded-lg transition-all">
              RIAVVIA IL SISTEMA (RELOAD)
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}



// ============================================
// USER CONTEXT (Gestione Protocolli con localStorage)
// ============================================
const UserContext = createContext();

const STORAGE_KEY = 'synapse_user_data';

const getStoredData = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch (e) { }
  return null;
};

const UserProvider = ({ children }) => {
  const stored = getStoredData();
  const [protocol, setProtocol] = useState(stored?.protocol || 'GUEST');
  const [credits, setCredits] = useState(stored?.credits ?? 5);
  const [showPayment, setShowPayment] = useState(false);
  const [currentView, setCurrentView] = useState(stored?.protocol === 'PRO' ? 'PRO_DASHBOARD' : 'LANDING');
  const [userData, setUserData] = useState(stored?.userData || { name: 'Ospite', xp: 0, hours: 0, streak: 0, email: '' });

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ protocol, credits, userData }));
  }, [protocol, credits, userData]);

  // Daily credit reset for Core
  useEffect(() => {
    const lastReset = localStorage.getItem('synapse_credit_reset');
    const today = new Date().toDateString();
    if (protocol === 'CORE' && lastReset !== today) {
      setCredits(5);
      localStorage.setItem('synapse_credit_reset', today);
    }
  }, [protocol]);

  const [session, setSession] = useState(null);

  // Supabase Auth Sync
  useEffect(() => {
    if (!supabase) return;
    const checkUser = (session) => {
      // Check for Dev Bypass
      const isBypass = localStorage.getItem('synapse_dev_bypass') === 'true';
      if (isBypass) {
        setProtocol('PRO');
        setUserData(p => ({ ...p, name: 'Sviluppatore (Force)', email: 'dev@synapse.os' }));
        return;
      }

      if (session) {
        if (session.user.email === 'chridipi04@gmail.com') {
          setProtocol('PRO');
          setUserData(p => ({ ...p, name: 'Sviluppatore', email: session.user.email }));
        } else {
          setProtocol('CORE');
          setUserData(p => ({ ...p, name: session.user.email.split('@')[0], email: session.user.email }));
        }
      } else {
        setProtocol('GUEST');
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      checkUser(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      checkUser(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const upgradeToCore = () => {
    // Now handled by Auth
    setShowAuth(true); // Trigger Auth Modal
  };

  const upgradeToPro = () => {
    if (!session) { setShowAuth(true); return; }
    // In real app, this waits for Stripe webhook. Here we simulate optimistic update after successful payment logic.
    setProtocol('PRO');
    setUserData(prev => ({ ...prev, name: 'Scholar Pro', hours: prev.hours || 0 }));
    setShowPayment(false);
    setCurrentView('PRO_DASHBOARD');
  };

  const logout = async () => {
    if (supabase) await supabase.auth.signOut();
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('synapse_dev_bypass'); // Clear the bypass flag
    setProtocol('GUEST');
    setSession(null);
    setCurrentView('LANDING');
    window.location.reload(); // Force reload to ensure clean state
  };

  const [showAuth, setShowAuth] = useState(false);

  const addXP = (amount) => setUserData(prev => ({ ...prev, xp: (prev.xp || 0) + amount }));
  const addHours = (amount) => setUserData(prev => ({ ...prev, hours: (prev.hours || 0) + amount }));

  return (
    <UserContext.Provider value={{
      protocol, credits, setCredits, showPayment, setShowPayment,
      userData, setUserData, upgradeToCore, upgradeToPro,
      currentView, setCurrentView, logout, showAuth, setShowAuth,
      addXP, addHours
    }}>
      {children}
    </UserContext.Provider>
  );
};


const useUser = () => useContext(UserContext);

// ============================================
// VFX LAYER
// ============================================
const VFXLayer = () => (
  <>
    <div className="fixed inset-0 pointer-events-none z-50" style={{ background: `repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)` }} />
    <div className="fixed inset-0 pointer-events-none z-40" style={{ background: `radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.6) 100%)` }} />
  </>
);

// ============================================
// COMPONENTI UI BASE
// ============================================
const GlitchText = ({ children, className = '' }) => (
  <span className={`glitch-text ${className}`} data-text={children}>{children}</span>
);

const HUDCard = ({ children, className = '', hoverGlow = true, locked = false, style = {} }) => (
  <div className={`hud-card relative bg-slate-900/40 border border-white/5 ${className} ${hoverGlow && !locked ? 'hover:border-[#8b5cf6]/50' : ''} ${locked ? 'opacity-80' : ''}`}
    style={{ backgroundImage: `linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)`, backgroundSize: '20px 20px', ...style }}>
    <div className="hud-corner hud-corner-tl" /><div className="hud-corner hud-corner-tr" />
    <div className="hud-corner hud-corner-bl" /><div className="hud-corner hud-corner-br" />
    {locked && (
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-10 flex flex-col items-center justify-center border border-white/10">
        <Lock className="w-8 h-8 text-slate-500 mb-2" />
        <span className="font-mono text-xs text-slate-400 uppercase tracking-widest">Accesso Limitato</span>
        <span className="font-mono text-[10px] text-[#f43f5e] mt-1">RICHIESTO UPGRADE PROTOCOLLO</span>
      </div>
    )}
    {children}
  </div>
);

const MagneticButton = ({ children, className = '', onClick, disabled, ...props }) => {
  const buttonRef = useRef(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const handleMouseMove = (e) => {
    if (!buttonRef.current || disabled) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setOffset({ x: (e.clientX - rect.left - rect.width / 2) * 0.2, y: (e.clientY - rect.top - rect.height / 2) * 0.2 });
  };
  return (
    <button ref={buttonRef} onMouseMove={handleMouseMove} onMouseLeave={() => setOffset({ x: 0, y: 0 })} onClick={onClick} disabled={disabled}
      className={`transition-transform duration-200 ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }} {...props}>
      {children}
    </button>
  );
};

// ============================================
// NEURAL VOID (Background)
// ============================================
const NeuralVoid = () => (
  <div className="fixed inset-0 pointer-events-none">
    <div className="absolute inset-0 bg-[#020617]" />
    <div className="absolute inset-0 opacity-20" style={{ background: 'radial-gradient(circle at 50% 50%, #8b5cf6 0%, transparent 50%)', filter: 'blur(100px)' }} />
    <div className="absolute top-0 left-0 w-full h-full opacity-10" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%239C92AC\' fill-opacity=\'0.2\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }} />
  </div>
);

// ============================================
// HEADER (Landing)
// ============================================
const Header = () => {
  const { setShowAuth, protocol, userData, logout, setCurrentView } = useUser();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 py-6 px-6 backdrop-blur-md border-b border-white/5 bg-[#020617]/50">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Brain className="w-8 h-8 text-[#8b5cf6]" />
          <span className="text-2xl font-black text-white tracking-widest">SYNAPSE</span>
        </div>

        {protocol === 'GUEST' ? (
          <button onClick={() => setShowAuth(true)} className="px-4 py-2 md:px-6 bg-white/10 hover:bg-white/20 text-white font-bold text-xs md:text-base rounded-lg border border-white/10 transition-all whitespace-nowrap">
            ACCESSO NEURALE
          </button>
        ) : (
          <div className="flex items-center gap-2 md:gap-4">
            <div className="text-right hidden md:block">
              <div className="text-xs text-slate-400">BENTORNATO</div>
              <div className="text-sm font-bold text-white">{userData?.name || 'Utente'}</div>
            </div>
            {protocol === 'PRO' && (
              <button onClick={() => setCurrentView('PRO_DASHBOARD')} className="px-3 py-2 md:px-4 bg-[#8b5cf6] text-white font-bold text-[10px] md:text-xs rounded hover:bg-[#7c3aed]">
                DASHBOARD
              </button>
            )}
            <button onClick={logout} className="p-2 text-slate-400 hover:text-white" title="Esci">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

// ============================================
// NEURAL CANVAS
// ============================================
const NeuralCanvas = () => {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const nodesRef = useRef([]);
  const animationRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let width = window.innerWidth, height = window.innerHeight;

    const resize = () => { width = window.innerWidth; height = window.innerHeight; canvas.width = width; canvas.height = height; initNodes(); };
    const initNodes = () => {
      const count = Math.floor((width * height) / 12000);
      nodesRef.current = Array.from({ length: count }, () => ({
        x: Math.random() * width, y: Math.random() * height, baseX: Math.random() * width, baseY: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4, radius: Math.random() * 2 + 1.5,
        opacity: 0.3 + Math.random() * 0.5, pulsePhase: Math.random() * Math.PI * 2, pulseSpeed: 0.01 + Math.random() * 0.02,
      }));
    };
    const handleMouseMove = (e) => { mouseRef.current = { x: e.clientX, y: e.clientY }; };
    const animate = () => {
      ctx.fillStyle = '#020617'; ctx.fillRect(0, 0, width, height);
      const nodes = nodesRef.current, mouse = mouseRef.current;
      nodes.forEach((node, i) => {
        node.pulsePhase += node.pulseSpeed;
        node.opacity = 0.3 + (Math.sin(node.pulsePhase) + 1) * 0.25;
        const dx = mouse.x - node.x, dy = mouse.y - node.y, dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 150 && dist > 0) { const force = (150 - dist) / 150; node.vx += (dx / dist) * force * 0.08; node.vy += (dy / dist) * force * 0.08; }
        node.vx += (node.baseX - node.x) * 0.002; node.vy += (node.baseY - node.y) * 0.002;
        node.x += node.vx; node.y += node.vy; node.vx *= 0.96; node.vy *= 0.96;
        if (node.x < 0 || node.x > width) node.vx *= -0.5; if (node.y < 0 || node.y > height) node.vy *= -0.5;
        node.x = Math.max(0, Math.min(width, node.x)); node.y = Math.max(0, Math.min(height, node.y));
        for (let j = i + 1; j < nodes.length; j++) {
          const other = nodes[j], distance = Math.sqrt((node.x - other.x) ** 2 + (node.y - other.y) ** 2);
          if (distance < 140) {
            const nearMouse = Math.sqrt((mouse.x - node.x) ** 2 + (mouse.y - node.y) ** 2) < 150 || Math.sqrt((mouse.x - other.x) ** 2 + (mouse.y - other.y) ** 2) < 150;
            ctx.beginPath(); ctx.moveTo(node.x, node.y); ctx.lineTo(other.x, other.y);
            ctx.strokeStyle = nearMouse ? '#06b6d4' : '#8b5cf6'; ctx.lineWidth = nearMouse ? 2 : 1;
            ctx.globalAlpha = (1 - distance / 140) * (nearMouse ? 0.8 : 0.3); ctx.stroke();
          }
        }
        ctx.globalAlpha = node.opacity; ctx.shadowBlur = 15; ctx.shadowColor = '#8b5cf6';
        ctx.beginPath(); ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2); ctx.fillStyle = '#8b5cf6'; ctx.fill(); ctx.shadowBlur = 0;
      });
      ctx.globalAlpha = 1; animationRef.current = requestAnimationFrame(animate);
    };
    resize(); window.addEventListener('resize', resize); window.addEventListener('mousemove', handleMouseMove); animate();
    return () => { window.removeEventListener('resize', resize); window.removeEventListener('mousemove', handleMouseMove); if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, []);
  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }} />;
};

// ============================================
// LIVE TICKER
// ============================================
const LiveTicker = () => {
  const messages = [
    '[LIVE] User_X99: Sessione "Fisica" completata (+200XP)',
    '[LIVE] Sistema: Database aggiornato con 400 nuovi video',
    '[LIVE] User_Anna: Ha sbloccato "Memory Lock Pro"',
    '[LIVE] User_Marco: Quiz Storia completato (98%)',
    '[LIVE] User_Sara: 5 ore di Deep Work questa settimana',
  ];
  return (
    <div className="fixed top-[72px] left-0 right-0 z-40 bg-[#020617]/80 backdrop-blur-sm border-b border-white/5 overflow-hidden">
      <div className="ticker-track flex">
        {[...messages, ...messages].map((msg, i) => (
          <span key={i} className="ticker-item font-mono text-xs text-slate-500 whitespace-nowrap px-8 py-2">
            <span className="text-[#10b981] mr-2">●</span>{msg}
          </span>
        ))}
      </div>
    </div>
  );
};

// ============================================
// SYSTEM HEADER
// ============================================
const SystemHeader = () => {
  const { protocol, userData, setShowPayment, currentView, setCurrentView, logout } = useUser();
  const [isScrolled, setIsScrolled] = useState(false);
  const [latency, setLatency] = useState(12);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    const interval = setInterval(() => setLatency(Math.floor(8 + Math.random() * 15)), 2000);
    return () => { window.removeEventListener('scroll', handleScroll); clearInterval(interval); };
  }, []);

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${isScrolled ? 'bg-slate-900/90 backdrop-blur-xl border-b border-white/5' : 'bg-transparent'}`}>
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-7 h-7 text-[#8b5cf6]" strokeWidth={1.5} />
          <GlitchText className="text-xl font-black text-white">SYNAPSE <span className="text-[#06b6d4] animate-pulse">[OS]</span></GlitchText>
        </div>
        <div className="flex items-center gap-2 md:gap-6">
          <div className="hidden md:flex items-center gap-2 font-mono text-xs uppercase text-[#10b981]"><Wifi className="w-3 h-3" /> RETE: SICURA</div>
          <div className="hidden md:flex items-center gap-2 font-mono text-xs uppercase text-slate-400"><Activity className="w-3 h-3" /> LATENZA: {latency}ms</div>
          {protocol === 'GUEST' ? (
            <MagneticButton onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
              className="px-4 py-2 bg-[#8b5cf6] text-white font-bold text-xs rounded hover:bg-[#7c3aed]">
              ACCEDI
            </MagneticButton>
          ) : (
            <div className="flex items-center gap-2 md:gap-3">
              {protocol === 'PRO' && (
                <>
                  <span className="hidden md:inline px-2 py-1 bg-[#8b5cf6]/20 text-[#8b5cf6] text-[10px] font-bold rounded border border-[#8b5cf6]/50">PRO</span>
                  <button onClick={() => setCurrentView(currentView === 'PRO_DASHBOARD' ? 'LANDING' : 'PRO_DASHBOARD')}
                    className="px-3 py-1 bg-[#8b5cf6] text-white text-[10px] md:text-xs font-bold rounded hover:bg-[#7c3aed] whitespace-nowrap">
                    {currentView === 'PRO_DASHBOARD' ? 'HOME' : 'DASHBOARD'}
                  </button>
                </>
              )}
              {protocol === 'CORE' && <span className="hidden md:inline px-2 py-1 bg-[#06b6d4]/20 text-[#06b6d4] text-[10px] font-bold rounded border border-[#06b6d4]/50">CORE</span>}
              <div className="text-right hidden md:block"><div className="text-xs text-white font-bold">{userData.name}</div></div>
              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-white/10 shrink-0"><User className="w-4 h-4 text-slate-400" /></div>
              {protocol === 'CORE' && <button onClick={() => setShowPayment(true)} className="px-3 py-1 bg-[#06b6d4] text-black text-xs font-bold rounded hover:bg-[#22d3ee]">UPGRADE</button>}
              <button onClick={logout} className="p-2 text-slate-500 hover:text-[#f43f5e] transition-colors" title="Logout"><LogOut className="w-4 h-4" /></button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

// ============================================
// PAYMENT MODAL
// ============================================
// ============================================
// AUTH MODAL (Login/Signup)
// ============================================
const AuthModal = () => {
  const { showAuth, setShowAuth, setProtocol, setUserData } = useUser();
  const [isLogin, setIsLogin] = useState(false); // Default to Signup as requested "Iscriviti la prima volta"
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!showAuth) return null;

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!supabase) throw new Error("Supabase non configurato (Mancano API Keys)");

      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        console.log("Login Success", data);
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data?.user && !data?.session) {
          setError("Controlla la tua email per confermare l'iscrizione!");
          return;
        }
        console.log("Signup Success", data);
      }
      setShowAuth(false);
    } catch (err) {
      console.error("Auth Error", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowAuth(false)} />
      <HUDCard className="w-full max-w-md p-8 bg-slate-900 border-[#06b6d4] shadow-[0_0_50px_rgba(6,182,212,0.2)] z-10">
        <button onClick={() => setShowAuth(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
        <h2 className="text-2xl font-black text-white mb-2 flex items-center gap-2">
          <User className="w-6 h-6 text-[#06b6d4]" /> {isLogin ? 'ACCESSO NEURALE' : 'CREA IDENTITÀ'}
        </h2>
        <p className="text-slate-400 text-sm mb-6 font-mono">
          {isLogin ? 'Bentornato nel sistema, Operatore.' : 'Registrati per avviare il protocollo Synapse.'}
        </p>

        {error && <div className="p-3 bg-red-500/20 border border-red-500/50 rounded mb-4 text-red-200 text-xs font-mono">{error}</div>}

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-500 mb-1 block">EMAIL</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded p-3 text-white focus:border-[#06b6d4] outline-none" required />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 mb-1 block">PASSWORD</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded p-3 text-white focus:border-[#06b6d4] outline-none" required />
          </div>
          <button disabled={loading} className="w-full py-4 bg-[#06b6d4] hover:bg-[#22d3ee] text-black font-bold rounded-xl transition-all flex items-center justify-center gap-2">
            {loading ? <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" /> : (isLogin ? 'LOGIN' : 'CREA ACCOUNT')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button type="button" onClick={() => setIsLogin(!isLogin)} className="text-slate-400 hover:text-white text-xs underline">
            {isLogin ? 'Non hai un account? Iscriviti' : 'Hai già un account? Accedi'}
          </button>
        </div>
      </HUDCard>
    </div>
  );
};

// ============================================
// STRIPE CHECKOUT UTILS
// ============================================
const StripeCheckout = ({ clientSecret }) => {
  const stripe = useStripe();
  const elements = useElements();
  const { upgradeToPro } = useUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message);
      setLoading(false);
      return;
    }

    // Confirm the payment
    const { error } = await stripe.confirmPayment({
      elements,
      clientSecret,
      confirmParams: {
        return_url: 'http://localhost:5173', // Redirects here after payment
      },
      redirect: 'if_required'
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      // Payment succeeded
      upgradeToPro();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto max-h-[60vh] pr-2 custom-scrollbar">
        <div className="mb-6">
          <label className="text-xs font-bold text-slate-500 mb-2 block">DETTAGLI CARTA</label>
          <div className="p-4 bg-slate-800 border border-slate-700 rounded-xl">
            <PaymentElement options={{ theme: 'night', layout: 'accordion' }} />
          </div>
        </div>
        {error && <div className="text-red-400 text-xs mb-4">{error}</div>}
        <div className="flex justify-between items-center border-t border-white/5 pt-4 mb-6"><span className="text-slate-400 text-sm">Totale</span><span className="text-xl font-bold text-white">€9.99</span></div>
      </div>
      <button disabled={!stripe || loading} className="w-full py-4 mt-4 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(139,92,246,0.5)] shrink-0">
        {loading ? 'ELABORAZIONE...' : 'PAGA ORA'}
      </button>
    </form>
  );
};

// ============================================
// PAYMENT MODAL (Stripe Aware)
// ============================================
const PaymentModal = () => {
  const { showPayment, setShowPayment, upgradeToPro } = useUser();
  const [clientSecret, setClientSecret] = useState(null);

  useEffect(() => {
    if (showPayment && SYSTEM_CONFIG.STRIPE_KEY) {
      // Fetch fetch client secret from our local node server
      console.log("Fetching Payment Intent...");
      fetch('http://localhost:4242/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
        .then(res => {
          if (!res.ok) throw new Error("Server Error");
          return res.json();
        })
        .then(data => {
          console.log("Secret received");
          setClientSecret(data.clientSecret);
        })
        .catch(err => {
          console.error("Payment Fetch Error", err);
          // Fallback for demo if server is dead
          // alert("Server Pagamenti Offline. Controlla che 'node server.js' sia attivo.");
        });
    }
  }, [showPayment]);

  if (!showPayment) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowPayment(false)} />
      <HUDCard className="w-full max-w-md p-8 bg-slate-900 border-[#8b5cf6] shadow-[0_0_50px_rgba(139,92,246,0.2)] z-10">
        <button onClick={() => setShowPayment(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
        <div className="flex items-center gap-3 mb-6"><CreditCard className="w-6 h-6 text-[#8b5cf6]" /><h3 className="text-xl font-bold text-white">UPGRADE SCHOLAR PRO</h3></div>

        {stripePromise && clientSecret ? (
          <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'night', labels: 'floating' } }}>
            <StripeCheckout clientSecret={clientSecret} />
          </Elements>
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 border-4 border-[#8b5cf6] border-t-transparent rounded-full animate-spin mx-auto mb-6" />
            <p className="text-white font-bold">Inizializzazione Stripe Sicuro...</p>
          </div>
        )}
      </HUDCard>
    </div>
  );
};

// ============================================
// TYPEWRITER HOOK
// ============================================
const useTypewriter = (lines, speed = 40, pauseBetween = 500) => {
  const [currentLine, setCurrentLine] = useState(0);
  const [currentChar, setCurrentChar] = useState(0);
  const [displayLines, setDisplayLines] = useState([]);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (currentLine >= lines.length) { setIsComplete(true); return; }
    const line = lines[currentLine];
    if (currentChar < line.length) {
      const timeout = setTimeout(() => { setDisplayLines((prev) => { const newLines = [...prev]; newLines[currentLine] = line.slice(0, currentChar + 1); return newLines; }); setCurrentChar(currentChar + 1); }, speed);
      return () => clearTimeout(timeout);
    } else {
      const timeout = setTimeout(() => { setCurrentLine(currentLine + 1); setCurrentChar(0); }, pauseBetween);
      return () => clearTimeout(timeout);
    }
  }, [currentLine, currentChar, lines, speed, pauseBetween]);
  return { displayLines, isComplete };
};

// ============================================
// HERO UNIT
// ============================================
const HeroUnit = () => {
  const { displayLines, isComplete } = useTypewriter([
    '> Inizializzazione Neural Uplink...',
    '> Ottimizzazione Protocolli di Memoria...',
    '> Sistema Pronto.',
  ], 30, 400);

  return (
    <section className="pt-40 pb-20 flex items-center justify-center px-6 relative" style={{ zIndex: 1 }}>
      <div className="absolute top-20 left-1/4 w-[500px] h-[500px] rounded-full animate-pulse" style={{ background: 'rgba(139, 92, 246, 0.1)', filter: 'blur(150px)' }} />
      <div className="absolute bottom-20 right-1/4 w-[400px] h-[400px] rounded-full animate-pulse" style={{ background: 'rgba(6, 182, 212, 0.1)', filter: 'blur(150px)', animationDelay: '1s' }} />
      <div className="max-w-4xl mx-auto text-center relative z-10">
        <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight mb-8">
          <GlitchText className="bg-gradient-to-r from-[#8b5cf6] to-[#06b6d4] bg-clip-text text-transparent">POTENZIA LA TUA MENTE.</GlitchText>
        </h1>
        <HUDCard className="mb-12 max-w-md mx-auto p-4 rounded-lg" hoverGlow={false}>
          <div className="font-mono text-sm text-slate-400 text-left">
            {displayLines.map((line, i) => (<div key={i} className={i === displayLines.length - 1 && isComplete ? 'text-[#10b981]' : ''}>{line}{i === displayLines.length - 1 && !isComplete && <span className="animate-pulse text-[#06b6d4]">█</span>}</div>))}
            {displayLines.length === 0 && <span className="animate-pulse text-[#06b6d4]">█</span>}
          </div>
        </HUDCard>
        <MagneticButton onClick={() => document.getElementById('simulator')?.scrollIntoView({ behavior: 'smooth' })}
          className="group px-10 py-5 bg-gradient-to-r from-[#8b5cf6] to-[#7c3aed] text-white font-bold text-lg rounded-xl hover:scale-105 shadow-[0_0_40px_rgba(139,92,246,0.5)] relative overflow-hidden">
          <span className="relative z-10 flex items-center gap-3"><Zap className="w-6 h-6" strokeWidth={1.5} />AVVIA</span>
          <div className="absolute inset-0 bg-gradient-to-r from-[#06b6d4] to-[#8b5cf6] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        </MagneticButton>
        <div className="mt-20 animate-bounce"><ChevronRight className="w-6 h-6 text-slate-500 rotate-90 mx-auto" strokeWidth={1.5} /></div>
      </div>
    </section>
  );
};

// ============================================
// VIDEO DATABASE & SIMULATION LOGIC
// ============================================
// ID Verificati & Quiz & Riassunti (Curati da Gemini 2 Flash)
const VIDEO_DATABASE = {
  'fisica': {
    id: 'Y9EjnBmO2Jw',
    title: 'I Principi della Dinamica (Hub Scuola)',
    summary: "STUDIO: La dinamica è la parte della fisica che studia come si muovono i corpi per effetto delle forze. \n1. Principio d'Inerzia: Se nessuna forza agisce su un corpo, esso mantiene il suo stato (quiete o moto rettilineo uniforme). \n2. Legge Fondamentale (F=ma): La forza è il prodotto tra massa e accelerazione. \n3. Azione e Reazione: A ogni forza corrisponde una forza uguale e contraria.",
    quiz: {
      question: "Quale principio afferma che F = m * a?",
      options: [{ text: "Primo Principio", correct: false }, { text: "Secondo Principio", correct: true }, { text: "Terzo Principio", correct: false }],
      hint: "È la legge fondamentale della dinamica che collega causa ed effetto."
    }
  },
  'napoleone': {
    id: '2U_YdZD5kkM',
    title: 'Napoleone Bonaparte - Sintesi Completa',
    summary: "BIOGRAFIA: Generale e Imperatore francese (1769-1821). \nASCESA: Sfruttò il caos post-rivoluzione. Famoso per le campagne d'Italia e d'Egitto. Autoproclamato Imperatore nel 1804. \nRIFORME: Introdusse il Codice Civile (basi diritto moderno). \nCADUTA: Disastrosa campagna di Russia (1812), sconfitto a Lipsia e Waterloo (1815). Esiliato a Sant'Elena.",
    quiz: {
      question: "In quale isola morì Napoleone in esilio?",
      options: [{ text: "Isola d'Elba", correct: false }, { text: "Sant'Elena", correct: true }, { text: "Corsica", correct: false }],
      hint: "Un'isola remota nell'Oceano Atlantico meridionale."
    }
  },
  'storia': {
    id: 'd_kS3x0lJ4k',
    title: 'La Prima Guerra Mondiale (In 5 minuti)',
    summary: "GRANDE GUERRA (1914-1918): Scatenata dall'attentato di Sarajevo. \nSCHIERAMENTI: Triplice Intesa (Francia, UK, Russia, poi Italia/USA) vs Imperi Centrali (Austria, Germania). \nCARATTERISTICHE: Guerra di trincea, logoramento, nuove armi (gas, aerei, carri). \nESITO: Crollo di 4 imperi, nascita di nuovi stati, riassetto dell'Europa con Versailles.",
    quiz: {
      question: "Quale evento fece scoppiare la guerra?",
      options: [{ text: "Invasione della Polonia", correct: false }, { text: "Attentato di Sarajevo", correct: true }, { text: "Presa della Bastiglia", correct: false }],
      hint: "L'assassinio dell'Arciduca Francesco Ferdinando."
    }
  },
  'chimica': {
    id: '?listType=search&list=Tavola+Periodica+Spiegazione+Semplice',
    title: 'La Tavola Periodica degli Elementi',
    summary: "STRUTTURA: Organizza gli elementi chimici ordinati per numero atomico (Z). \nGRUPPI E PERIODI: Le colonne (gruppi) hanno proprietà simili; le righe (periodi) indicano il livello energetico. \nCLASSIFICAZIONE: Metalli (sinistra), Non metalli (destra), Gas Nobili (ultima colonna, stabili). Fondamentale per prevedere le reazioni chimiche.",
    quiz: {
      question: "Come sono ordinati gli elementi nella tavola?",
      options: [{ text: "Per data di scoperta", correct: false }, { text: "Per numero atomico crescente", correct: true }, { text: "Alfabeticamente", correct: false }],
      hint: "Il numero di protoni nel nucleo decide la posizione."
    }
  },
  'matematica': {
    id: '?listType=search&list=Equazioni+Primo+Grado+Spiegazione',
    title: 'Equazioni Lineari (Algebra)',
    summary: "CONCETTO: Uguaglianza tra due espressioni verificata solo per certi valori (soluzioni). \nRISOLUZIONE: L'obiettivo è isolare la 'x'. \nPRINCIPI: \n1. Sommando/sottraendo la stessa quantità a entrambi i membri, il risultato non cambia. \n2. Moltiplicando/dividendo entrambi i membri per uno stesso numero (diverso da 0), l'equazione resta equivalente.",
    quiz: {
      question: "Qual è il primo passaggio per risolvere 2x + 5 = 15?",
      options: [{ text: "Dividere tutto per 2", correct: false }, { text: "Sottrarre 5 da entrambi i lati", correct: true }, { text: "Moltiplicare per x", correct: false }],
      hint: "Devi isolare il termine con la x spostando i numeri."
    }
  },
  'italiano': {
    id: 'fESdidM5j7s',
    title: 'La Divina Commedia in 10 minuti',
    summary: "OPERA: Poema allegorico in terzine incatenate. \nVIAGGIO: Dante attraversa i tre regni ultraterreni. \nINFERNO: Voragine a imbuto, pena del contrappasso. \nPURGATORIO: Montagna dove le anime espiano i peccati. \nPARADISO: Cieli concentrici di pura luce e beatitudine. \nGUIDE: Virgilio (Ragione), Beatrice (Teologia/Grazia).",
    quiz: {
      question: "Chi guida Dante attraverso l'Inferno?",
      options: [{ text: "Beatrice", correct: false }, { text: "Virgilio", correct: true }, { text: "San Pietro", correct: false }],
      hint: "Il sommo poeta latino autore dell'Eneide."
    }
  },
  'inglese': {
    id: 'M2K-kM2i_tQ',
    title: 'Inglese: Basi Fondamentali',
    summary: "GRAMMATICA BASE: \n1. Verbo To Be (Essere): I am, You are, He is. \n2. Ordine parole: Subject + Verb + Object (SVO). \n3. Present Simple: Per abitudini e verità generali (Add 's' for he/she/it). \nCONSIGLIO: La pratica dell'ascolto (listening) è cruciale quanto la grammatica.",
    quiz: {
      question: "Qual è la forma corretta?",
      options: [{ text: "He go to school", correct: false }, { text: "He goes to school", correct: true }, { text: "He going to school", correct: false }],
      hint: "Terza persona singolare richiede la 's' o 'es'."
    }
  },
};

const getTopicVideo = (topic) => {
  const query = topic.toLowerCase().trim();
  const searchKey = Object.keys(VIDEO_DATABASE).find(key => query.includes(key));

  if (searchKey) return VIDEO_DATABASE[searchKey];

  // FALLBACK INTELLIGENTE: YouTube Search Embed
  // Genera una ricerca dinamica se non abbiamo un ID specifico
  return {
    id: `?listType=search&list=${encodeURIComponent(topic + ' spiegazione scuola')}`,
    title: `Ricerca approfondita: ${topic}`,
    summary: `Generazione sintesi automatica per: ${topic}. L'argomento richiede un'analisi approfondita delle fonti video correlate. Consulta il video per i dettagli specifici e prendi appunti sui concetti chiave.`,
    quiz: {
      question: `Qual è il concetto principale riguardo "${topic}"?`,
      options: [
        { text: "Concetto A (Vedi Video)", correct: true },
        { text: "Concetto B", correct: false },
        { text: "Concetto C", correct: false }
      ],
      hint: "Guarda i primi 2 minuti del video per la risposta."
    }
  };
};

const getSimulatedResult = (topic) => {
  try {
    const video = getTopicVideo(topic);
    return {
      videoId: video.id,
      summary: video.summary || `Riassunto generato per ${topic}.`,
      notes: [
        `Concetti chiave su: ${topic || 'Argomento'}`,
        `Analisi approfondita di: ${video.title}`,
        'Sintesi dei punti fondamentali',
        'Collegamenti interdisciplinari rilevati'
      ],
      planner: [
        { time: '15:00', task: `Studio Intensivo: ${topic || 'Concetti Base'}`, details: 'Lettura e sottolineatura testo', duration: '45m' },
        { time: '15:45', task: 'Active Recall & Quiz', details: 'Test di autovalutazione', duration: '15m' },
        { time: '16:00', task: 'Analisi Video & Sintesi', details: 'Visione materiale multimediale', duration: '30m' },
      ],
      quiz: Array.isArray(video.quiz) ? video.quiz : [video.quiz] // Normalize to array
    };
  } catch (e) {
    console.error("Error generating simulated result:", e);
    return {
      videoId: 'Y9EjnBmO2Jw', // Fallback sicuro (Fisica)
      summary: "Errore durante il recupero dei dati. Riprova.",
      notes: ['Errore generazione note', 'Riprova più tardi'],
      planner: [],
      quiz: [{ question: 'Errore di sistema', options: [], hint: 'Riprova' }]
    };
  }
};

// ============================================
// CORE SIMULATOR (CUORE DEL SITO)
// ============================================
const CoreSimulator = () => {
  const { protocol, credits, setCredits, setShowPayment, addXP } = useUser();
  const [state, setState] = useState('INPUT');
  const [query, setQuery] = useState('');
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState([]);
  const [resultData, setResultData] = useState(getSimulatedResult('Introduzione'));
  const [isListening, setIsListening] = useState(false);
  const [quizAnswer, setQuizAnswer] = useState(null);
  const [showXP, setShowXP] = useState(false);
  const [apiError, setApiError] = useState(false);

  const startListening = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = 'it-IT';
      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onresult = (event) => { const transcript = event.results[0][0].transcript; setQuery(transcript); setTimeout(() => handleSubmit(null, transcript), 500); };
      recognition.start();
    } else { alert("Riconoscimento vocale non supportato in questo browser."); }
  };

  const handleSubmit = async (e, voiceQuery = null) => {
    e?.preventDefault();
    if (protocol === 'GUEST') { document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' }); return; }
    if (protocol === 'CORE' && credits <= 0) { setShowPayment(true); return; }
    if (protocol === 'CORE') setCredits(p => p - 1);

    const effectiveQuery = voiceQuery || query;
    if (voiceQuery) setQuery(voiceQuery); // Ensure state is synced

    setState('PROCESSING');
    setProgress(0);
    setLogs([]);
    setApiError(false);
  };

  // AI SIMULATION EFFECT
  useEffect(() => {
    if (state !== 'PROCESSING') return;

    const searchQuery = query;
    let isMounted = true;

    // Fake Progress Logs
    const logMessages = ['[INFO] Scansione 40.000 Fonti Accademiche...', '[INFO] Filtraggio Contenuti a Bassa Densità...', '[INFO] Generazione Mappe Neurali...'];
    let logIndex = 0;
    const logInt = setInterval(() => {
      if (logIndex < logMessages.length) {
        setLogs(p => [...p, logMessages[logIndex]]);
        logIndex++;
      }
      // Random system logs
      if (Math.random() > 0.7) {
        setLogs(prev => [...prev.slice(-4), ` [SYSTEM] ${['Analyzing patterns...', 'Decoding vector space...', 'Retrieving archives...', 'Synthesizing layout...'][Math.floor(Math.random() * 4)]}`]);
      }
    }, 600);

    const progInt = setInterval(() => {
      setProgress(p => {
        if (p >= 90) return p;
        return p + Math.floor(Math.random() * 5);
      });
    }, 200);

    const runSimulation = async () => {
      // 1. Check Static Database First (Fast Cache) but allow AI override if key is present
      // Actually, we want AI to take over unless it fails. 
      // But for specific static IDs (Fisica/Dante), users might prefer the "Perfect" curated content?
      // Let's Check: User said "Use Gemini for EVERY search". So we prefer AI.
      // But we can fallback to static if AI fails or for speed? 
      // Let's try AI first.

      try {
        if (!SYSTEM_CONFIG.OPENROUTER_KEY) throw new Error("No API Key");

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${SYSTEM_CONFIG.OPENROUTER_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:5176",
            "X-Title": "Synapse OS"
          },
          body: JSON.stringify({
            "model": "google/gemini-2.0-flash-001",
            "messages": [
              {
                "role": "system",
                "content": "You are Synapse OS, an advanced education interface. Analyze the user topic and return a STRICT JSON object (no markdown). Structure: { \"summary\": \"Comprehensive summary (8-10 sentences).\", \"notes\": [\"Point 1\", \"Point 2\", \"Point 3\"], \"videoSearchQuery\": \"${topic} documentario scuola\", \"quiz\": [ { \"question\": \"Q1?\", \"options\": [{\"text\":\"A\",\"correct\":false}, {\"text\":\"B\",\"correct\":true}, {\"text\":\"C\",\"correct\":false}], \"hint\": \"H1\" }, { \"question\": \"Q2?\", \"options\": [...], \"hint\": \"...\" }, { \"question\": \"Q3?\", \"options\": [...], \"hint\": \"...\" }, { \"question\": \"Q4?\", \"options\": [...], \"hint\": \"...\" }, { \"question\": \"Q5?\", \"options\": [...], \"hint\": \"...\" } ], \"planner\": [{\"time\":\"15:00\",\"task\":\"Deep Work\",\"details\":\"Study concept X and Y\",\"duration\":\"45m\"},{\"time\":\"16:00\",\"task\":\"Review\",\"details\":\"Test knowledge\",\"duration\":\"30m\"}] }. Notes: Quiz MUST have exactly 5 questions. Each question MUST have 3 options. Language: ITALIAN."
              },
              {
                "role": "user",
                "content": `Topic: ${searchQuery}`
              }
            ]
          })
        });

        const data = await response.json();
        if (!data.choices) throw new Error("Invalid API Response");

        // Clean potential markdown code blocks ```json ... ```
        let cleanContent = data.choices[0].message.content;
        if (cleanContent.startsWith('```')) {
          cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
        }

        const aiContent = JSON.parse(cleanContent);

        let finalVideoId = `?listType=search&list=${encodeURIComponent(aiContent.videoSearchQuery || searchQuery)}`;

        // Try YouTube API if Key is present
        if (SYSTEM_CONFIG.YOUTUBE_KEY) {
          try {
            const ytRes = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q=${encodeURIComponent(aiContent.videoSearchQuery || searchQuery)}&type=video&key=${SYSTEM_CONFIG.YOUTUBE_KEY}`);
            const ytData = await ytRes.json();
            if (ytData.items && ytData.items.length > 0) {
              finalVideoId = ytData.items[0].id.videoId;
            }
          } catch (ytErr) {
            console.error("YouTube API Failed:", ytErr);
          }
        }

        if (isMounted) {
          setResultData({
            videoId: finalVideoId,
            summary: aiContent.summary,
            notes: aiContent.notes,
            planner: aiContent.planner,
            quiz: Array.isArray(aiContent.quiz) ? aiContent.quiz : [aiContent.quiz]
          });
        }

      } catch (e) {
        console.error("AI GENERATION FAILED:", e);
        if (isMounted) {
          setLogs(prev => [...prev, " [ERROR] NEURAL LINK SEVERED", " [WARN] SWITCHING TO LOCAL CACHE..."]);
          // Fallback to static
          setResultData(getSimulatedResult(searchQuery));
        }
      } finally {
        if (isMounted) {
          setProgress(100);
          setTimeout(() => {
            setLogs(prev => [...prev, " [SUCCESS] DATA STREAM ESTABLISHED"]);
            setTimeout(() => setState('DASHBOARD'), 500);
          }, 500);
        }
      }
    };

    runSimulation();

    return () => {
      isMounted = false;
      clearInterval(logInt);
      clearInterval(progInt);
    };
  }, [state, query]);

  const [quizIndex, setQuizIndex] = useState(0);

  const handleQuizAnswer = (isCorrect) => {
    setQuizAnswer(isCorrect ? 'correct' : 'wrong');
    if (isCorrect) {
      setShowXP(true);
      addXP(200); // Add real XP
      setTimeout(() => setShowXP(false), 2000);
      // Next question delay
      setTimeout(() => {
        if (resultData?.quiz && quizIndex < resultData.quiz.length - 1) {
          setQuizIndex(p => p + 1);
          setQuizAnswer(null);
        }
      }, 1500);
    }
  };

  return (
    <section id="simulator" className="py-20 px-6 relative z-10">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4">CORE <span className="text-[#06b6d4]">SIMULATOR</span></h2>
          <p className="text-slate-400 font-mono text-sm">INTERFACCIA ELABORAZIONE NEURALE v2.0</p>
          {protocol === 'CORE' && <div className="mt-4 text-xs font-mono text-[#f43f5e]">CREDITI GIORNALIERI: {credits}</div>}
        </div>

        {state === 'INPUT' && (
          <form onSubmit={handleSubmit} className="max-w-2xl mx-auto relative">
            <HUDCard className="p-2 rounded-xl">
              <div className="flex items-center gap-3">
                <Search className="w-5 h-5 text-slate-500 ml-4" />
                <input type="text" value={query} onChange={e => setQuery(e.target.value)}
                  placeholder={protocol === 'GUEST' ? "Seleziona un Protocollo..." : "Es. Storia..."}
                  className="flex-1 px-4 py-4 bg-transparent text-white placeholder:text-slate-500 focus:outline-none font-mono" disabled={protocol === 'GUEST'} />
                <button type="button" onClick={startListening} disabled={protocol === 'GUEST'}
                  className={`p-3 rounded-lg transition-all ${isListening ? 'bg-[#f43f5e] text-white animate-pulse' : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'}`}>
                  {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>
                <button type="submit" className={`px-6 py-3 font-bold rounded-lg transition-all mr-2 ${protocol === 'GUEST' ? 'bg-slate-700 text-slate-400' : 'bg-[#06b6d4] text-black hover:bg-[#22d3ee]'}`}>
                  {protocol === 'GUEST' ? <Lock className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
                </button>
              </div>
            </HUDCard>
            {protocol === 'GUEST' && <div className="absolute top-full left-0 right-0 text-center mt-4 text-[#f43f5e] font-mono text-xs animate-pulse">SELEZIONE PROTOCOLLO RICHIESTA</div>}
          </form>
        )}

        {state === 'PROCESSING' && (
          <HUDCard className="max-w-2xl mx-auto p-8 rounded-2xl">
            <div className="flex items-center gap-3 mb-6"><Cpu className="w-6 h-6 text-[#8b5cf6] animate-pulse" /><span className="text-white font-semibold">ELABORAZIONE NEURALE...</span><span className="font-mono text-[#06b6d4]">{progress}%</span></div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden mb-6"><div className="h-full bg-gradient-to-r from-[#8b5cf6] to-[#06b6d4] transition-all" style={{ width: `${progress}%` }} /></div>
            <div className="font-mono text-xs space-y-1">{logs.map((l, i) => <div key={i} className={(l && typeof l === 'string' && l.includes('ERROR')) ? 'text-[#f43f5e]' : 'text-slate-400'}>{l}</div>)}</div>
          </HUDCard>
        )}

        {state === 'DASHBOARD' && resultData && (
          <div className="space-y-6">
            <div className="text-center mb-8"><button onClick={() => { setState('INPUT'); setQuizAnswer(null); }} className="font-mono text-xs text-slate-500 hover:text-[#06b6d4]">[RESET SIMULAZIONE]</button></div>
            <div className="grid md:grid-cols-4 gap-6">
              {/* Planner */}
              <HUDCard className="p-6 rounded-2xl">
                <div className="flex items-center gap-2 mb-6"><Clock className="w-5 h-5 text-[#8b5cf6]" /><h3 className="text-white font-bold">PLANNER</h3></div>
                <div className="pl-6 border-l-2 border-[#8b5cf6]/30 space-y-6">{resultData.planner?.map((x, i) => (
                  <div key={i} className="relative">
                    <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-[#8b5cf6] border-4 border-[#020617]" />
                    <div className="font-mono text-xs text-[#06b6d4] mb-1">{x.time}</div>
                    <div className="text-white text-sm font-bold">{x.task}</div>
                    {x.details && <div className="text-slate-400 text-xs mt-1 italic">"{x.details}"</div>}
                    <div className="text-slate-500 text-xs mt-1">{x.duration}</div>
                  </div>
                ))}</div>
              </HUDCard>

              {/* Summary Card (NEW) */}
              <HUDCard className="p-6 rounded-2xl">
                <div className="flex items-center gap-2 mb-6"><BookOpen className="w-5 h-5 text-[#f43f5e]" /><h3 className="text-white font-bold">RIASSUNTO</h3></div>
                <div className="text-sm text-slate-300 leading-relaxed font-light">
                  {resultData.summary}
                </div>
                <div className="mt-4 pt-4 border-t border-white/5">
                  <div className="text-xs text-[#f43f5e] font-mono">INTEL. ARTIFICIALE: 98% PRECISIONE</div>
                </div>
              </HUDCard>

              {/* Video Stream */}
              <HUDCard className="p-6 rounded-2xl">
                <div className="flex items-center gap-2 mb-6"><Video className="w-5 h-5 text-[#06b6d4]" /><h3 className="text-white font-bold">VIDEO STREAM</h3></div>
                <div className="aspect-video bg-black rounded-xl overflow-hidden mb-4">
                  <iframe
                    src={resultData.videoId?.startsWith('?')
                      ? `https://www.youtube.com/embed?${resultData.videoId.substring(1)}&origin=${window.location.origin}`
                      : `https://www.youtube.com/embed/${resultData.videoId || 'Y9EjnBmO2Jw'}?origin=${window.location.origin}`}
                    className="w-full h-full"
                    title="Video Educativo"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
                <div className="text-xs font-mono text-slate-400 mb-2">BIGNAMI NOTES:</div>
                <ul className="space-y-1">{resultData.notes?.map((n, i) => <li key={i} className="text-slate-300 text-sm flex gap-2"><span className="text-[#8b5cf6]">•</span>{n}</li>)}</ul>
              </HUDCard>

              {/* Active Recall (Multi-Step) */}
              <HUDCard className="p-6 rounded-2xl relative">
                <div className="flex items-center gap-2 mb-6"><Brain className="w-5 h-5 text-[#f43f5e]" /><h3 className="text-white font-bold">ACTIVE RECALL ({quizIndex + 1}/{resultData.quiz?.length || 1})</h3></div>

                {showXP && <div className="absolute top-4 right-4 text-[#f43f5e] font-black animate-bounce">+200 XP</div>}

                {resultData.quiz && resultData.quiz[quizIndex] ? (
                  <>
                    <div className="mb-6 text-sm font-medium">{resultData.quiz[quizIndex]?.question || "Caricamento..."}</div>
                    <div className="space-y-3">
                      {resultData.quiz[quizIndex]?.options?.map((opt, i) => (
                        <button key={i} onClick={() => handleQuizAnswer(opt.correct)}
                          className={`w-full p-4 rounded-xl border text-left transition-all ${quizAnswer === null
                            ? 'border-slate-700 hover:border-[#f43f5e] hover:bg-[#f43f5e]/10'
                            : opt.correct
                              ? 'border-green-500 bg-green-500/20 text-green-200'
                              : 'border-slate-800 opacity-50'
                            }`}>
                          {opt.text}
                        </button>
                      ))}
                    </div>
                    {quizAnswer === 'wrong' && <div className="mt-4 text-xs text-red-400">Riprova, concentrati sul video...</div>}
                    <div className="mt-6 pt-4 border-t border-slate-800 text-xs text-slate-500 italic">
                      HINT: {resultData.quiz[quizIndex].hint}
                    </div>
                  </>
                ) : (
                  <div className="text-slate-500">Nessun quiz disponibile.</div>
                )}
              </HUDCard>
            </div>
          </div>
        )
        }
      </div >
    </section >
  );
};

// ============================================
// FEATURE MODULES (Holographic Cards)
// ============================================
const FeatureModules = () => {
  const [tilt, setTilt] = useState({ x: 0, y: 0, id: null });
  const handleMouseMove = (e, id) => { const rect = e.currentTarget.getBoundingClientRect(); setTilt({ x: (e.clientX - rect.left - rect.width / 2) / 10, y: -(e.clientY - rect.top - rect.height / 2) / 10, id }); };

  const features = [
    { id: 1, icon: Clock, title: 'TIME DILATION', subtitle: 'Planner', description: 'Algoritmo che adatta lo studio al tuo ritmo circadiano.', color: '#8b5cf6' },
    { id: 2, icon: Filter, title: 'SIGNAL FILTER', subtitle: 'Video', description: 'Elimina rumore, intro e sponsor dai video educativi.', color: '#06b6d4' },
    { id: 3, icon: Brain, title: 'MEMORY LOCK', subtitle: 'Quiz', description: 'Interrogazioni adattive che rinforzano le sinapsi deboli.', color: '#8b5cf6' },
  ];

  return (
    <section className="py-20 px-6 relative" style={{ zIndex: 1 }}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16"><h2 className="text-3xl md:text-5xl font-black text-white mb-4">MODULI <span className="text-[#8b5cf6]">FEATURE</span></h2><p className="text-slate-400 font-mono text-sm uppercase">Componenti Interfaccia Olografica</p></div>
        <div className="grid md:grid-cols-3 gap-8" style={{ perspective: '1000px' }}>
          {features.map((f) => (
            <div key={f.id} onMouseMove={(e) => handleMouseMove(e, f.id)} onMouseLeave={() => setTilt({ x: 0, y: 0, id: null })}
              style={{ transform: tilt.id === f.id ? `rotateX(${tilt.y}deg) rotateY(${tilt.x}deg) scale(1.02)` : 'rotateX(0) rotateY(0) scale(1)', transformStyle: 'preserve-3d', transition: 'transform 0.1s ease-out' }}>
              <HUDCard className="p-8 rounded-2xl cursor-pointer h-full">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6" style={{ background: `${f.color}20`, boxShadow: `0 0 30px ${f.color}40` }}>
                  <f.icon className="w-8 h-8" style={{ color: f.color }} strokeWidth={1.5} />
                </div>
                <div className="font-mono text-xs text-slate-500 uppercase mb-1">{f.subtitle}</div>
                <h3 className="text-xl font-bold text-white mb-3">{f.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{f.description}</p>
              </HUDCard>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ============================================
// PARENTS DASHBOARD
// ============================================
const ParentsDashboard = () => {
  const { protocol, userData } = useUser();
  const locked = protocol !== 'PRO';

  return (
    <HUDCard className="p-8 rounded-2xl" locked={locked}>
      <div className="flex items-center gap-3 mb-6"><BarChart2 className="w-6 h-6 text-[#06b6d4]" /><h3 className="text-white font-bold">DASHBOARD GENITORI {locked && '[BLOCCATA]'}</h3></div>
      {!locked ? (
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="bg-slate-800/50 p-4 rounded-xl border border-white/5">
              <div className="text-slate-400 text-xs font-mono mb-1">ATTIVITÀ SETTIMANALE</div>
              <div className="text-3xl font-bold text-white">{userData.hours || 0} <span className="text-sm font-normal text-slate-500">ore</span></div>
              <div className="flex items-center gap-1 text-[#10b981] text-xs mt-2"><TrendingUp className="w-3 h-3" /> +{(userData.hours * 0.5).toFixed(1)}% vs settimana scorsa</div>
            </div>
            <div className="bg-slate-800/50 p-4 rounded-xl border border-white/5">
              <div className="text-slate-400 text-xs font-mono mb-1">PUNTEGGIO FOCUS</div>
              <div className="text-3xl font-bold text-white">{Math.min(10, (userData.xp / 500)).toFixed(1)} <span className="text-sm font-normal text-slate-500">/ 10</span></div>
              <div className="w-full h-1 bg-slate-700 rounded-full mt-3 overflow-hidden"><div className="h-full bg-[#06b6d4]" style={{ width: `${Math.min(100, (userData.xp / 500) * 10)}%` }} /></div>
            </div>
            <div className="bg-slate-800/50 p-4 rounded-xl border border-white/5">
              <div className="text-slate-400 text-xs font-mono mb-2">REPORT EMAIL</div>
              <div className="text-sm text-slate-300 italic">"Tuo figlio ha completato {userData.hours || 0} ore di studio. Voto attuale: {Math.min(10, (userData.xp / 500)).toFixed(1)}"</div>
            </div>
          </div>
          <div>
            <div className="text-slate-400 text-xs font-mono mb-4">RIPARTIZIONE MATERIE</div>
            <div className="space-y-3">{[{ l: 'Storia', v: 75, c: '#8b5cf6' }, { l: 'Scienze', v: 45, c: '#06b6d4' }, { l: 'Matematica', v: 60, c: '#10b981' }].map((item, i) => (
              <div key={i}><div className="flex justify-between text-xs text-slate-300 mb-1"><span>{item.l}</span><span>{item.v}%</span></div><div className="w-full h-1 bg-slate-700 rounded-full overflow-hidden"><div className="h-full" style={{ width: `${item.v}%`, background: item.c }} /></div></div>
            ))}</div>
          </div>
        </div>
      ) : (
        <div className="py-12 bg-black/50 rounded-xl border border-white/5 blur-sm select-none"><div className="flex items-center justify-center h-full text-slate-600 font-mono">VISUALIZZAZIONE DATI CRITTOGRAFATA</div></div>
      )}
    </HUDCard>
  );
};

// ============================================
// PRICING SECTION
// ============================================
const PricingSection = () => {
  const { upgradeToCore, setShowPayment, protocol } = useUser();

  const coreFeatures = ['Neural Engine Base', '5 Ricerche al Giorno', 'Accesso Community', 'Video Streaming Base'];
  const proFeatures = [
    'Ricerche Illimitate', 'Dashboard Genitori Completa', 'Elaborazione Prioritaria', 'Input Vocale Avanzato',
    'Memory Lock Pro', 'Time Dilation Algorithm', 'Signal Filter HD', 'Report Email Settimanali',
    'Supporto Prioritario 24/7', 'Nessuna Pubblicità'
  ];

  return (
    <section id="pricing" className="py-20 px-6 relative z-10">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16"><h2 className="text-4xl font-black text-white mb-4">SCEGLI <span className="text-[#06b6d4]">PROTOCOLLO</span></h2></div>
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          {/* Student Core */}
          <HUDCard className={`p-8 rounded-2xl ${protocol === 'CORE' ? 'border-[#10b981]' : ''}`}>
            {protocol === 'CORE' && <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#10b981] text-white text-xs rounded-full font-bold">ATTIVO</div>}
            <h3 className="text-2xl font-bold text-white mb-2">STUDENT CORE</h3>
            <div className="text-4xl font-black text-slate-400 mb-6">€0</div>
            <ul className="space-y-3 mb-8 text-sm text-slate-400">{coreFeatures.map((x, i) => <li key={i} className="flex gap-2"><Check className="w-4 h-4 text-slate-500" />{x}</li>)}</ul>
            <MagneticButton onClick={upgradeToCore} disabled={protocol !== 'GUEST'}
              className="w-full py-3 border border-slate-600 text-slate-400 font-bold rounded-xl hover:text-white hover:border-white disabled:opacity-50">
              {protocol === 'GUEST' ? 'ATTIVA GRATIS' : 'GIÀ ATTIVO'}
            </MagneticButton>
          </HUDCard>

          {/* Scholar Pro */}
          <HUDCard className={`p-8 rounded-2xl relative ${protocol === 'PRO' ? 'border-[#10b981]' : 'border-[#8b5cf6]'} shadow-[0_0_30px_rgba(139,92,246,0.15)]`}>
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#8b5cf6] text-white text-xs rounded-full font-bold">
              {protocol === 'PRO' ? 'ATTIVO' : 'CONSIGLIATO'}
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">SCHOLAR PRO</h3>
            <div className="text-4xl font-black text-white mb-6">€9.99<span className="text-lg font-normal text-slate-400">/mese</span></div>
            <ul className="space-y-2 mb-8 text-sm text-white max-h-48 overflow-y-auto pr-2">{proFeatures.map((x, i) => <li key={i} className="flex gap-2"><Check className="w-4 h-4 text-[#8b5cf6] shrink-0" />{x}</li>)}</ul>
            <MagneticButton onClick={() => setShowPayment(true)} disabled={protocol === 'PRO'}
              className="w-full py-3 bg-[#8b5cf6] text-white font-bold rounded-xl hover:bg-[#7c3aed] disabled:opacity-50">
              {protocol === 'PRO' ? 'GIÀ PRO' : 'UPGRADE ORA'}
            </MagneticButton>
          </HUDCard>
        </div>
        <ParentsDashboard />
      </div>
    </section>
  );
};

// ============================================
// PRO DASHBOARD (Interfaccia Dedicata Pro)
// ============================================
const ProDashboard = () => {
  const { userData, setCurrentView } = useUser();
  const [activeTab, setActiveTab] = useState('overview');
  const [isListening, setIsListening] = useState(false);
  const [voiceQuery, setVoiceQuery] = useState('');
  const [searchHistory, setSearchHistory] = useState([]);
  const [memoryCards, setMemoryCards] = useState([]);
  const [flippedCard, setFlippedCard] = useState(null);
  const [cardTopic, setCardTopic] = useState('');
  const [isGeneratingCards, setIsGeneratingCards] = useState(false);

  const generateFlashcards = async () => {
    if (!cardTopic.trim()) return;
    setIsGeneratingCards(true);

    try {
      if (!SYSTEM_CONFIG.OPENROUTER_KEY) throw new Error("No Key");

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${SYSTEM_CONFIG.OPENROUTER_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:5173",
          "X-Title": "Synapse OS"
        },
        body: JSON.stringify({
          "model": "google/gemini-2.0-flash-001",
          "messages": [
            {
              "role": "system",
              "content": "You are Synapse OS. Analyze the topic and return a STRICT JSON array of 3 objects: [{ \"id\": 1, \"front\": \"Question?\", \"back\": \"Answer\", \"mastery\": 0 }]. Limit answers to 5 words max. Language: ITALIAN."
            },
            { role: 'user', content: `Topic: ${cardTopic}` }
          ]
        })
      });

      const data = await response.json();
      let cleanContent = data.choices[0].message.content.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
      const newCards = JSON.parse(cleanContent);

      // Add random mastery for simulation
      const cardsWithMastery = newCards.map((c, i) => ({ ...c, id: Date.now() + i, mastery: Math.floor(Math.random() * 40) }));
      setMemoryCards(cardsWithMastery);
      setCardTopic('');

    } catch (e) {
      console.error("Card Gen Failed", e);
    } finally {
      setIsGeneratingCards(false);
    }
  };
  const [plannerEvents, setPlannerEvents] = useState([]);
  const [videoTopic, setVideoTopic] = useState('');
  const [videoSearching, setVideoSearching] = useState(false);
  const [currentVideo, setCurrentVideo] = useState({ id: SYSTEM_CONFIG.FALLBACK_VIDEO_ID, title: 'La Rivoluzione Francese - Documentario Completo', topic: 'Rivoluzione Francese' });
  const [videoQueue, setVideoQueue] = useState([
    { id: 'dQw4w9WgXcQ', title: 'Fisica Quantistica Semplificata', duration: '15:00' },
    { id: 'dQw4w9WgXcQ', title: 'Fisica Quantistica Semplificata', duration: '15:00' },
    { id: 'jNQXAC9IVRw', title: 'Storia del Rinascimento', duration: '18:00' },
  ]);

  // Support Chat State
  const [chatMessages, setChatMessages] = useState([
    { role: 'system', content: 'Synapse Support Agent Online. Come posso aiutarti oggi?' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const handleSupportMessage = async () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput;
    setChatMessages(p => [...p, { role: 'user', content: userMsg }]);
    setChatInput('');
    setIsTyping(true);

    try {
      if (!SYSTEM_CONFIG.OPENROUTER_KEY) throw new Error("No Key");

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${SYSTEM_CONFIG.OPENROUTER_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:5173",
          "X-Title": "Synapse OS"
        },
        body: JSON.stringify({
          "model": "google/gemini-2.0-flash-001",
          "messages": [
            {
              "role": "system",
              "content": "You are Synapse Support, a helpful AI assistant for the Synapse OS platform. Answer questions about the app (Time Dilation, Signal Filters, Memory Lock), subscription (Pro is 9.99/mo), or general technical support. Be concise, professional, and use a futuristic tone. Language: ITALIAN."
            },
            ...chatMessages.map(m => ({ role: m.role === 'system' ? 'assistant' : m.role, content: m.content })),
            { role: 'user', content: userMsg }
          ]
        })
      });

      const data = await response.json();
      if (!data.choices) throw new Error("AI Error");

      setChatMessages(p => [...p, { role: 'system', content: data.choices[0].message.content }]);

    } catch (e) {
      setChatMessages(p => [...p, { role: 'system', content: "ERRORE CONNESSIONE: Impossibile contattare il supporto centrale." }]);
    } finally {
      setIsTyping(false);
    }
  };



  const searchVideo = async () => {
    if (!videoTopic.trim()) return;
    setVideoSearching(true);

    // Fallback function
    const useFallback = () => {
      const foundVideo = getTopicVideo(videoTopic);
      setCurrentVideo({ ...foundVideo, topic: videoTopic });
    };

    try {
      // 1. Ask Gemini for the best search query
      if (!SYSTEM_CONFIG.OPENROUTER_KEY) throw new Error("No AI Key");

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${SYSTEM_CONFIG.OPENROUTER_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:5173",
          "X-Title": "Synapse OS"
        },
        body: JSON.stringify({
          "model": "google/gemini-2.0-flash-001",
          "messages": [
            {
              "role": "system",
              "content": "You are Synapse OS. Analyze the topic and return a STRICT JSON: { \"videoSearchQuery\": \"optimized youtube search query for topic\", \"title\": \"Formal Title of the topic\" }. Language: ITALIAN."
            },
            { "role": "user", "content": `Topic: ${videoTopic}` }
          ]
        })
      });

      const data = await response.json();
      if (!data.choices) throw new Error("AI Error");

      let cleanContent = data.choices[0].message.content.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
      const aiContent = JSON.parse(cleanContent);

      let finalVideoId = `?listType=search&list=${encodeURIComponent(aiContent.videoSearchQuery)}`;
      let finalTitle = aiContent.title;

      // 2. Fetch from YouTube API if available
      if (SYSTEM_CONFIG.YOUTUBE_KEY) {
        try {
          const ytRes = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q=${encodeURIComponent(aiContent.videoSearchQuery)}&type=video&key=${SYSTEM_CONFIG.YOUTUBE_KEY}`);
          const ytData = await ytRes.json();
          if (ytData.items && ytData.items.length > 0) {
            finalVideoId = ytData.items[0].id.videoId;
            finalTitle = ytData.items[0].snippet.title;
          }
        } catch (e) { console.error("YT API Error", e); }
      }

      setCurrentVideo({
        id: finalVideoId,
        title: finalTitle,
        topic: videoTopic
      });

    } catch (error) {
      console.error("Search failed, using fallback", error);
      useFallback();
    } finally {
      setVideoSearching(false);
      setVideoTopic('');
    }
  };

  const startVoiceCommand = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = 'it-IT';
      recognition.continuous = true;
      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript;
        setVoiceQuery(transcript);
      };
      recognition.start();
    }
  };

  const tabs = [
    { id: 'overview', label: 'Panoramica', icon: BarChart2 },
    { id: 'planner', label: 'Time Dilation', icon: Clock },
    { id: 'video', label: 'Signal Filter', icon: Video },
    { id: 'memory', label: 'Memory Lock', icon: Brain },
    { id: 'voice', label: 'Voice Commander', icon: Mic },
    { id: 'reports', label: 'Report', icon: Mail },
    { id: 'support', label: 'Supporto 24/7', icon: HelpCircle },
  ];

  return (
    <div className="min-h-screen pt-32 pb-20 px-6 relative z-10">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="px-3 py-1 bg-[#8b5cf6]/20 text-[#8b5cf6] text-xs font-bold rounded border border-[#8b5cf6]/50">SCHOLAR PRO</div>
              <span className="font-mono text-xs text-slate-500">ID: SYN-{Math.floor(Math.random() * 9000) + 1000}</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white">Benvenuto, <span className="text-[#8b5cf6]">{userData.name}</span></h1>
          </div>
          <button onClick={() => setCurrentView('LANDING')} className="w-full md:w-auto px-4 py-2 bg-slate-800 text-slate-400 font-mono text-xs rounded hover:text-white hover:bg-slate-700 text-center">
            ← TORNA ALLA HOME
          </button>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'XP Totali', value: userData.xp, color: '#8b5cf6', icon: Sparkles },
            { label: 'Ore Studio', value: `${userData.hours}h`, color: '#06b6d4', icon: Clock },
            { label: 'Streak', value: `${userData.streak} giorni`, color: '#10b981', icon: Zap },
            { label: 'Ricerche', value: '∞', color: '#f59e0b', icon: Search },
          ].map((stat, i) => (
            <HUDCard key={i} className="p-4 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${stat.color}20` }}>
                  <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">{stat.value}</div>
                  <div className="text-xs text-slate-500 font-mono">{stat.label}</div>
                </div>
              </div>
            </HUDCard>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs whitespace-nowrap transition-all
                ${activeTab === tab.id ? 'bg-[#8b5cf6] text-white' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700'}`}>
              <tab.icon className="w-4 h-4" />{tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {/* Overview */}
          {activeTab === 'overview' && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <HUDCard className="p-6 rounded-2xl col-span-2">
                <h3 className="text-white font-bold mb-4 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-[#10b981]" />Attività Settimanale</h3>
                <div className="h-40 flex items-end gap-2">
                  {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map((d, i) => {
                    // Distribute total hours roughly across week for viz
                    const avgDaily = userData.hours / 7;
                    const h = Math.min(100, (avgDaily + (Math.random() * avgDaily * 0.5)) * 10);
                    return (<div key={d} className="flex-1 flex flex-col items-center gap-2">
                      <div className="w-full bg-slate-800 rounded-t transition-all duration-1000" style={{ height: `${h || 2}%`, background: `linear-gradient(to top, #8b5cf6, #06b6d4)` }} />
                      <span className="text-xs text-slate-500">{d}</span>
                    </div>);
                  })}
                </div>
              </HUDCard>
              <HUDCard className="p-6 rounded-2xl">
                <h3 className="text-white font-bold mb-4 flex items-center gap-2"><Search className="w-5 h-5 text-[#06b6d4]" />Ricerche Recenti</h3>
                <div className="space-y-3">
                  {searchHistory.length === 0 ? <div className="text-slate-500 text-sm italic py-4 text-center">Nessuna ricerca recente</div> : searchHistory.map((s, i) => (
                    <div key={i} className="flex justify-between items-center text-sm">
                      <span className="text-slate-300">{s.query}</span>
                      <span className="text-xs text-slate-500">{s.results} risultati</span>
                    </div>
                  ))}</div>
              </HUDCard>
            </div>
          )}

          {/* Time Dilation Planner */}
          {activeTab === 'planner' && (
            <HUDCard className="p-6 rounded-2xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-white font-bold flex items-center gap-2"><Clock className="w-5 h-5 text-[#8b5cf6]" />TIME DILATION ALGORITHM</h3>
                <span className="text-xs text-slate-500 font-mono">Adattato al tuo ritmo circadiano</span>
              </div>
              <div className="space-y-4">
                {plannerEvents.length === 0 ? <div className="text-slate-500 text-sm italic py-8 text-center">Nessun evento programmato. Usa il simulatore per generare un piano.</div> : plannerEvents.map((event, i) => (
                  <div key={i} className={`flex items-center gap-4 p-4 rounded-xl border ${event.completed ? 'bg-[#10b981]/10 border-[#10b981]/30' : 'bg-slate-800/30 border-white/5'}`}>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${event.completed ? 'bg-[#10b981]/20' : 'bg-[#8b5cf6]/20'}`}>
                      {event.type === 'focus' && <Brain className="w-6 h-6 text-[#8b5cf6]" />}
                      {event.type === 'break' && <Coffee className="w-6 h-6 text-[#06b6d4]" />}
                      {event.type === 'video' && <Video className="w-6 h-6 text-[#8b5cf6]" />}
                      {event.type === 'quiz' && <HelpCircle className="w-6 h-6 text-[#8b5cf6]" />}
                    </div>
                    <div className="flex-1">
                      <div className="text-white font-semibold">{event.task}</div>
                      <div className="text-xs text-slate-500 font-mono">{event.time} • {event.duration}</div>
                    </div>
                    {event.completed && <Check className="w-6 h-6 text-[#10b981]" />}
                  </div>
                ))}
              </div>
            </HUDCard>
          )}

          {/* Signal Filter Video */}
          {activeTab === 'video' && (
            <div className="space-y-6">
              {/* Search Input */}
              <HUDCard className="p-6 rounded-2xl">
                <h3 className="text-white font-bold mb-4 flex items-center gap-2"><Filter className="w-5 h-5 text-[#06b6d4]" />SIGNAL FILTER HD</h3>
                <p className="text-slate-400 text-sm mb-4">Inserisci un argomento e l'AI troverà il video perfetto per te. Intro, sponsor e contenuti a bassa densità rimossi automaticamente.</p>
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <input type="text" value={videoTopic} onChange={(e) => setVideoTopic(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && searchVideo()}
                      placeholder="Es. Rivoluzione Francese, Fisica, Matematica..."
                      className="w-full bg-slate-800 border border-slate-600 rounded-xl py-3 pl-12 pr-4 text-white placeholder:text-slate-500 focus:border-[#06b6d4] focus:outline-none font-mono" />
                  </div>
                  <button onClick={searchVideo} disabled={videoSearching || !videoTopic.trim()}
                    className="px-6 py-3 bg-[#06b6d4] text-black font-bold rounded-xl hover:bg-[#22d3ee] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                    {videoSearching ? <><div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />Cerco...</> : <><Sparkles className="w-4 h-4" />TROVA VIDEO</>}
                  </button>
                </div>
              </HUDCard>

              {/* Video Player */}
              <div className="grid md:grid-cols-3 gap-6">
                <HUDCard className="p-6 rounded-2xl md:col-span-2">
                  {videoSearching ? (
                    <div className="aspect-video bg-slate-800 rounded-xl flex flex-col items-center justify-center">
                      <div className="w-16 h-16 border-4 border-[#06b6d4] border-t-transparent rounded-full animate-spin mb-4" />
                      <p className="text-[#06b6d4] font-mono text-sm">Analisi Neural in corso...</p>
                      <p className="text-slate-500 font-mono text-xs mt-2">Filtro contenuti attivo</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="px-2 py-1 bg-[#10b981]/20 text-[#10b981] text-[10px] font-bold rounded">FILTRATO</span>
                        <span className="text-slate-400 text-xs font-mono">{currentVideo.topic}</span>
                      </div>
                      <div className="aspect-video bg-black rounded-xl overflow-hidden mb-3">
                        <iframe
                          src={currentVideo.id?.startsWith('?')
                            ? `https://www.youtube.com/embed?${currentVideo.id.substring(1)}&origin=${window.location.origin}`
                            : `https://www.youtube.com/embed/${currentVideo.id}?origin=${window.location.origin}`}
                          className="w-full h-full"
                          title="Video Filtrato"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                      <h4 className="text-white font-semibold">{currentVideo.title}</h4>
                    </>
                  )}
                </HUDCard>

                {/* Video Queue */}
                <HUDCard className="p-6 rounded-2xl">
                  <h3 className="text-white font-bold mb-4">Coda Suggerita</h3>
                  <div className="space-y-3">
                    {Object.entries(VIDEO_DATABASE).slice(0, 4).map(([key, video], i) => (
                      <div key={i} onClick={() => setCurrentVideo({ ...video, topic: key })}
                        className="flex items-center gap-3 p-3 bg-slate-800/30 rounded-lg hover:bg-slate-700/30 cursor-pointer transition-all">
                        <Play className="w-4 h-4 text-[#06b6d4]" />
                        <span className="text-slate-300 text-sm line-clamp-1">{video.title}</span>
                      </div>
                    ))}
                  </div>
                </HUDCard>
              </div>
            </div>
          )}


          {/* Memory Lock Pro */}
          {activeTab === 'memory' && (
            <HUDCard className="p-6 rounded-2xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-white font-bold flex items-center gap-2"><Brain className="w-5 h-5 text-[#8b5cf6]" />MEMORY LOCK PRO</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={cardTopic}
                    onChange={(e) => setCardTopic(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && generateFlashcards()}
                    placeholder="Argomento flashcard..."
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1 text-sm text-white focus:outline-none focus:border-[#8b5cf6]"
                  />
                  <button onClick={generateFlashcards} disabled={isGeneratingCards || !cardTopic.trim()}
                    className="p-2 bg-[#8b5cf6] text-white rounded-lg hover:bg-[#7c3aed] disabled:opacity-50">
                    {isGeneratingCards ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                {memoryCards.map((card) => (
                  <div key={card.id} onClick={() => setFlippedCard(flippedCard === card.id ? null : card.id)}
                    className="relative h-48 cursor-pointer" style={{ perspective: '1000px' }}>
                    <div className={`absolute inset-0 transition-transform duration-500 rounded-xl`}
                      style={{ transformStyle: 'preserve-3d', transform: flippedCard === card.id ? 'rotateY(180deg)' : '' }}>
                      {/* Front */}
                      <div className="absolute inset-0 bg-gradient-to-br from-[#8b5cf6]/20 to-[#06b6d4]/20 border border-white/10 rounded-xl p-6 flex flex-col justify-between"
                        style={{ backfaceVisibility: 'hidden' }}>
                        <div className="text-white font-semibold text-center mt-4">{card.front}</div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                            <div className="h-full bg-[#8b5cf6]" style={{ width: `${card.mastery}%` }} />
                          </div>
                          <span className="text-xs text-slate-400">{card.mastery}%</span>
                        </div>
                      </div>
                      {/* Back */}
                      <div className="absolute inset-0 bg-[#10b981]/20 border border-[#10b981]/30 rounded-xl p-6 flex items-center justify-center"
                        style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                        <div className="text-[#10b981] font-bold text-xl text-center">{card.back}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </HUDCard>
          )}

          {/* Voice Commander */}
          {activeTab === 'voice' && (
            <HUDCard className="p-6 rounded-2xl">
              <h3 className="text-white font-bold mb-6 flex items-center gap-2"><Mic className="w-5 h-5 text-[#06b6d4]" />VOICE COMMANDER AVANZATO</h3>
              <div className="text-center py-12">
                <button onClick={startVoiceCommand}
                  className={`w-32 h-32 rounded-full flex items-center justify-center transition-all mx-auto mb-6
                    ${isListening ? 'bg-[#f43f5e] animate-pulse shadow-[0_0_60px_rgba(244,63,94,0.5)]' : 'bg-[#8b5cf6] hover:bg-[#7c3aed] shadow-[0_0_40px_rgba(139,92,246,0.3)]'}`}>
                  {isListening ? <MicOff className="w-12 h-12 text-white" /> : <Mic className="w-12 h-12 text-white" />}
                </button>
                <p className="text-slate-400 font-mono text-sm mb-4">{isListening ? 'Ascolto in corso...' : 'Clicca per attivare i comandi vocali'}</p>
                {voiceQuery && <div className="p-4 bg-slate-800/50 rounded-xl inline-block"><span className="text-white">"{voiceQuery}"</span></div>}
                <div className="mt-8 grid md:grid-cols-3 gap-4 text-left">
                  {['Cerca [argomento]', 'Avvia sessione studio', 'Mostra statistiche'].map((cmd, i) => (
                    <div key={i} className="p-3 bg-slate-800/30 rounded-lg"><span className="text-[#06b6d4] font-mono text-xs">{cmd}</span></div>
                  ))}
                </div>
              </div>
            </HUDCard>
          )}

          {/* Reports */}
          {activeTab === 'reports' && (
            <HUDCard className="p-6 rounded-2xl">
              <h3 className="text-white font-bold mb-6 flex items-center gap-2"><Mail className="w-5 h-5 text-[#8b5cf6]" />REPORT EMAIL SETTIMANALI</h3>
              <div className="bg-slate-800/30 rounded-xl p-6 border border-white/5">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-[#8b5cf6]/20 rounded-full flex items-center justify-center"><Mail className="w-6 h-6 text-[#8b5cf6]" /></div>
                  <div>
                    <div className="text-white font-bold">Report Settimanale - Synapse OS</div>
                    <div className="text-xs text-slate-500">Inviato ogni Domenica alle 20:00</div>
                  </div>
                </div>
                <div className="space-y-4 text-slate-300 text-sm">
                  <p>📊 <strong>Attività:</strong> 14.5 ore di Deep Work completate</p>
                  <p>🎯 <strong>Focus Score:</strong> 8.5/10 (+12% vs settimana precedente)</p>
                  <p>📚 <strong>Materie:</strong> Storia (75%), Scienze (45%), Matematica (60%)</p>
                  <p>🏆 <strong>Voto Simulato:</strong> 8.5</p>
                </div>
                <div className="mt-6 pt-4 border-t border-white/5">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" defaultChecked className="w-4 h-4 accent-[#8b5cf6]" />
                    <span className="text-slate-400 text-sm">Invia report anche ai genitori</span>
                  </label>
                </div>
              </div>
            </HUDCard>
          )}

          {/* Support Chat (AI) */}
          {activeTab === 'support' && (
            <HUDCard className="p-6 rounded-2xl h-[600px] flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-bold flex items-center gap-2"><HelpCircle className="w-5 h-5 text-[#10b981]" />SUPPORTO PRIORITARIO 24/7</h3>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#10b981] rounded-full animate-pulse" />
                  <span className="text-[#10b981] font-mono text-xs">AGENT ONLINE</span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2 custom-scrollbar">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-3 rounded-xl text-sm ${msg.role === 'user' ? 'bg-[#8b5cf6] text-white rounded-br-none' : 'bg-slate-800 text-slate-300 rounded-bl-none'}`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {isTyping && <div className="text-slate-500 text-xs animate-pulse">L'agente sta scrivendo...</div>}
              </div>

              <div className="pt-4 border-t border-white/10 flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSupportMessage()}
                  placeholder="Scrivi il tuo problema..."
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#10b981]"
                />
                <button onClick={handleSupportMessage} disabled={isTyping || !chatInput.trim()}
                  className="p-3 bg-[#10b981] text-black rounded-lg hover:bg-[#059669] disabled:opacity-50">
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </HUDCard>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================
// SYSTEM FOOTER
// ============================================
const SystemFooter = () => (

  <footer className="py-12 px-6 border-t border-white/5 relative" style={{ zIndex: 1 }}>
    <div className="max-w-6xl mx-auto">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8 font-mono text-xs uppercase text-slate-500">
        <div><div className="text-slate-400 mb-1">ID SISTEMA</div><div className="text-white">SYN-8842</div></div>
        <div><div className="text-slate-400 mb-1">SICUREZZA</div><div className="text-[#10b981] flex items-center gap-1"><Lock className="w-3 h-3" strokeWidth={1.5} />AES-256</div></div>
        <div><div className="text-slate-400 mb-1">VERSIONE</div><div className="text-white">v2.0.1-stabile</div></div>
        <div><div className="text-slate-400 mb-1">STATO</div><div className="text-[#10b981] flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />OPERATIVO</div></div>
      </div>
      <div className="mt-12 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2"><Brain className="w-5 h-5 text-[#8b5cf6]" strokeWidth={1.5} /><GlitchText className="text-white font-bold">SYNAPSE</GlitchText><span className="text-[#06b6d4]">[OS]</span></div>
        <div className="font-mono text-xs text-slate-500">COPYRIGHT © 2026 SYNAPSE CORP. TUTTI I DIRITTI RISERVATI.</div>
        <div className="font-mono text-xs text-slate-500 flex items-center gap-2"><Shield className="w-3 h-3 text-[#8b5cf6]" strokeWidth={1.5} />RETE NEURALE PROTETTA</div>
      </div>
    </div>
  </footer>
);

// ============================================
// MAIN APP
// ============================================
const AppContent = () => {
  const { currentView, protocol } = useUser();

  // Landing Page (Guest or Core)
  if (currentView === 'LANDING' || protocol !== 'PRO') {
    return (
      <div className="min-h-screen bg-[#020617] relative overflow-hidden text-slate-300 font-sans selection:bg-[#8b5cf6] selection:text-white">
        <NeuralVoid />
        <NeuralCanvas />
        <Header />
        <AuthModal />
        <PaymentModal />

        <LiveTicker />
        <main>
          <HeroUnit />
          <ErrorBoundary>
            <CoreSimulator />
          </ErrorBoundary>
          <FeatureModules />
          <PricingSection />
        </main>
        <SystemFooter />
        <style>{`
          @keyframes glitch { 0%,90%{transform:translate(0)} 92%{transform:translate(-2px,1px) skewX(-1deg)} 94%{transform:translate(2px,-1px) skewX(1deg)} 96%{transform:translate(0)} }
          .glitch-text { animation: glitch 5s infinite; display: inline-block; }
          .hud-corner { position:absolute; width:10px; height:10px; border-color:white; opacity:0.3; border-style:solid; }
          .hud-corner-tl { top:5px; left:5px; border-width:1px 0 0 1px; }
          .hud-corner-tr { top:5px; right:5px; border-width:1px 1px 0 0; }
          .hud-corner-bl { bottom:5px; left:5px; border-width:0 0 1px 1px; }
          .hud-corner-br { bottom:5px; right:5px; border-width:0 1px 1px 0; }
          .hud-card:hover .hud-corner { opacity:1; border-color:#8b5cf6; }
          @keyframes ticker { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
          .ticker-track { animation: ticker 30s linear infinite; }
        `}</style>
      </div>
    );
  }

  // Pro Dashboard (Fully Unlocked & Real AI)
  return (
    <div className="bg-[#020617] min-h-screen relative overflow-x-hidden font-sans selection:bg-[#8b5cf6] selection:text-white">
      <VFXLayer />
      <NeuralCanvas />
      <PaymentModal />
      <SystemHeader />
      <ProDashboard />
      <style>{`
          @keyframes glitch { 0%,90%{transform:translate(0)} 92%{transform:translate(-2px,1px) skewX(-1deg)} 94%{transform:translate(2px,-1px) skewX(1deg)} 96%{transform:translate(0)} }
          .glitch-text { animation: glitch 5s infinite; display: inline-block; }
          .hud-corner { position:absolute; width:10px; height:10px; border-color:white; opacity:0.3; border-style:solid; }
          .hud-corner-tl { top:5px; left:5px; border-width:1px 0 0 1px; }
          .hud-corner-tr { top:5px; right:5px; border-width:1px 1px 0 0; }
          .hud-corner-bl { bottom:5px; left:5px; border-width:0 0 1px 1px; }
          .hud-corner-br { bottom:5px; right:5px; border-width:0 1px 1px 0; }
          .hud-card:hover .hud-corner { opacity:1; border-color:#8b5cf6; }
          @keyframes ticker { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
          .ticker-track { animation: ticker 30s linear infinite; }
        `}</style>
    </div>
  );
};

function App() {
  return (
    <UserProvider>
      <ErrorBoundary>
        <AppContent />
      </ErrorBoundary>
    </UserProvider>
  );
}

export default App;
