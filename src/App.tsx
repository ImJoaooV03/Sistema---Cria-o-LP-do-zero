import React, { useState, useRef, useEffect, useMemo } from 'react';
import { generatePage, updatePage, improvePrompt, generateDesignSystem } from './services/geminiService';
import { auth, db, googleProvider } from './firebase';
import { signInWithPopup, onAuthStateChanged, User, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, query, where, serverTimestamp, getDocFromServer } from 'firebase/firestore';
import { 
  Layout, Plus, Sparkles, Download, Undo, Redo, 
  PanelRightClose, PanelRightOpen, X, Wand2, Send, 
  Loader2, Scale, Code, Monitor, Briefcase, ChevronRight,
  Trash2, Home, Users, BarChart3, Settings, FileText, ArrowLeft,
  Palette, FileCode2, Upload, LogOut
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart
} from 'recharts';

import { LoginScreen } from './components/LoginScreen';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface Project {
  id: string;
  clientName: string;
  prompt: string;
  html: string;
  history: string[];
  historyIndex: number;
  createdAt: Date;
  userId?: string;
}

interface SavedDesignSystem {
  id: string;
  name: string;
  html: string;
  createdAt: Date;
  userId?: string;
}

type ViewMode = 'dashboard' | 'projects' | 'clients' | 'editor' | 'design-system';

function App() {
  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Navigation State
  const [currentView, setCurrentView] = useState<ViewMode>('dashboard');

  // Projects State
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(true);
  
  // Create Project State
  const [newClientName, setNewClientName] = useState("");
  const [newPrompt, setNewPrompt] = useState("");
  
  // Refine State
  const [refinePrompt, setRefinePrompt] = useState("");
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  
  // Modal State
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'alert' | 'confirm';
    onConfirm?: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'alert'
  });

  const showAlert = (title: string, message: string) => {
    setModalConfig({ isOpen: true, title, message, type: 'alert' });
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setModalConfig({ isOpen: true, title, message, type: 'confirm', onConfirm });
  };
  // Global State
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [editorViewMode, setEditorViewMode] = useState<'preview' | 'code'>('preview');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Design System State
  const [dsHtmlInput, setDsHtmlInput] = useState("");
  const [dsFileName, setDsFileName] = useState("");
  const [dsGeneratedHtml, setDsGeneratedHtml] = useState("");
  const [dsViewMode, setDsViewMode] = useState<'input' | 'preview' | 'code'>('input');
  const [savedDesignSystems, setSavedDesignSystems] = useState<SavedDesignSystem[]>([]);
  const [dsSearch, setDsSearch] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [isClaudeActive, setIsClaudeActive] = useState(false);
  const [dsModel, setDsModel] = useState<'claude' | 'gemini'>('claude');
  const [mainModel, setMainModel] = useState<'claude' | 'gemini'>('claude');
  const dsIframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const claudeKey = import.meta.env.VITE_CLAUDE_API_KEY;
    if (claudeKey && claudeKey !== 'MY_CLAUDE_API_KEY') {
      setIsClaudeActive(true);
      setDsModel('claude');
      setMainModel('claude');
    } else {
      setDsModel('gemini');
      setMainModel('gemini');
    }
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(dsGeneratedHtml);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Auth & Persistence
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        }
      }
    }
    testConnection();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAuthReady || !user) {
      setProjects([]);
      setSavedDesignSystems([]);
      return;
    }

    const isAdmin = user.email === 'joaovicrengel@gmail.com' && user.emailVerified;

    const qProjects = isAdmin 
      ? query(collection(db, 'projects'))
      : query(collection(db, 'projects'), where('userId', '==', user.uid));
      
    const unsubProjects = onSnapshot(qProjects, (snapshot) => {
      const projs: Project[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        projs.push({
          id: docSnap.id,
          clientName: data.clientName,
          prompt: data.prompt,
          html: data.html,
          history: data.history,
          historyIndex: data.historyIndex,
          createdAt: data.createdAt?.toDate() || new Date(),
          userId: data.userId
        });
      });
      projs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setProjects(projs);
    }, (error) => {
      showAlert("Erro de Permissão", "Você não tem permissão para listar os projetos.");
      handleFirestoreError(error, OperationType.LIST, 'projects');
    });

    const qDS = isAdmin
      ? query(collection(db, 'designSystems'))
      : query(collection(db, 'designSystems'), where('userId', '==', user.uid));
      
    const unsubDS = onSnapshot(qDS, (snapshot) => {
      const dsList: SavedDesignSystem[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        dsList.push({
          id: docSnap.id,
          name: data.name,
          html: data.html,
          createdAt: data.createdAt?.toDate() || new Date(),
          userId: data.userId
        });
      });
      dsList.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setSavedDesignSystems(dsList);
    }, (error) => {
      showAlert("Erro de Permissão", "Você não tem permissão para listar os Design Systems.");
      handleFirestoreError(error, OperationType.LIST, 'designSystems');
    });

    return () => {
      unsubProjects();
      unsubDS();
    };
  }, [user, isAuthReady]);

  const activeProject = projects.find(p => p.id === activeProjectId);

  // Real Chart Data
  const chartData = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (6 - i));
      const dayName = d.toLocaleDateString('pt-BR', { weekday: 'short' });
      // Actual projects created on that day
      const actualCount = projects.filter(p => p.createdAt.toDateString() === d.toDateString()).length;
      return {
        name: dayName,
        paginas: actualCount,
      };
    });
  }, [projects]);

  // Unique Clients
  const clients = useMemo(() => {
    const uniqueClients = new Set(projects.map(p => p.clientName));
    return Array.from(uniqueClients).map(name => ({
      name,
      projectCount: projects.filter(p => p.clientName === name).length,
      lastActive: projects.filter(p => p.clientName === name).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]?.createdAt
    }));
  }, [projects]);

  // Handlers
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim() || !newPrompt.trim() || !user) return;

    setIsLoading(true);
    setLoadingText(`Gerando design inicial com ${mainModel === 'claude' ? 'Claude 4.6' : 'Gemini 3.1 Pro'}...`);
    
    let generatedHtml = "";
    try {
      generatedHtml = await generatePage(newPrompt, mainModel);
    } catch (error) {
      console.error("Gemini API Error:", error);
      showAlert("Erro", "Erro ao gerar projeto com a IA. Tente novamente.");
      setIsLoading(false);
      return;
    }
    
    try {
      const newProjectRef = doc(collection(db, 'projects'));
      const newProject = {
        userId: user.uid,
        clientName: newClientName,
        prompt: newPrompt,
        html: generatedHtml,
        history: [generatedHtml],
        historyIndex: 0,
        createdAt: serverTimestamp()
      };

      await setDoc(newProjectRef, newProject);
      setActiveProjectId(newProjectRef.id);
      setIsCreating(false);
      setNewClientName("");
      setNewPrompt("");
    } catch (error) {
      showAlert("Erro de Permissão", "Você não tem permissão para criar projetos.");
      handleFirestoreError(error, OperationType.CREATE, 'projects');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefine = async () => {
    if (!activeProject || !refinePrompt.trim() || !user) return;

    setIsLoading(true);
    setLoadingText(`Aplicando alterações com ${mainModel === 'claude' ? 'Claude 4.6' : 'Gemini 3.1 Pro'}...`);
    
    let updatedHtml = "";
    try {
      updatedHtml = await updatePage(activeProject.html, refinePrompt, mainModel);
    } catch (error) {
      console.error("Gemini API Error:", error);
      showAlert("Erro", "Erro ao aplicar alterações com a IA. Tente novamente.");
      setIsLoading(false);
      return;
    }
    
    try {
      const newHistory = activeProject.history.slice(0, activeProject.historyIndex + 1);
      newHistory.push(updatedHtml);

      const updatedProjectRef = doc(db, 'projects', activeProject.id);
      await updateDoc(updatedProjectRef, {
        html: updatedHtml,
        history: newHistory,
        historyIndex: newHistory.length - 1
      });

      setRefinePrompt("");
    } catch (error) {
      showAlert("Erro de Permissão", "Você não tem permissão para modificar este projeto.");
      handleFirestoreError(error, OperationType.UPDATE, `projects/${activeProject.id}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImproveNewPrompt = async () => {
    if (!newPrompt) return;
    setIsLoading(true);
    setLoadingText("Otimizando briefing...");
    try {
      const improved = await improvePrompt(newPrompt, mainModel);
      setNewPrompt(improved);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImproveRefinePrompt = async () => {
    if (!refinePrompt) return;
    setIsLoading(true);
    setLoadingText("Otimizando instrução...");
    try {
      const improved = await improvePrompt(refinePrompt, mainModel);
      setRefinePrompt(improved);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const undo = async () => {
    if (!activeProject || activeProject.historyIndex <= 0 || !user) return;
    const newIndex = activeProject.historyIndex - 1;
    try {
      const updatedProjectRef = doc(db, 'projects', activeProject.id);
      await updateDoc(updatedProjectRef, {
        html: activeProject.history[newIndex],
        historyIndex: newIndex
      });
    } catch (error) {
      showAlert("Erro de Permissão", "Você não tem permissão para modificar este projeto.");
      handleFirestoreError(error, OperationType.UPDATE, `projects/${activeProject.id}`);
    }
  };

  const redo = async () => {
    if (!activeProject || activeProject.historyIndex >= activeProject.history.length - 1 || !user) return;
    const newIndex = activeProject.historyIndex + 1;
    try {
      const updatedProjectRef = doc(db, 'projects', activeProject.id);
      await updateDoc(updatedProjectRef, {
        html: activeProject.history[newIndex],
        historyIndex: newIndex
      });
    } catch (error) {
      showAlert("Erro de Permissão", "Você não tem permissão para modificar este projeto.");
      handleFirestoreError(error, OperationType.UPDATE, `projects/${activeProject.id}`);
    }
  };

  const deleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    showConfirm("Excluir Projeto", "Tem certeza que deseja excluir este projeto?", async () => {
      try {
        await deleteDoc(doc(db, 'projects', id));
        if (activeProjectId === id) {
          setActiveProjectId(null);
          setCurrentView('projects');
        }
      } catch (error) {
        showAlert("Erro de Permissão", "Você não tem permissão para excluir este projeto.");
        handleFirestoreError(error, OperationType.DELETE, `projects/${id}`);
      }
    });
  };

  const downloadHtml = () => {
    if (!activeProject) return;
    
    const fullHtml = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${activeProject.clientName} - Landing Page</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700&display=swap" rel="stylesheet">
    <script>
      tailwind.config = {
        theme: {
          extend: {
            fontFamily: {
              sans: ['Inter', 'sans-serif'],
              serif: ['Playfair Display', 'serif'],
            },
            colors: {
              navy: {
                800: '#1e293b',
                900: '#0f172a',
              },
              gold: {
                500: '#d4af37',
                600: '#b4941f',
              }
            }
          }
        }
      }
    </script>
    <style>
        body { font-family: 'Inter', sans-serif; }
    </style>
</head>
<body>
    ${activeProject.html}
    <script>
      document.addEventListener("DOMContentLoaded", () => {
        if (window.lucide) {
          lucide.createIcons();
        }
      });
    </script>
</body>
</html>`;

    const blob = new Blob([fullHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeProject.clientName.replace(/\s+/g, '-').toLowerCase()}-landing-page.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleGenerateDesignSystem = async (contentToUse?: string) => {
    const input = typeof contentToUse === 'string' ? contentToUse : dsHtmlInput;
    if (!input.trim() || !user) return;
    setIsLoading(true);
    setLoadingText(`Extraindo Design System com ${dsModel === 'claude' ? 'Claude 4.6' : 'Gemini 3.1 Pro'}...`);
    let generatedHtml = "";
    try {
      generatedHtml = await generateDesignSystem(input, dsModel);
      setDsGeneratedHtml(generatedHtml);
      setDsViewMode('preview');
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      const isVercel = window.location.hostname.includes('vercel.app');
      
      // Extract detailed error message
      let detailedError = "";
      if (error?.message) detailedError = error.message;
      if (error?.response?.data?.error?.message) detailedError = error.response.data.error.message;

      const errorMsg = isVercel 
        ? `Erro na Vercel: ${detailedError || "Verifique a VITE_GEMINI_API_KEY ou o tamanho do arquivo."}`
        : `Erro na Extração: ${detailedError || "O arquivo pode ser muito grande."}`;
      
      showAlert("Falha na Extração", errorMsg);
      setIsLoading(false);
      return;
    }
    
    try {
      const newDSRef = doc(collection(db, 'designSystems'));
      const newDS = {
        userId: user.uid,
        name: dsFileName || `Design System ${savedDesignSystems.length + 1}`,
        html: generatedHtml,
        createdAt: serverTimestamp()
      };
      await setDoc(newDSRef, newDS);
    } catch (fsError) {
      showAlert("Erro de Permissão", "Você não tem permissão para salvar o Design System.");
      handleFirestoreError(fsError, OperationType.CREATE, 'designSystems');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteDesignSystem = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    showConfirm("Excluir Design System", "Tem certeza que deseja excluir este Design System?", async () => {
      try {
        await deleteDoc(doc(db, 'designSystems', id));
      } catch (error) {
        showAlert("Erro de Permissão", "Você não tem permissão para excluir este Design System.");
        handleFirestoreError(error, OperationType.DELETE, `designSystems/${id}`);
      }
    });
  };

  const loadDesignSystem = (ds: SavedDesignSystem) => {
    setDsGeneratedHtml(ds.html);
    setDsFileName(ds.name);
    setDsViewMode('preview');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setDsFileName(file.name);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setDsHtmlInput(content);
    };
    reader.readAsText(file);
  };

  const downloadDesignSystemHtml = () => {
    if (!dsGeneratedHtml) return;
    
    const blob = new Blob([dsGeneratedHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `design-system.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Update design system iframe
  useEffect(() => {
    if (dsIframeRef.current && dsGeneratedHtml && dsViewMode === 'preview' && currentView === 'design-system') {
      const doc = dsIframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(dsGeneratedHtml);
        doc.close();
      }
    }
  }, [dsGeneratedHtml, dsViewMode, currentView]);

  // Update iframe when active project HTML changes
  useEffect(() => {
    if (iframeRef.current && activeProject?.html && editorViewMode === 'preview' && currentView === 'editor' && !isCreating) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <script src="https://cdn.tailwindcss.com"></script>
              <script src="https://unpkg.com/lucide@latest"></script>
              <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700&display=swap" rel="stylesheet">
              <script>
                tailwind.config = {
                  theme: {
                    extend: {
                      fontFamily: {
                        sans: ['Inter', 'sans-serif'],
                        serif: ['Playfair Display', 'serif'],
                      },
                      colors: {
                        navy: {
                          800: '#1e293b',
                          900: '#0f172a',
                        },
                        gold: {
                          500: '#d4af37',
                          600: '#b4941f',
                        }
                      }
                    }
                  }
                }
              </script>
              <style>
                body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; }
                ::-webkit-scrollbar { width: 8px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
              </style>
            </head>
            <body>
              ${activeProject.html}
              <script>
                // Initialize icons immediately
                if (window.lucide) {
                  lucide.createIcons();
                }
                // Also initialize on load just in case
                window.addEventListener("load", () => {
                  if (window.lucide) {
                    lucide.createIcons();
                  }
                });
              </script>
            </body>
          </html>
        `);
        doc.close();
      }
    }
  }, [activeProject?.html, activeProject?.id, editorViewMode, currentView, isCreating]);

  // Navigation Handlers
  const startNewProject = () => {
    setActiveProjectId(null);
    setIsCreating(true);
    setCurrentView('editor');
  };

  const openProject = (id: string) => {
    setActiveProjectId(id);
    setIsCreating(false);
    setCurrentView('editor');
  };

  // Render Views
  const renderDashboard = () => (
    <div className="flex-1 flex flex-col h-full fade-in">
      <header className="h-20 border-b border-white/5 bg-[#0A0A0A] flex items-center justify-between px-6 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-[#d4af37]">
            <Home className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-medium text-sm">Visão Geral</h2>
            <p className="text-[10px] text-white/40 uppercase tracking-widest mt-0.5">Acompanhe o crescimento do seu portfólio</p>
          </div>
        </div>
        <button 
          onClick={startNewProject}
          className="px-4 py-2 bg-[#d4af37] text-[#0f172a] rounded-lg text-xs font-bold hover:bg-[#b4941f] transition-all flex items-center gap-2"
        >
          <Plus className="w-3.5 h-3.5" /> Novo Projeto
        </button>
      </header>

      <div className="flex-1 p-10 w-full overflow-y-auto custom-scrollbar bg-[#050505]">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-[#0A0A0A] border border-white/5 p-6 rounded-2xl shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white/50 text-xs font-semibold uppercase tracking-widest">Total de Projetos</h3>
            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-[#d4af37]">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <p className="text-4xl font-serif">{projects.length}</p>
        </div>
        <div className="bg-[#0A0A0A] border border-white/5 p-6 rounded-2xl shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white/50 text-xs font-semibold uppercase tracking-widest">Clientes Ativos</h3>
            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-[#d4af37]">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-4xl font-serif">{clients.length}</p>
        </div>
        <div className="bg-[#0A0A0A] border border-white/5 p-6 rounded-2xl shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white/50 text-xs font-semibold uppercase tracking-widest">Páginas Geradas</h3>
            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-[#d4af37]">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <p className="text-4xl font-serif">{projects.reduce((acc, p) => acc + p.history.length, 0)}</p>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-[#0A0A0A] border border-white/5 p-8 rounded-2xl shadow-xl mb-10">
        <h3 className="text-white/80 font-medium mb-6">Páginas Geradas (Últimos 7 dias)</h3>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorPaginas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#d4af37" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#d4af37" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis 
                dataKey="name" 
                stroke="rgba(255,255,255,0.3)" 
                fontSize={12} 
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                stroke="rgba(255,255,255,0.3)" 
                fontSize={12}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0A0A0A', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}
                itemStyle={{ color: '#d4af37' }}
              />
              <Area 
                type="monotone" 
                dataKey="paginas" 
                stroke="#d4af37" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorPaginas)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  </div>
);

const renderClients = () => (
    <div className="flex-1 flex flex-col h-full fade-in">
      <header className="h-20 border-b border-white/5 bg-[#0A0A0A] flex items-center justify-between px-6 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-[#d4af37]">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-medium text-sm">Clientes</h2>
            <p className="text-[10px] text-white/40 uppercase tracking-widest mt-0.5">Gerencie seus escritórios e contatos</p>
          </div>
        </div>
      </header>

      <div className="flex-1 p-10 w-full overflow-y-auto custom-scrollbar bg-[#050505]">
        <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl shadow-xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/5 bg-white/5">
              <th className="p-4 text-xs font-semibold text-white/50 uppercase tracking-widest pl-6">Nome do Cliente</th>
              <th className="p-4 text-xs font-semibold text-white/50 uppercase tracking-widest">Projetos</th>
              <th className="p-4 text-xs font-semibold text-white/50 uppercase tracking-widest">Última Atividade</th>
              <th className="p-4 text-xs font-semibold text-white/50 uppercase tracking-widest text-right pr-6">Status</th>
            </tr>
          </thead>
          <tbody>
            {clients.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-white/30 text-sm">Nenhum cliente cadastrado.</td>
              </tr>
            ) : (
              clients.map((client, i) => (
                <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="p-4 pl-6 font-medium">{client.name}</td>
                  <td className="p-4 text-white/70">{client.projectCount}</td>
                  <td className="p-4 text-white/70">{client.lastActive?.toLocaleDateString('pt-BR')}</td>
                  <td className="p-4 pr-6 text-right">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 text-green-400 text-[10px] font-bold uppercase tracking-widest">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span> Ativo
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

const renderProjectsList = () => (
    <div className="flex-1 flex flex-col h-full fade-in">
      <header className="h-20 border-b border-white/5 bg-[#0A0A0A] flex items-center justify-between px-6 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-[#d4af37]">
            <Layout className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-medium text-sm">Projetos</h2>
            <p className="text-[10px] text-white/40 uppercase tracking-widest mt-0.5">Todas as landing pages geradas</p>
          </div>
        </div>
        <button 
          onClick={startNewProject}
          className="px-4 py-2 bg-[#d4af37] text-[#0f172a] rounded-lg text-xs font-bold hover:bg-[#b4941f] transition-all flex items-center gap-2"
        >
          <Plus className="w-3.5 h-3.5" /> Novo Projeto
        </button>
      </header>

      <div className="flex-1 p-10 w-full overflow-y-auto custom-scrollbar bg-[#050505]">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Create New Card */}
        <div 
          onClick={startNewProject}
          className="bg-white/5 border border-white/10 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-white/10 hover:border-[#d4af37]/50 transition-all min-h-[240px] group"
        >
          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white/50 group-hover:text-[#d4af37] group-hover:bg-[#d4af37]/10 transition-all mb-4">
            <Plus className="w-6 h-6" />
          </div>
          <h3 className="font-medium text-white/80 group-hover:text-white">Criar Novo Projeto</h3>
          <p className="text-xs text-white/40 mt-2">Gerar nova landing page com IA</p>
        </div>

        {/* Project Cards */}
        {projects.map(p => (
          <div 
            key={p.id}
            onClick={() => openProject(p.id)}
            className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-6 flex flex-col cursor-pointer hover:border-white/20 hover:shadow-xl transition-all min-h-[240px] group relative"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-[#d4af37]">
                <Layout className="w-5 h-5" />
              </div>
              <button 
                onClick={(e) => deleteProject(p.id, e)}
                className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 transition-all p-2 rounded-md hover:bg-white/5"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <h3 className="text-xl font-serif mb-1 group-hover:text-[#d4af37] transition-colors line-clamp-1">{p.clientName}</h3>
            <p className="text-xs text-white/40 mb-4 line-clamp-2 flex-1">{p.prompt}</p>
            
            <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between">
              <span className="text-[10px] text-white/30 uppercase tracking-widest">
                {p.createdAt.toLocaleDateString('pt-BR')}
              </span>
              <span className="text-[10px] bg-white/5 px-2 py-1 rounded text-white/50">
                v{p.history.length}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const renderEditor = () => (
    <div className="flex-1 flex flex-col relative min-w-0 h-full fade-in">
      {isCreating || !activeProject ? (
        // CREATE PROJECT VIEW
        <div className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
          <div className="max-w-2xl w-full bg-[#0A0A0A] border border-white/5 p-10 rounded-2xl shadow-2xl">
            <div className="flex items-center gap-3 mb-2">
              <button onClick={() => setCurrentView('projects')} className="text-white/40 hover:text-white transition-colors mr-2">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="w-10 h-[1px] bg-[#d4af37]"></div>
              <span className="text-[10px] uppercase tracking-[0.2em] text-[#d4af37] font-medium">Setup Inicial</span>
            </div>
            <h2 className="text-3xl font-serif mb-2 mt-4">Novo Projeto de Advocacia</h2>
            <p className="text-white/50 text-sm mb-8 leading-relaxed">
              Preencha os dados abaixo para que a inteligência artificial gere uma landing page premium, com design Dark & Gold e estrutura de alta conversão.
            </p>

            <form onSubmit={handleCreateProject} className="space-y-6">
              <div>
                <label className="block text-xs font-semibold text-white/70 uppercase tracking-widest mb-2">
                  Nome do Cliente / Escritório
                </label>
                <input 
                  type="text" 
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="Ex: Silva & Associados"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37] transition-all"
                  required
                />
              </div>

              <div className="mb-6">
                <label className="block text-xs font-semibold text-white/70 uppercase tracking-widest mb-3">
                  Modelo de IA
                </label>
                <div className="flex bg-white/5 rounded-lg p-1 border border-white/10">
                  <button 
                    type="button"
                    onClick={() => isClaudeActive && setMainModel('claude')}
                    disabled={!isClaudeActive}
                    className={`flex-1 py-2 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${mainModel === 'claude' ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20' : 'text-white/40 hover:text-white'} ${!isClaudeActive ? 'opacity-20 cursor-not-allowed' : ''}`}
                    title={!isClaudeActive ? "Claude API key not configured" : ""}
                  >
                    Claude 4.6
                  </button>
                  <button 
                    type="button"
                    onClick={() => setMainModel('gemini')}
                    className={`flex-1 py-2 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${mainModel === 'gemini' ? 'bg-[#d4af37] text-[#0f172a] shadow-lg shadow-[#d4af37]/20' : 'text-white/40 hover:text-white'}`}
                  >
                    Gemini 3.1 Pro
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-white/70 uppercase tracking-widest">
                    Briefing da Página
                  </label>
                  <button 
                    type="button"
                    onClick={handleImproveNewPrompt}
                    disabled={!newPrompt || isLoading}
                    className="text-[10px] flex items-center gap-1 text-[#d4af37] hover:text-white transition-colors disabled:opacity-50"
                  >
                    <Wand2 className="w-3 h-3" /> Melhorar Prompt
                  </button>
                </div>
                <textarea 
                  value={newPrompt}
                  onChange={(e) => setNewPrompt(e.target.value)}
                  placeholder="Ex: Landing page para advogado criminalista focado em crimes empresariais. Precisa transmitir muita autoridade e sigilo..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37] transition-all resize-none h-32"
                  required
                />
              </div>

              <button 
                type="submit"
                disabled={!newClientName || !newPrompt || isLoading}
                className="w-full py-4 bg-white text-[#0f172a] rounded-lg font-semibold hover:bg-gray-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-4"
              >
                <Sparkles className="w-5 h-5" /> Gerar Landing Page
              </button>
            </form>
          </div>
        </div>
      ) : (
        // ACTIVE PROJECT VIEW
        <div className="flex-1 flex flex-col h-full">
          {/* Topbar */}
          <header className="h-20 border-b border-white/5 bg-[#0A0A0A] flex items-center justify-between px-6 flex-shrink-0">
            <div className="flex items-center gap-4">
              <button onClick={() => setCurrentView('projects')} className="text-white/40 hover:text-white transition-colors mr-2">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-[#d4af37]">
                <Layout className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-medium text-sm">{activeProject.clientName}</h2>
                <p className="text-[10px] text-white/40 uppercase tracking-widest mt-0.5">Projeto Ativo</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* View Toggles */}
              <div className="flex bg-white/5 rounded-lg p-1 border border-white/5">
                <button 
                  onClick={() => setEditorViewMode('preview')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition-all ${editorViewMode === 'preview' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white'}`}
                >
                  <Monitor className="w-3.5 h-3.5" /> Preview
                </button>
                <button 
                  onClick={() => setEditorViewMode('code')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition-all ${editorViewMode === 'code' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white'}`}
                >
                  <Code className="w-3.5 h-3.5" /> Code
                </button>
              </div>

              <div className="w-px h-6 bg-white/10 mx-2"></div>

              <button 
                onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
                className={`p-2 rounded-lg transition-all ${isRightSidebarOpen ? 'bg-[#d4af37]/20 text-[#d4af37]' : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'}`}
                title="Painel de Edição"
              >
                {isRightSidebarOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
              </button>
            </div>
          </header>

          {/* Content Area */}
          <div className="flex-1 flex relative overflow-hidden">
            {/* Iframe / Code View */}
            <div className="flex-1 bg-white relative">
              {editorViewMode === 'preview' ? (
                <iframe 
                  ref={iframeRef}
                  className="w-full h-full border-none bg-white"
                  title="Preview"
                  sandbox="allow-scripts allow-same-origin"
                />
              ) : (
                <div className="w-full h-full bg-[#0A0A0A] p-6 overflow-auto">
                  <pre className="text-xs font-mono text-gray-300 whitespace-pre-wrap">
                    {activeProject.html}
                  </pre>
                </div>
              )}
            </div>

            {/* RIGHT SIDEBAR - Refine */}
            <aside 
              className={`bg-[#0A0A0A] border-l border-white/5 flex flex-col transition-all duration-300 ease-in-out z-20 ${isRightSidebarOpen ? 'w-80 translate-x-0' : 'w-0 translate-x-full border-none'}`}
            >
              <div className="h-20 border-b border-white/5 flex items-center justify-between px-6 flex-shrink-0">
                <h3 className="font-medium text-sm uppercase tracking-widest text-white/80">Refinar Design</h3>
                <button onClick={() => setIsRightSidebarOpen(false)} className="text-white/40 hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 flex flex-col p-6 overflow-y-auto">
                
                <div className="mb-6">
                  <label className="block text-xs font-semibold text-white/70 uppercase tracking-widest mb-3">
                    Modelo de IA
                  </label>
                  <div className="flex bg-white/5 rounded-lg p-1 border border-white/10">
                    <button 
                      type="button"
                      onClick={() => isClaudeActive && setMainModel('claude')}
                      disabled={!isClaudeActive}
                      className={`flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${mainModel === 'claude' ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20' : 'text-white/40 hover:text-white'} ${!isClaudeActive ? 'opacity-20 cursor-not-allowed' : ''}`}
                      title={!isClaudeActive ? "Claude API key not configured" : ""}
                    >
                      Claude 4.6
                    </button>
                    <button 
                      type="button"
                      onClick={() => setMainModel('gemini')}
                      className={`flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${mainModel === 'gemini' ? 'bg-[#d4af37] text-[#0f172a] shadow-lg shadow-[#d4af37]/20' : 'text-white/40 hover:text-white'}`}
                    >
                      Gemini 3.1 Pro
                    </button>
                  </div>
                </div>

                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-xs font-semibold text-white/70 uppercase tracking-widest">
                      Instruções de Alteração
                    </label>
                  </div>
                  <textarea 
                    value={refinePrompt}
                    onChange={(e) => setRefinePrompt(e.target.value)}
                    placeholder="Ex: Mude a cor do botão principal para dourado, adicione uma seção de depoimentos..."
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37] transition-all resize-none h-32 mb-3 text-sm"
                  />
                  
                  <div className="flex gap-2">
                    <button 
                      onClick={handleImproveRefinePrompt}
                      disabled={!refinePrompt || isLoading}
                      className="flex-1 py-2.5 border border-white/10 rounded-lg text-xs font-medium hover:bg-white/5 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      title="Melhorar instrução com IA"
                    >
                      <Wand2 className="w-3.5 h-3.5" /> Otimizar
                    </button>
                    <button 
                      onClick={handleRefine}
                      disabled={!refinePrompt || isLoading}
                      className="flex-1 py-2.5 bg-[#d4af37] text-[#0f172a] rounded-lg text-xs font-bold hover:bg-[#b4941f] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" /> Aplicar
                    </button>
                  </div>
                </div>

                <div className="w-full h-px bg-white/5 my-6"></div>

                <div className="mb-6">
                  <label className="text-xs font-semibold text-white/70 uppercase tracking-widest mb-3 block">
                    Histórico de Versões
                  </label>
                  <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg p-1">
                    <button 
                      onClick={undo}
                      disabled={activeProject.historyIndex <= 0}
                      className="flex-1 py-2 text-xs font-medium flex items-center justify-center gap-2 rounded-md hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                    >
                      <Undo className="w-3.5 h-3.5" /> Desfazer
                    </button>
                    <div className="w-px h-4 bg-white/10"></div>
                    <button 
                      onClick={redo}
                      disabled={activeProject.historyIndex >= activeProject.history.length - 1}
                      className="flex-1 py-2 text-xs font-medium flex items-center justify-center gap-2 rounded-md hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                    >
                      Refazer <Redo className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-center text-[10px] text-white/30 mt-2">
                    Versão {activeProject.historyIndex + 1} de {activeProject.history.length}
                  </p>
                </div>

                <div className="mt-auto pt-6 border-t border-white/5">
                  <button 
                    onClick={downloadHtml}
                    className="w-full py-3 bg-white text-[#0f172a] rounded-lg text-sm font-semibold hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" /> Exportar HTML
                  </button>
                </div>

              </div>
            </aside>
          </div>
        </div>
      )}
    </div>
  );

  const renderDesignSystem = () => {
    const filteredDS = savedDesignSystems.filter(ds => 
      ds.name.toLowerCase().includes(dsSearch.toLowerCase())
    );

    return (
      <div className="flex-1 flex flex-col h-full fade-in">
        <header className="h-20 border-b border-white/5 bg-[#0A0A0A] flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-[#d4af37]">
              <Palette className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-medium text-sm">Design System Extractor</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-[10px] text-white/40 uppercase tracking-widest">Extraia padrões de qualquer HTML</p>
                {dsModel === 'claude' ? (
                  <span className="text-[8px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded border border-purple-500/30 font-bold uppercase tracking-tighter">
                    Claude 4.6 Active
                  </span>
                ) : (
                  <span className="text-[8px] bg-[#d4af37]/20 text-[#d4af37] px-1.5 py-0.5 rounded border border-[#d4af37]/30 font-bold uppercase tracking-tighter">
                    Gemini 3.1 Pro Active
                  </span>
                )}
              </div>
            </div>
          </div>

          {dsGeneratedHtml && (
            <div className="flex items-center gap-4">
              <div className="flex bg-white/5 rounded-lg p-1 border border-white/5">
                <button 
                  onClick={() => setDsViewMode('input')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition-all ${dsViewMode === 'input' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white'}`}
                >
                  <Upload className="w-3.5 h-3.5" /> Novo Upload
                </button>
                <button 
                  onClick={() => setDsViewMode('preview')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition-all ${dsViewMode === 'preview' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white'}`}
                >
                  <Monitor className="w-3.5 h-3.5" /> Preview
                </button>
                <button 
                  onClick={() => setDsViewMode('code')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition-all ${dsViewMode === 'code' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white'}`}
                >
                  <Code className="w-3.5 h-3.5" /> Code
                </button>
              </div>
              <div className="w-px h-6 bg-white/10 mx-2"></div>
              {dsViewMode === 'code' && (
                <button 
                  onClick={handleCopy}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${isCopied ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/5'}`}
                >
                  {isCopied ? <Sparkles className="w-3.5 h-3.5" /> : <FileCode2 className="w-3.5 h-3.5" />}
                  {isCopied ? "Copiado!" : "Copiar Código"}
                </button>
              )}
              <button 
                onClick={downloadDesignSystemHtml}
                className="px-4 py-2 bg-[#d4af37] text-[#0f172a] rounded-lg text-xs font-bold hover:bg-[#b4941f] transition-all flex items-center gap-2"
              >
                <Download className="w-3.5 h-3.5" /> Exportar HTML
              </button>
            </div>
          )}
        </header>

        <div className="flex-1 flex relative overflow-hidden bg-[#050505]">
          {dsViewMode === 'input' ? (
            <div className="flex-1 flex flex-col p-10 w-full overflow-y-auto custom-scrollbar">
              {/* Top Section: Upload */}
              <div className="mb-12">
                <div className="mb-6">
                  <h3 className="text-xl font-serif mb-2">Extrair Novo Design System</h3>
                  <p className="text-white/50 text-sm">
                    Faça o upload do arquivo HTML para extrair tipografia, cores e componentes.
                  </p>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2">
                    <div className="w-full h-64 bg-[#0A0A0A] border-2 border-dashed border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center text-center transition-all hover:border-[#d4af37]/50 relative group mb-6">
                      <input 
                        type="file" 
                        accept=".html" 
                        onChange={handleFileUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 group-hover:bg-[#d4af37]/10 transition-colors">
                        <Upload className="w-8 h-8 text-white/40 group-hover:text-[#d4af37] transition-colors" />
                      </div>
                      <h4 className="text-lg font-medium text-white mb-2">
                        {dsFileName ? dsFileName : "Arraste ou clique para enviar"}
                      </h4>
                      <p className="text-white/40 text-sm max-w-md">
                        {dsFileName 
                          ? "Arquivo carregado com sucesso."
                          : "Faça upload de um arquivo .html para extrairmos o Design System completo."}
                      </p>
                    </div>

                    {dsFileName && (
                      <div className="flex flex-col items-center gap-6 animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="flex flex-col items-center gap-3">
                          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">Escolha o Motor de IA</span>
                          <div className="flex bg-white/5 rounded-xl p-1.5 border border-white/10 shadow-2xl">
                            <button 
                              onClick={() => isClaudeActive && setDsModel('claude')}
                              disabled={!isClaudeActive}
                              className={`px-6 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${dsModel === 'claude' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'text-white/40 hover:text-white'} ${!isClaudeActive ? 'opacity-20 cursor-not-allowed' : ''}`}
                              title={!isClaudeActive ? "Claude API key not configured" : ""}
                            >
                              <Sparkles className="w-3.5 h-3.5" /> Claude 4.6
                            </button>
                            <button 
                              onClick={() => setDsModel('gemini')}
                              className={`px-6 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${dsModel === 'gemini' ? 'bg-[#d4af37] text-[#0f172a] shadow-lg shadow-[#d4af37]/20' : 'text-white/40 hover:text-white'}`}
                            >
                              <Sparkles className="w-3.5 h-3.5" /> Gemini 3.1 Pro
                            </button>
                          </div>
                        </div>

                        <button 
                          onClick={() => handleGenerateDesignSystem()}
                          disabled={isLoading}
                          className="group relative px-12 py-4 bg-[#d4af37] text-[#0f172a] rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-[#b4941f] transition-all flex items-center gap-3 shadow-[0_20px_50px_rgba(212,175,55,0.2)] hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:scale-100"
                        >
                          {isLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                          )}
                          {isLoading ? "Processando..." : "Iniciar Extração Premium"}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-6 flex flex-col justify-center">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-[#d4af37]/10 flex items-center justify-center text-[#d4af37]">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <h4 className="font-serif text-lg">Inteligência Aura</h4>
                    </div>
                    <p className="text-sm text-white/50 leading-relaxed mb-6">
                      Nossa IA analisa o código fonte, identifica padrões de design, extrai variáveis de cores e reconstrói componentes fundamentais.
                    </p>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-xs text-white/40">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#d4af37]"></div>
                        Extração de Paleta de Cores
                      </div>
                      <div className="flex items-center gap-2 text-xs text-white/40">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#d4af37]"></div>
                        Mapeamento de Tipografia
                      </div>
                      <div className="flex items-center gap-2 text-xs text-white/40">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#d4af37]"></div>
                        Reconstrução de Componentes
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Section: History */}
              <div className="border-t border-white/5 pt-12 pb-12">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-xl font-serif mb-1">Histórico de Extrações</h3>
                    <p className="text-white/50 text-sm">Acesse design systems gerados anteriormente.</p>
                  </div>
                  <div className="relative w-64">
                    <input 
                      type="text"
                      placeholder="Buscar extrações..."
                      value={dsSearch}
                      onChange={(e) => setDsSearch(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-4 pr-10 text-sm focus:outline-none focus:border-[#d4af37]/50 transition-all"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20">
                      <FileCode2 className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                {filteredDS.length === 0 ? (
                  <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-12 flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 text-white/20">
                      <FileText className="w-8 h-8" />
                    </div>
                    <h4 className="text-white/60 font-medium">Nenhum Design System encontrado</h4>
                    <p className="text-white/30 text-sm mt-1">
                      {dsSearch ? "Tente buscar com outros termos." : "Faça seu primeiro upload acima para começar seu histórico."}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredDS.map(ds => (
                      <div 
                        key={ds.id}
                        onClick={() => loadDesignSystem(ds)}
                        className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-5 hover:border-[#d4af37]/30 hover:shadow-xl transition-all cursor-pointer group relative"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-[#d4af37] group-hover:bg-[#d4af37]/10 transition-colors">
                            <Palette className="w-5 h-5" />
                          </div>
                          <button 
                            onClick={(e) => deleteDesignSystem(ds.id, e)}
                            className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 transition-all p-2 rounded-md hover:bg-white/5"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <h4 className="font-medium text-white mb-1 line-clamp-1 group-hover:text-[#d4af37] transition-colors">{ds.name}</h4>
                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
                          <span className="text-[10px] text-white/30 uppercase tracking-widest">
                            {ds.createdAt.toLocaleDateString('pt-BR')}
                          </span>
                          <span className="text-[10px] bg-white/5 px-2 py-1 rounded text-white/50 flex items-center gap-1">
                            <Monitor className="w-3 h-3" /> Visualizar
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : dsViewMode === 'preview' ? (
            <iframe 
              ref={dsIframeRef}
              className="w-full h-full border-none bg-white"
              title="Design System Preview"
              sandbox="allow-scripts allow-same-origin"
            />
          ) : (
            <div className="w-full h-full bg-[#0A0A0A] p-6 overflow-auto custom-scrollbar">
              <pre className="text-xs font-mono text-gray-300 whitespace-pre-wrap">
                {dsGeneratedHtml}
              </pre>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!isAuthReady) {
    return (
      <div className="flex h-screen bg-[#050505] text-white font-sans items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#d4af37] animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <div className="flex h-screen bg-[#050505] text-white font-sans overflow-hidden">
      
      {/* Modal */}
      {modalConfig.isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-white/10 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-2">{modalConfig.title}</h3>
            <p className="text-white/70 mb-6">{modalConfig.message}</p>
            <div className="flex justify-end gap-3">
              {modalConfig.type === 'confirm' && (
                <button 
                  onClick={() => setModalConfig({ ...modalConfig, isOpen: false })}
                  className="px-4 py-2 text-white/70 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
              )}
              <button 
                onClick={() => {
                  if (modalConfig.type === 'confirm' && modalConfig.onConfirm) {
                    modalConfig.onConfirm();
                  }
                  setModalConfig({ ...modalConfig, isOpen: false });
                }}
                className="px-4 py-2 bg-[#d4af37] text-[#0f172a] font-bold rounded-lg hover:bg-[#b4941f] transition-colors"
              >
                {modalConfig.type === 'confirm' ? 'Confirmar' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-[100] bg-[#050505]/80 backdrop-blur-sm flex flex-col items-center justify-center">
          <Loader2 className="w-12 h-12 text-[#d4af37] animate-spin mb-6" />
          <h3 className="text-2xl font-serif text-white mb-2">{loadingText}</h3>
          <p className="text-white/50 text-sm">A inteligência artificial está trabalhando no design...</p>
        </div>
      )}

      {/* LEFT SIDEBAR - Main Navigation */}
      <aside className="w-64 bg-[#0A0A0A] border-r border-white/5 flex flex-col z-30 flex-shrink-0">
        <div className="h-20 px-6 border-b border-white/5 flex items-center flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#d4af37] rounded flex items-center justify-center text-[#0f172a]">
              <Scale className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-serif text-xl font-semibold tracking-tight leading-none">Aura<span className="text-[#d4af37] italic">Law</span></span>
              <span className="text-[9px] uppercase tracking-[0.2em] text-white/40 mt-1">Studio</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <button 
            onClick={() => setCurrentView('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${currentView === 'dashboard' ? 'bg-[#d4af37]/10 text-[#d4af37]' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}
          >
            <Home className="w-4 h-4" /> Dashboard
          </button>
          <button 
            onClick={() => setCurrentView('projects')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${currentView === 'projects' || currentView === 'editor' ? 'bg-[#d4af37]/10 text-[#d4af37]' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}
          >
            <Layout className="w-4 h-4" /> Projetos
          </button>
          <button 
            onClick={() => setCurrentView('clients')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${currentView === 'clients' ? 'bg-[#d4af37]/10 text-[#d4af37]' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}
          >
            <Users className="w-4 h-4" /> Clientes
          </button>
          <div className="w-full h-px bg-white/5 my-2"></div>
          <button 
            onClick={() => setCurrentView('design-system')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${currentView === 'design-system' ? 'bg-[#d4af37]/10 text-[#d4af37]' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}
          >
            <Palette className="w-4 h-4" /> Design System
          </button>
        </nav>

        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-3 px-4 py-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center overflow-hidden">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName || "User"} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <Users className="w-4 h-4 text-white/50" />
              )}
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-xs font-medium truncate">{user.displayName || "Usuário"}</span>
              <span className="text-[10px] text-white/40 truncate">{user.email}</span>
            </div>
          </div>
          <button 
            onClick={() => signOut(auth)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-red-400 hover:bg-red-400/10 transition-all"
          >
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col relative min-w-0 overflow-y-auto bg-[#050505]">
        <style>{`
          .fade-in { animation: fadeIn 0.3s ease-in-out; }
          @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
        `}</style>
        
        {currentView === 'dashboard' && renderDashboard()}
        {currentView === 'clients' && renderClients()}
        {currentView === 'projects' && renderProjectsList()}
        {currentView === 'editor' && renderEditor()}
        {currentView === 'design-system' && renderDesignSystem()}

      </main>
    </div>
  );
}

export default App;
