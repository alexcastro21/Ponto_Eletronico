import React, { useState, useEffect, useRef } from "react";
import { 
  Users, Clock, Calendar, Settings, FileText, CheckSquare, LayoutDashboard, 
  Plus, Search, Edit, Trash2, LogOut, RefreshCw, Sliders, Download, 
  Database, AlertCircle, CheckCircle, ShieldAlert, BadgeInfo, Camera, AlertTriangle
} from "lucide-react";
import { Employee, TimeLog, AjusteRequest, SystemLog, SystemConfig, TimeLogType, Company, Scale } from "../types";

interface AdminDashboardProps {
  onLogout: () => void;
}

const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%236366f1'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";

export default function AdminDashboard({ onLogout }: AdminDashboardProps) {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'overview' | 'employees' | 'logs' | 'ajustes' | 'settings' | 'audit' | 'companies' | 'escalas'>('overview');

  // Sidebar drag to scroll & smooth controls helper
  const asideRef = useRef<HTMLDivElement>(null);
  const [isAsideDragging, setIsAsideDragging] = useState(false);
  const [asideStartX, setAsideStartX] = useState(0);
  const [asideScrollLeft, setAsideScrollLeft] = useState(0);

  const handleAsideMouseDown = (e: React.MouseEvent) => {
    if (!asideRef.current) return;
    setIsAsideDragging(true);
    setAsideStartX(e.pageX - asideRef.current.offsetLeft);
    setAsideScrollLeft(asideRef.current.scrollLeft);
  };

  const handleAsideMouseLeaveOrUp = () => {
    setIsAsideDragging(false);
  };

  const handleAsideMouseMove = (e: React.MouseEvent) => {
    if (!isAsideDragging || !asideRef.current) return;
    e.preventDefault();
    const x = e.pageX - asideRef.current.offsetLeft;
    const walk = (x - asideStartX) * 1.5; // Scroll speed multiplier
    asideRef.current.scrollLeft = asideScrollLeft - walk;
  };

  const scrollAside = (direction: 'left' | 'right') => {
    if (!asideRef.current) return;
    const scrollAmount = 180;
    asideRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

  // DB States
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [logs, setLogs] = useState<TimeLog[]>([]);
  const [ajustes, setAjustes] = useState<AjusteRequest[]>([]);
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [escalas, setEscalas] = useState<Scale[]>([]);
  const [config, setConfig] = useState<SystemConfig>({
    toleranciaMinutos: 10,
    empresaNome: "Empresa Tecnologia S.A.",
    timezone: "America/Sao_Paulo",
    sheetsId: "",
    sheetsEnabled: false
  });

  // Loading States
  const [loading, setLoading] = useState(true);
  const [syncingSheets, setSyncingSheets] = useState(false);
  const [dbUpdateTrigger, setDbUpdateTrigger] = useState(0);

  // Search/Filters states
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [logSearch, setLogSearch] = useState("");
  const [logTypeFilter, setLogTypeFilter] = useState<string>("all");
  const [logStatusFilter, setLogStatusFilter] = useState<string>("all");

  // Crud modaling
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [empForm, setEmpForm] = useState({
    nome: "",
    cpf: "",
    cargo: "",
    setor: "",
    entrada: "08:00",
    almocoSaida: "12:00",
    almocoRetorno: "13:00",
    saida: "17:00",
    fotoUrl: "",
    empresaId: "",
    escalaId: "",
    assinaturaDigital: ""
  });
  const [rawPhotoUpload, setRawPhotoUpload] = useState<string | null>(null);
  const [usingCameraForProfile, setUsingCameraForProfile] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const profileVideoRef = useRef<HTMLVideoElement>(null);
  const profileCanvasRef = useRef<HTMLCanvasElement>(null);

  // Manual register modal
  const [isManualPontoModalOpen, setIsManualPontoModalOpen] = useState(false);
  const [manualForm, setManualForm] = useState({
    cpf: "",
    data: new Date().toISOString().split("T")[0],
    hora: "08:00",
    tipo: "entrada" as TimeLogType
  });

  // Companies and scale form submit handlers
  const [compForm, setCompForm] = useState({ nome: "", cnpj: "", endereco: "" });
  const [scaleForm, setScaleForm] = useState({
    nome: "",
    cargaHoraria: "44h semanais",
    entrada: "08:00",
    almocoSaida: "12:00",
    almocoRetorno: "13:00",
    saida: "17:00",
    tolerancia: 10
  });

  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!compForm.nome || !compForm.cnpj) {
      showToast("Preencha o Nome e o CNPJ da empresa.", "error");
      return;
    }
    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(compForm)
      });
      if (res.ok) {
        showToast("Empresa cadastrada com sucesso!", "success");
        setCompForm({ nome: "", cnpj: "", endereco: "" });
        setDbUpdateTrigger(prev => prev + 1);
      } else {
        const errorData = await res.json();
        showToast(errorData.error || "Erro ao cadastrar empresa.", "error");
      }
    } catch (err) {
      showToast("Falha de comunicação operacional.", "error");
    }
  };

  const handleDeleteCompany = async (id: string, nome: string) => {
    if (!confirm(`Deseja inativar o cadastro da empresa '${nome}'?`)) return;
    try {
      const res = await fetch(`/api/companies/${id}`, { method: "DELETE" });
      if (res.ok) {
        showToast(`Empresa '${nome}' inativada.`, "success");
        setDbUpdateTrigger(prev => prev + 1);
      } else {
        showToast("Erro ao inativar empresa.", "error");
      }
    } catch (err) {
      showToast("Falha no servidor.", "error");
    }
  };

  const handleAddScale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scaleForm.nome || !scaleForm.entrada || !scaleForm.saida) {
      showToast("Nome, entrada e saída são obrigatórios.", "error");
      return;
    }
    try {
      const res = await fetch("/api/escalas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scaleForm)
      });
      if (res.ok) {
        showToast("Escala de trabalho cadastrada!", "success");
        setScaleForm({
          nome: "",
          cargaHoraria: "44h semanais",
          entrada: "08:00",
          almocoSaida: "12:00",
          almocoRetorno: "13:00",
          saida: "17:00",
          tolerancia: 10
        });
        setDbUpdateTrigger(prev => prev + 1);
      } else {
        const errorData = await res.json();
        showToast(errorData.error || "Erro ao criar jornada.", "error");
      }
    } catch (err) {
      showToast("Erro técnico de envio.", "error");
    }
  };

  const handleDeleteScale = async (id: string, nome: string) => {
    if (!confirm(`Deseja deletar a escala de jornada '${nome}'?`)) return;
    try {
      const res = await fetch(`/api/escalas/${id}`, { method: "DELETE" });
      if (res.ok) {
        showToast(`Escala '${nome}' removida com sucesso.`, "success");
        setDbUpdateTrigger(prev => prev + 1);
      } else {
        showToast("Erro ao remover escala.", "error");
      }
    } catch (err) {
      showToast("Erro operacional.", "error");
    }
  };

  // Feedback notification overlays
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Fetch full data
  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/db");
      const db = await response.json();
      setEmployees(db.employees);
      setLogs(db.logs);
      setAjustes(db.ajustes);
      setConfig(db.config);
      setSystemLogs(db.systemLogs);
      setCompanies(db.companies || []);
      setEscalas(db.escalas || []);
    } catch (err) {
      showToast("Não foi possível sincronizar informações do servidor de ponto.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dbUpdateTrigger]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Google Sheets sync trigger
  const handleSheetsSync = async () => {
    setSyncingSheets(true);
    try {
      const response = await fetch("/api/sheets/sync", { method: "POST" });
      const data = await response.json();
      if (data.success) {
        showToast(data.message, "success");
        setDbUpdateTrigger(prev => prev + 1);
      } else {
        showToast(data.message, "info");
      }
    } catch {
      showToast("Erro na comunicação com a API de sincronização.", "error");
    } finally {
      setSyncingSheets(false);
    }
  };

  // Trigger Camera for employee profile picture
  const startProfileCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 320, facingMode: "user" } });
      setCameraStream(stream);
      setUsingCameraForProfile(true);
      setTimeout(() => {
        if (profileVideoRef.current) {
          profileVideoRef.current.srcObject = stream;
        }
      }, 300);
    } catch (err) {
      showToast("Não foi possível abrir a webcam secundária.", "error");
    }
  };

  const stopProfileCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setUsingCameraForProfile(false);
  };

  const snapProfilePicture = () => {
    if (profileVideoRef.current && profileCanvasRef.current) {
      const video = profileVideoRef.current;
      const canvas = profileCanvasRef.current;
      canvas.width = 300;
      canvas.height = 300;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(-1, 1);
        ctx.drawImage(video, -300, 0, 300, 300);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
        setRawPhotoUpload(dataUrl);
        setEmpForm(p => ({ ...p, fotoUrl: dataUrl }));
        stopProfileCamera();
      }
    }
  };

  // Save Config changes
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config)
      });
      if (response.ok) {
        showToast("Configurações atualizadas com sucesso e replicadas.", "success");
        setDbUpdateTrigger(prev => prev + 1);
      } else {
        showToast("Erro ao arquivar configurações.", "error");
      }
    } catch {
      showToast("Falha de comunicação de rede.", "error");
    }
  };

  // Save or Create Employee
  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empForm.nome || !empForm.cpf) {
      showToast("Nome e CPF são mandatórios.", "error");
      return;
    }

    try {
      const method = editingEmployee ? "PUT" : "POST";
      const url = editingEmployee ? `/api/employees/${editingEmployee.id}` : "/api/employees";

      const payload = {
        ...empForm,
        fotoUrl: rawPhotoUpload || empForm.fotoUrl
      };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || "Erro de validação operacional.");
      }

      showToast(editingEmployee ? "Dados do funcionário atualizados." : "Novo funcionário cadastrado.", "success");
      setIsEmployeeModalOpen(false);
      setEditingEmployee(null);
      resetEmployeeForm();
      setDbUpdateTrigger(prev => prev + 1);
    } catch (err: any) {
      showToast(err.message || "Erro ao gravar dados do colaborador.", "error");
    }
  };

  // Open Edit Employee modal
  const handleEditEmployeeClick = (emp: Employee) => {
    setEditingEmployee(emp);
    setEmpForm({
      nome: emp.nome,
      cpf: emp.cpf,
      cargo: emp.cargo,
      setor: emp.setor,
      entrada: emp.entrada,
      almocoSaida: emp.almocoSaida,
      almocoRetorno: emp.almocoRetorno,
      saida: emp.saida,
      fotoUrl: emp.fotoUrl,
      empresaId: emp.empresaId || "",
      escalaId: emp.escalaId || "",
      assinaturaDigital: emp.assinaturaDigital || ""
    });
    setRawPhotoUpload(emp.fotoUrl && emp.fotoUrl.startsWith("data:") ? emp.fotoUrl : null);
    setIsEmployeeModalOpen(true);
  };

  // Soft Delete Employee
  const handleDeleteEmployee = async (id: string, nome: string) => {
    if (!confirm(`Deseja realmente inativar o funcionário ${nome}? Seus históricos de ponto serão integralmente preservados para fins de auditoria.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/employees/${id}`, { method: "DELETE" });
      if (response.ok) {
        showToast(`Funcionário ${nome} desativado do ponto ativo.`, "success");
        setDbUpdateTrigger(prev => prev + 1);
      } else {
        showToast("Falha ao desativar registro.", "error");
      }
    } catch {
      showToast("Não foi possível excluir.", "error");
    }
  };

  // Adjustments handling
  const handleAjusteAction = async (id: string, status: 'aprovado' | 'reprovado') => {
    try {
      const response = await fetch(`/api/ajustes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      if (response.ok) {
        showToast(`Solicitação de ajuste fiscal e ponto ${status.toUpperCase()}.`, "success");
        setDbUpdateTrigger(prev => prev + 1);
      } else {
        showToast("Erro ao atualizar solicitação.", "error");
      }
    } catch {
      showToast("Falha técnica no processo.", "error");
    }
  };

  // Process Manual Point register by admin
  const handleManualPontoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualForm.cpf || !manualForm.data || !manualForm.hora) {
      showToast("Preencha todos os campos do formulário.", "error");
      return;
    }

    try {
      const response = await fetch("/api/ponto/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(manualForm)
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Não foi possível lançar ponto manual.");
      }

      showToast("Lançamento administrativo de ponto registrado com sucesso.", "success");
      setIsManualPontoModalOpen(false);
      setManualForm({
        cpf: "",
        data: new Date().toISOString().split("T")[0],
        hora: "08:00",
        tipo: "entrada"
      });
      setDbUpdateTrigger(prev => prev + 1);
    } catch (err: any) {
      showToast(err.message || "Erro no lançamento manual.", "error");
    }
  };

  const handlePhotoUploadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        showToast("As imagens de perfil devem ser menores que 2MB.", "error");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const b64 = event.target.result as string;
          setRawPhotoUpload(b64);
          setEmpForm(p => ({ ...p, fotoUrl: b64 }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const resetEmployeeForm = () => {
    setEmpForm({
      nome: "",
      cpf: "",
      cargo: "",
      setor: "",
      entrada: "08:00",
      almocoSaida: "12:00",
      almocoRetorno: "13:00",
      saida: "17:00",
      fotoUrl: "",
      empresaId: "",
      escalaId: "",
      assinaturaDigital: ""
    });
    setRawPhotoUpload(null);
    stopProfileCamera();
  };

  // CSV Exporter for records
  const exportLogsToCSV = () => {
    if (logs.length === 0) {
      showToast("Não há registros de ponto para exportar.", "info");
      return;
    }

    const headers = ["ID Registro", "CPF Colaborador", "Nome Colaborador", "Data Falada", "Horário Batida", "Tipo Operação", "Enquadramento Penal", "Confiança Biometrica", "Empresa Registrada", "IP do Dispositivo", "Validação Liveness", "Assinatura Digital (SHA-256 REP-P)"];
    const rows = filteredLogs.map(l => [
      l.id,
      l.cpf,
      l.nome,
      l.data,
      l.hora,
      l.tipo.toUpperCase(),
      l.status.toUpperCase(),
      l.confidence.toFixed(2),
      getCompanyName(l.empresaId),
      l.ip || "127.0.0.1",
      l.liveness || "Liveness Validada",
      l.hash || "-"
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(";"), ...rows.map(e => e.join(";"))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Relatorio_Patente_SmartPoint_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Relatório de Auditoria REP-P em CSV exportado com assinaturas eletrônicas.", "success");
  };

  // Calculations for Admin indicators
  const getCompanyName = (empId?: string) => {
    if (!empId) return "Empresa Principal";
    const comp = companies.find(c => c.id === empId);
    return comp ? comp.nome : "Empresa Principal";
  };

  const getScaleName = (scaleId?: string) => {
    if (!scaleId) return "Escala Padrão";
    const scale = escalas.find(s => s.id === scaleId);
    return scale ? scale.nome : "Escala Padrão";
  };

  const activeEmployees = employees.filter(e => e.status === "ativo");
  const todayStr = new Date().toISOString().split("T")[0];
  const logsToday = logs.filter(l => l.data === todayStr);
  const presentCount = new Set(logsToday.map(l => l.cpf)).size;
  const absentCount = Math.max(0, activeEmployees.length - presentCount);
  const lateTodayCount = logsToday.filter(l => l.status === "atrasado").length;

  // Filter lists based on UI Search criteria
  const filteredEmployees = activeEmployees.filter(e => 
    e.nome.toLowerCase().includes(employeeSearch.toLowerCase()) ||
    e.cpf.includes(employeeSearch) ||
    e.cargo.toLowerCase().includes(employeeSearch.toLowerCase()) ||
    e.setor.toLowerCase().includes(employeeSearch.toLowerCase())
  );

  const filteredLogs = logs.filter(l => {
    const matchesSearch = l.nome.toLowerCase().includes(logSearch.toLowerCase()) || l.cpf.includes(logSearch);
    const matchesType = logTypeFilter === "all" ? true : l.tipo === logTypeFilter;
    const matchesStatus = logStatusFilter === "all" ? true : l.status === logStatusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const formatCpf = (v: string) => {
    v = v.replace(/\D/g, "");
    if (v.length > 11) v = v.slice(0, 11);
    if (v.length === 11) {
      return `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9)}`;
    }
    return v;
  };

  return (
    <div className="w-full min-h-screen bg-[#070a13] text-gray-200 flex flex-col font-sans relative">
      
      {/* Upper global header */}
      <nav className="border-b border-gray-850/60 bg-gray-900/50 backdrop-blur-md sticky top-0 z-30 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/10 shrink-0">
            <LayoutDashboard className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[9px] text-blue-400 font-mono tracking-widest uppercase">Módulo do Administrador</span>
            <h1 className="text-md font-bold text-white tracking-wide">SmartPoint Painel</h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={handleSheetsSync}
            disabled={syncingSheets}
            className="text-xs bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/25 px-3.5 py-2 rounded-lg font-medium transition-all flex items-center gap-1.5"
          >
            {syncingSheets ? <RefreshCw className="h-4.5 w-4.5 animate-spin" /> : <Database className="h-4 w-4" />}
            Sincronizar Sheets
          </button>
          
          <button
            onClick={onLogout}
            className="text-xs bg-gray-900 border border-gray-800 text-gray-400 hover:text-white px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 active:scale-[0.98]"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </nav>

      {/* Frame content layout */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto p-4 md:p-6 gap-6 flex-col md:flex-row relative">
        
        {/* Mobile menu indicators and buttons to slide sideways */}
        <div className="md:hidden flex items-center justify-between p-2.5 bg-[#121829] border border-gray-850 rounded-xl tracking-wider shrink-0 mb-1">
          <span className="text-[10px] font-bold text-gray-400 uppercase font-mono">Menu do Painel</span>
          <div className="flex items-center gap-1.5">
            <button 
              onClick={() => scrollAside('left')} 
              className="px-2.5 py-1 bg-gray-800/80 hover:bg-gray-700 hover:text-white border border-gray-700/80 text-gray-300 rounded-md text-[10px] font-bold uppercase transition-all active:scale-95 cursor-pointer"
              title="Voltar Menu"
            >
              &larr; Deslizar
            </button>
            <button 
              onClick={() => scrollAside('right')} 
              className="px-2.5 py-1 bg-gray-800/80 hover:bg-gray-700 hover:text-white border border-gray-700/80 text-gray-300 rounded-md text-[10px] font-bold uppercase transition-all active:scale-95 cursor-pointer"
              title="Avançar Menu"
            >
              Avançar &rarr;
            </button>
          </div>
        </div>

        {/* Sidebar Navigation - horizontal scrolling list on mobile, vertical sidebar on desktop */}
        <aside 
          ref={asideRef}
          onMouseDown={handleAsideMouseDown}
          onMouseLeave={handleAsideMouseLeaveOrUp}
          onMouseUp={handleAsideMouseLeaveOrUp}
          onMouseMove={handleAsideMouseMove}
          className="w-full md:w-64 bg-gray-900/40 border border-gray-850/60 rounded-xl p-3 md:p-4 shrink-0 flex flex-row md:flex-col overflow-x-auto md:overflow-visible whitespace-nowrap md:whitespace-normal space-x-2 md:space-x-0 md:space-y-1.5 h-fit backdrop-blur-sm shadow-xl pb-4 md:pb-4 cursor-grab active:cursor-grabbing select-none"
        >
          <span className="hidden md:inline-block text-[10px] font-mono text-gray-500 uppercase tracking-widest px-3.5 py-1 mb-2">GERAL</span>
          
          <button
            onClick={() => setActiveTab('overview')}
            className={`text-xs font-semibold py-2 px-3.5 rounded-lg transition-all flex items-center gap-2.5 shrink-0 w-auto md:w-full ${
              activeTab === 'overview' ? "bg-blue-600 text-white font-bold" : "text-gray-400 hover:text-white hover:bg-gray-850/50"
            }`}
          >
            <LayoutDashboard className="h-4.5 w-4.5 shrink-0" />
            Visão Geral / Métricas
          </button>

          <button
            onClick={() => setActiveTab('employees')}
            className={`text-xs font-semibold py-2 px-3.5 rounded-lg transition-all flex items-center gap-2.5 shrink-0 w-auto md:w-full ${
              activeTab === 'employees' ? "bg-blue-600 text-white font-bold" : "text-gray-400 hover:text-white hover:bg-gray-850/50"
            }`}
          >
            <Users className="h-4.5 w-4.5 shrink-0" />
            Gestão Funcionários
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`text-xs font-semibold py-2 px-3.5 rounded-lg transition-all flex items-center gap-2.5 shrink-0 w-auto md:w-full ${
              activeTab === 'logs' ? "bg-blue-600 text-white font-bold" : "text-gray-400 hover:text-white hover:bg-gray-850/50"
            }`}
          >
            <Clock className="h-4.5 w-4.5 shrink-0" />
            Histórico de Pontos
          </button>

          <span className="hidden md:inline-block text-[10px] font-mono text-gray-500 uppercase tracking-widest px-3.5 py-1 mt-4 mb-2">SOLICITAÇÕES</span>

          <button
            onClick={() => setActiveTab('ajustes')}
            className={`text-xs font-semibold py-2 px-3.5 rounded-lg transition-all flex items-center justify-between shrink-0 w-auto md:w-full ${
              activeTab === 'ajustes' ? "bg-blue-600 text-white font-bold" : "text-gray-400 hover:text-white hover:bg-gray-850/50"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <CheckSquare className="h-4.5 w-4.5 shrink-0" />
              Ajustes de Ponto
            </div>
            {ajustes.filter(a => a.status === 'pendente').length > 0 && (
              <span className="text-[9px] font-semibold bg-indigo-500 text-white py-0.5 px-1.5 rounded-full ring-2 ring-gray-900 shrink-0 ml-1.5">
                {ajustes.filter(a => a.status === 'pendente').length}
              </span>
            )}
          </button>

          <span className="hidden md:inline-block text-[10px] font-mono text-gray-500 uppercase tracking-widest px-3.5 py-1 mt-4 mb-2">GERENCIAMENTO</span>

          <button
            onClick={() => setActiveTab('settings')}
            className={`text-xs font-semibold py-2 px-3.5 rounded-lg transition-all flex items-center gap-2.5 shrink-0 w-auto md:w-full ${
              activeTab === 'settings' ? "bg-blue-600 text-white font-bold" : "text-gray-400 hover:text-white hover:bg-gray-850/50"
            }`}
          >
            <Settings className="h-4.5 w-4.5 shrink-0" />
            Regras & Tolerâncias
          </button>

          <button
            onClick={() => setActiveTab('companies')}
            className={`text-xs font-semibold py-2 px-3.5 rounded-lg transition-all flex items-center gap-2.5 shrink-0 w-auto md:w-full ${
              activeTab === 'companies' ? "bg-blue-600 text-white font-bold" : "text-gray-400 hover:text-white hover:bg-gray-850/50"
            }`}
          >
            <Database className="h-4.5 w-4.5 text-blue-400 shrink-0" />
            Cadastros de Empresas
          </button>

          <button
            onClick={() => setActiveTab('escalas')}
            className={`text-xs font-semibold py-2 px-3.5 rounded-lg transition-all flex items-center gap-2.5 shrink-0 w-auto md:w-full ${
              activeTab === 'escalas' ? "bg-blue-600 text-white font-bold" : "text-gray-400 hover:text-white hover:bg-gray-850/50"
            }`}
          >
            <Sliders className="h-4.5 w-4.5 text-indigo-400 shrink-0" />
            Escalas de Jornada
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`text-xs font-semibold py-2 px-3.5 rounded-lg transition-all flex items-center gap-2.5 shrink-0 w-auto md:w-full ${
              activeTab === 'audit' ? "bg-blue-600 text-white font-bold" : "text-gray-400 hover:text-white hover:bg-gray-850/50"
            }`}
          >
            <FileText className="h-4.5 w-4.5 shrink-0" />
            Logs de Auditoria
          </button>
        </aside>

        {/* Content Panel Area */}
        <main className="flex-1 bg-gray-900/25 border border-gray-855/40 rounded-xl p-6 min-h-[500px] flex flex-col justify-start relative backdrop-blur-sm overflow-x-auto shadow-2xl">
          
          {loading && (
            <div className="absolute inset-0 bg-gray-950/40 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-xl">
              <RefreshCw className="h-8 w-8 text-blue-500 animate-spin mb-2" />
              <p className="text-xs text-gray-400">Carregando base de dados SmartPoint...</p>
            </div>
          )}

          {/* Active Tab: Overview Dashboard */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">Atividade Geral</h2>
                  <p className="text-xs text-gray-400">Visão consolidada em tempo real de assiduidade corporativa.</p>
                </div>
                <div className="text-xs text-gray-400 bg-gray-900 p-2.5 rounded-lg border border-gray-850/60 font-mono flex items-center gap-1.5 shrink-0">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Sincronização Ativa: <b>{config.empresaNome}</b>
                </div>
              </div>

              {/* Indicator Cards Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-[#121829] border border-gray-800/80 rounded-xl p-4 shadow-md">
                  <div className="flex items-center justify-between text-gray-400 mb-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider">Presentes no Dia</span>
                    <Users className="h-4 w-4 text-blue-500" />
                  </div>
                  <div className="text-2xl font-black text-white">{presentCount}</div>
                  <div className="text-[10px] text-gray-500 mt-1">Colaboradores ativos</div>
                </div>

                <div className="bg-[#121829] border border-gray-800/80 rounded-xl p-4 shadow-md">
                  <div className="flex items-center justify-between text-gray-400 mb-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider">Faltosos no Dia</span>
                    <ShieldAlert className="h-4 w-4 text-indigo-400" />
                  </div>
                  <div className="text-2xl font-black text-white">{absentCount}</div>
                  <div className="text-[10px] text-gray-500 mt-1">Ausentes sem ponto lançado</div>
                </div>

                <div className="bg-[#121829] border border-gray-800/80 rounded-xl p-4 shadow-md">
                  <div className="flex items-center justify-between text-gray-400 mb-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider">Atrasos Registrados</span>
                    <AlertTriangle className={`h-4 w-4 ${lateTodayCount > 0 ? 'text-amber-500 animate-pulse' : 'text-gray-600'}`} />
                  </div>
                  <div className="text-2xl font-black text-white">{lateTodayCount}</div>
                  <div className="text-[10px] text-gray-500 mt-1">Hoje fora de limite tolerado</div>
                </div>

                <div className="bg-[#121829] border border-gray-800/80 rounded-xl p-4 shadow-md">
                  <div className="flex items-center justify-between text-gray-400 mb-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider">Total Funcionários</span>
                    <Database className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div className="text-2xl font-black text-white">{activeEmployees.length}</div>
                  <div className="text-[10px] text-gray-500 mt-1">Base funcional ativa</div>
                </div>
              </div>

              {/* Graphic Indicators Panel Layout with beautifully stylized native SVGs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Visualizer SVGs panel 1 */}
                <div className="bg-[#121829] border border-gray-800/80 rounded-xl p-5 shadow-lg">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4">COMPARAÇÃO DE ASSIDUIDADE DE HOJE</h3>
                  <div className="flex items-center justify-around flex-col sm:flex-row gap-4">
                    
                    {/* SVG Pie Representation */}
                    <div className="relative h-32 w-32 shrink-0">
                      <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                        <circle cx="18" cy="18" r="15.915" fill="none" stroke="#1f2937" strokeWidth="3" />
                        {activeEmployees.length > 0 && (
                          <circle 
                            cx="18" cy="18" r="15.915" 
                            fill="none" 
                            stroke="#3b82f6" 
                            strokeWidth="3.2" 
                            strokeDasharray={`${(presentCount / activeEmployees.length) * 100} ${100 - (presentCount / activeEmployees.length) * 100}`}
                            strokeDashoffset="0" 
                          />
                        )}
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-xl font-black text-white">
                          {activeEmployees.length > 0 ? `${Math.round((presentCount / activeEmployees.length) * 100)}%` : "0%"}
                        </span>
                        <span className="text-[8px] text-gray-500 font-mono tracking-widest uppercase">Presentes</span>
                      </div>
                    </div>

                    <div className="space-y-2 select-none">
                      <div className="flex items-center gap-2.5 text-xs text-gray-300">
                        <span className="h-3 w-3 rounded bg-blue-500 inline-block shrink-0"></span>
                        <span>Confirmados ({presentCount})</span>
                      </div>
                      <div className="flex items-center gap-2.5 text-xs text-gray-300">
                        <span className="h-3 w-3 rounded bg-gray-800 inline-block shrink-0"></span>
                        <span>Pendentes/Ausentes ({absentCount})</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Dashboard logs overview timeline */}
                <div className="bg-[#121829] border border-gray-800/80 rounded-xl p-5 shadow-lg flex flex-col justify-between">
                  <div className="flex items-center justify-between pb-3 border-b border-gray-850/60 mb-3">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">Últimos Lançamentos</h3>
                    <button onClick={() => setActiveTab('logs')} className="text-[10px] text-blue-400 hover:text-blue-300 font-semibold uppercase">Ver todos</button>
                  </div>

                  <div className="space-y-3 flex-1 overflow-y-auto max-h-[160px]">
                    {logs.slice(0, 4).map((log) => (
                      <div key={log.id} className="flex justify-between items-center text-xs p-2 rounded-lg bg-gray-900/40 border border-gray-850/40 hover:border-gray-800 transition-all">
                        <div className="flex items-center gap-2">
                          <img src={log.fotoUrl} alt="verification tag" className="h-7 w-7 rounded-md bg-gray-990 border border-gray-800 shrink-0" onError={(e) => {
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%232563eb"/><circle cx="50" cy="40" r="20" fill="%23eff6ff"/></svg>';
                          }} />
                          <div>
                            <p className="font-semibold text-white">{log.nome}</p>
                            <span className="text-[10px] text-gray-400">{log.tipo.replace("_", " ").toUpperCase()}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-white font-semibold">{log.hora}</p>
                          <span className={`text-[9px] font-mono px-1 rounded-sm uppercase ${
                            log.status === 'atrasado' ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'
                          }`}>
                            {log.status === 'atrasado' ? 'Atrasado' : 'No Prazo'}
                          </span>
                        </div>
                      </div>
                    ))}
                    {logs.length === 0 && (
                      <p className="text-xs text-gray-500 text-center py-8">Nenhum ponto registrado hoje ainda.</p>
                    )}
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* Active Tab: Employees List CRUD */}
          {activeTab === 'employees' && (
            <div className="space-y-4">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">Gestão de Funcionários ({activeEmployees.length})</h2>
                  <p className="text-xs text-gray-400">Gerencie perfis, cargas horárias e fotos biométricas do Reconhecimento Facial.</p>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingEmployee(null);
                      resetEmployeeForm();
                      setIsEmployeeModalOpen(true);
                    }}
                    className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold py-2 px-4 rounded-xl shadow-md shadow-blue-500/10 cursor-pointer transition-all flex items-center gap-1.5 active:scale-[0.98]"
                  >
                    <Plus className="h-4.5 w-4.5" />
                    Novo Funcionário
                  </button>
                </div>
              </div>

              {/* Seaching filter block bar */}
              <div className="relative">
                <Search className="h-4 w-4 text-gray-500 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Pesquisar por nome, CPF, setor ou cargo corporativo..."
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  className="w-full bg-[#111625] border border-gray-850 hover:border-gray-800 text-xs text-white rounded-xl py-3 pl-10 pr-4 outline-none transition-all focus:ring-1 focus:ring-blue-500/25 focus:border-blue-500 placeholder:text-gray-500"
                />
              </div>

              {/* Mobile Swipe Hint */}
              <div className="sm:hidden flex items-center gap-1.5 p-2.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg text-[11px] animate-pulse">
                <span>↔</span>
                <p><b>Dica responsiva:</b> Deslize a tabela para a direita se quiser acessar as ações de <b>Editar</b> e <b>Apagar</b>.</p>
              </div>

              {/* Employee Grid/Table */}
              <div className="bg-[#121829] border border-gray-800/80 rounded-xl overflow-hidden shadow-lg mt-4 w-full">
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-left text-xs border-collapse divide-y divide-gray-850/60 min-w-[720px]">
                  <thead className="bg-[#182035]/80 text-gray-400 font-mono text-[10px] uppercase">
                    <tr>
                      <th className="py-3.5 px-4 font-bold">Biometria</th>
                      <th className="py-3.5 px-4 font-bold">Nome completo / CPF</th>
                      <th className="py-3.5 px-4 font-bold">Setor / Cargo</th>
                      <th className="py-3.5 px-4 font-bold">Escala / Turno</th>
                      <th className="py-3.5 px-4 font-bold text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-850/40 divide-dashed">
                    {filteredEmployees.map((emp) => (
                      <tr key={emp.id} className="hover:bg-gray-850/20 transition-all">
                        <td className="py-3 px-4 shrink-0">
                          <img 
                            src={emp.fotoUrl} 
                            alt={emp.nome} 
                            className="h-10 w-10 rounded-lg bg-gray-950 border border-gray-800 object-cover shadow-sm select-none shrink-0" 
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = DEFAULT_AVATAR;
                            }}
                          />
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-bold text-white text-sm">{emp.nome}</p>
                          <p className="font-mono text-gray-400 text-[11px] mt-0.5">{emp.cpf}</p>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-gray-200">{emp.setor}</span>
                          <p className="text-[11px] text-gray-400 mt-0.5">{emp.cargo}</p>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-col text-[11px] space-y-0.5">
                            <span className="font-mono text-gray-300">Entrada: {emp.entrada} • Saída: {emp.saida}</span>
                            <span className="text-[10px] text-gray-500 font-mono">Almoço: {emp.almocoSaida} ~ {emp.almocoRetorno}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleEditEmployeeClick(emp)}
                              className="p-1 px-2.5 rounded hover:bg-gray-800 text-gray-400 hover:text-white text-[11px] font-semibold transition-all flex items-center gap-1"
                            >
                              <Edit className="h-3.5 w-3.5" />
                              Editar
                            </button>
                            <button
                              onClick={() => handleDeleteEmployee(emp.id, emp.nome)}
                              className="p-1 px-2.5 rounded hover:bg-red-950/20 text-gray-500 hover:text-red-400 text-[11px] font-semibold transition-all flex items-center gap-1"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Apagar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredEmployees.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-gray-500">
                          Nenhum funcionário ativo condiz com o critério de pesquisa.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            </div>
          )}

          {/* Active Tab: Registers logs tracker sheet */}
          {activeTab === 'logs' && (
            <div className="space-y-4">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">Histórico de Ponto ({logs.length})</h2>
                  <p className="text-xs text-gray-400">Verifique os registros, as fotos capturadas pela webcam e as marcações homologadas.</p>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsManualPontoModalOpen(true)}
                    className="bg-gray-900 border border-gray-800 hover:border-gray-700 text-xs text-white font-semibold py-2 px-3.5 rounded-xl transition-all flex items-center gap-1.5 shadow-sm active:scale-[0.98]"
                  >
                    <Plus className="h-4 w-4 text-blue-400" />
                    Lançar Manual
                  </button>

                  <button
                    onClick={exportLogsToCSV}
                    className="bg-blue-600/10 hover:bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-semibold py-2 px-3.5 rounded-xl transition-all flex items-center gap-1.5 shadow-sm active:scale-[0.98]"
                  >
                    <Download className="h-4 w-4" />
                    Exportar Relatório CSV
                  </button>
                </div>
              </div>

              {/* Filtering Controls Row */}
              <div className="bg-[#111625]/60 border border-gray-850/60 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Buscar por funcionário</label>
                  <div className="relative">
                    <Search className="h-3.5 w-3.5 text-gray-500 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="Nome ou CPF..."
                      value={logSearch}
                      onChange={(e) => setLogSearch(e.target.value)}
                      className="w-full bg-[#131b2d] border border-gray-850 hover:border-gray-800 text-xs text-white rounded-lg py-2 pl-8 pr-3 outline-none focus:ring-1 focus:ring-blue-500/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Filtrar por marcação</label>
                  <select
                    value={logTypeFilter}
                    onChange={(e) => setLogTypeFilter(e.target.value)}
                    className="w-full bg-[#131b2d] border border-gray-850 text-xs text-white rounded-lg py-2 px-3 outline-none"
                  >
                    <option value="all">Todas as marcas</option>
                    <option value="entrada">Entrada</option>
                    <option value="almoco_saida">Almoço (Saída)</option>
                    <option value="almoco_retorno">Almoço (Retorno)</option>
                    <option value="saida_final">Saída Final</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Filtrar por assiduidade</label>
                  <select
                    value={logStatusFilter}
                    onChange={(e) => setLogStatusFilter(e.target.value)}
                    className="w-full bg-[#131b2d] border border-gray-850 text-xs text-white rounded-lg py-2 px-3 outline-none"
                  >
                    <option value="all">Todos os status</option>
                    <option value="no_prazo">No Prazo</option>
                    <option value="atrasado">Atrasos</option>
                    <option value="adiantado">Adiantados</option>
                  </select>
                </div>
              </div>

              {/* Point registers Table list */}
              <div className="bg-[#121829] border border-gray-800/80 rounded-xl overflow-hidden shadow-lg mt-2 w-full">
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-left text-xs border-collapse divide-y divide-gray-850/60 min-w-[725px]">
                    <thead className="bg-[#182035]/80 text-gray-400 font-mono text-[10px] uppercase">
                      <tr>
                        <th className="py-3 px-4">Webcam Bio</th>
                        <th className="py-3 px-4">Nome completo / CPF</th>
                        <th className="py-3 px-4">Marca</th>
                        <th className="py-3 px-4">Data / Hora</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Confiança IA</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-850/40">
                      {filteredLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-gray-850/15 transition-all text-xs">
                          <td className="py-2.5 px-4 shrink-0">
                            <img 
                              src={log.fotoUrl} 
                              alt="Captured verification" 
                              className="h-9 w-9 rounded-md bg-gray-950 border border-gray-800 object-cover shadow-sm select-none shrink-0"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = DEFAULT_AVATAR;
                              }}
                            />
                          </td>
                          <td className="py-2.5 px-4">
                            <span className="font-bold text-white block">{log.nome}</span>
                            <span className="font-mono text-gray-400 text-[10px]">{log.cpf}</span>
                          </td>
                          <td className="py-2.5 px-4 font-semibold text-blue-400">
                            {log.tipo === 'entrada' ? 'Entrada' : log.tipo === 'saida_final' ? 'Saída Final' : log.tipo === 'almoco_saida' ? 'Almoço (Saída)' : 'Almoço (Retorno)'}
                          </td>
                          <td className="py-2.5 px-4">
                            <p className="font-semibold text-gray-200 font-mono">{log.data.split("-").reverse().join("/")}</p>
                            <p className="text-gray-400 font-mono text-[10px] mt-0.5">{log.hora}</p>
                          </td>
                          <td className="py-2.5 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                              log.status === 'atrasado' ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            }`}>
                              {log.status === 'atrasado' ? "Atrasado" : "No Prazo"}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <span className="font-mono text-gray-300">{(log.confidence * 100).toFixed(0)}%</span>
                          </td>
                        </tr>
                      ))}
                      {filteredLogs.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-gray-500">
                            Nenhum registro de ponto registrado com os filtros ativos.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* Active Tab: Point Adjustment requests panel */}
          {activeTab === 'ajustes' && (
            <div className="space-y-4">
              
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Solicitações de Ajuste ({ajustes.length})</h2>
                <p className="text-xs text-gray-400">Gerencie correções e contestações fiscais de pontos enviadas pelos colaboradores eletronicamente.</p>
              </div>

              <div className="space-y-4 shadow-sm mt-4">
                {ajustes.map((aj) => (
                  <div key={aj.id} className="bg-[#121829] border border-gray-800 rounded-xl p-5 shadow-lg flex flex-col md:flex-row justify-between gap-4">
                    
                    <div className="space-y-3 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-white">{aj.nome}</span>
                        <span className="text-[10px] font-mono text-gray-400 bg-gray-900 border border-gray-850 px-1.5 py-0.5 rounded">{aj.cpf}</span>
                        <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/15 border border-indigo-500/20 px-1.5 py-0.5 rounded uppercase font-semibold">
                          {aj.tipo.replace("_", " ").toUpperCase()}
                        </span>
                      </div>

                      <div className="text-xs text-gray-300 space-y-1">
                        <p><b>Data do Ajuste:</b> {aj.data.split("-").reverse().join("/")}</p>
                        <p><b>Hora Proposta:</b> <span className="font-mono text-white text-md font-bold">{aj.horaNova}</span></p>
                        <p className="bg-[#182035]/60 border border-gray-800 p-3 rounded-lg text-xs italic text-gray-300 mt-2 leading-relaxed">
                          "{aj.justificativa}"
                        </p>
                      </div>

                      <div className="text-[10px] text-gray-500 font-mono">
                        Solicitado em: {new Date(aj.dataSolicitacao).toLocaleString('pt-BR')}
                      </div>
                    </div>

                    <div className="flex flex-row md:flex-col justify-end items-center md:items-end gap-2 shrink-0 md:justify-center">
                      
                      {aj.status === 'pendente' ? (
                        <>
                          <button
                            onClick={() => handleAjusteAction(aj.id, 'aprovado')}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold py-2 px-4 rounded-lg transition-all shadow-md shadow-emerald-500/10 cursor-pointer flex items-center gap-1 active:scale-[0.98]"
                          >
                            <CheckCircle className="h-4 w-4" />
                            Aprovar Ajuste
                          </button>
                          <button
                            onClick={() => handleAjusteAction(aj.id, 'reprovado')}
                            className="bg-red-600/10 hover:bg-red-650/15 text-red-400 border border-red-500/20 text-xs font-semibold py-2 px-4 rounded-lg transition-all shadow-md flex items-center gap-1 active:scale-[0.98]"
                          >
                            <Trash2 className="h-4 w-4" />
                            Rejeitar
                          </button>
                        </>
                      ) : (
                        <span className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase inline-block ${
                          aj.status === 'aprovado' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}>
                          {aj.status === 'aprovado' ? "Aprovado" : "Recusado"}
                        </span>
                      )}

                    </div>

                  </div>
                ))}
                
                {ajustes.length === 0 && (
                  <p className="text-xs text-gray-500 text-center py-12">Nenhuma solicitação de acerto de ponto encontrada.</p>
                )}
              </div>

            </div>
          )}

          {/* Active Tab: Configurations Page */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Parametrizações & Tolerâncias</h2>
                <p className="text-xs text-gray-400">Configure as políticas globais de assiduidade e integre as planilhas do Google Sheets corporativo.</p>
              </div>

              <form onSubmit={handleSaveConfig} className="space-y-6 bg-[#121829] border border-gray-800/80 p-6 rounded-xl shadow-lg">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wide mb-1.5">Nome da Empresa</label>
                    <input
                      type="text"
                      value={config.empresaNome}
                      onChange={(e) => setConfig(p => ({ ...p, empresaNome: e.target.value }))}
                      className="w-full bg-[#131b2d] border border-gray-850 hover:border-gray-800 focus:border-blue-500 text-xs text-white rounded-lg py-2.5 px-3 outline-none transition-all focus:ring-1 focus:ring-blue-500/20"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wide mb-1.5">Tolerância Geral de Atraso (Minutos)</label>
                    <input
                      type="number"
                      value={config.toleranciaMinutos}
                      onChange={(e) => setConfig(p => ({ ...p, toleranciaMinutos: parseInt(e.target.value) || 0 }))}
                      className="w-full bg-[#131b2d] border border-gray-850 hover:border-gray-800 focus:border-blue-500 text-xs text-white rounded-lg py-2.5 px-3 outline-none transition-all focus:ring-1 focus:ring-blue-500/20"
                      min="0"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wide mb-1.5">Fuso Horário (TimeZone)</label>
                    <select
                      value={config.timezone}
                      onChange={(e) => setConfig(p => ({ ...p, timezone: e.target.value }))}
                      className="w-full bg-[#131b2d] border border-gray-855 text-xs text-white rounded-lg py-2.5 px-3 outline-none"
                    >
                      <option value="America/Sao_Paulo">America/Sao_Paulo (GTM -3)</option>
                      <option value="America/Bahia">America/Bahia (GTM -3)</option>
                      <option value="America/Manaus">America/Manaus (GTM -4)</option>
                    </select>
                  </div>

                </div>

                <div className="border-t border-gray-850/60 pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-bold text-white">Integração com Planilhas Google Sheets</h3>
                      <p className="text-[11px] text-gray-400">Habilite gravação automática em tempo real nas abas 'Funcionários' e 'Registros' utilizando a API do GSheets.</p>
                    </div>
                    
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={config.sheetsEnabled}
                        onChange={(e) => setConfig(p => ({ ...p, sheetsEnabled: e.target.checked }))}
                        className="sr-only peer" 
                      />
                      <div className="w-11 h-6 bg-gray-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-650 peer-checked:bg-emerald-500 peer-checked:after:bg-white"></div>
                    </label>
                  </div>

                  {config.sheetsEnabled && (
                    <div className="bg-gray-950/40 border border-gray-850 p-4 rounded-lg space-y-4">
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">ID da Planilha (Spreadsheet ID)</label>
                        <input
                          type="text"
                          value={config.sheetsId}
                          onChange={(e) => setConfig(p => ({ ...p, sheetsId: e.target.value }))}
                          placeholder="Ex: 1tV79S_Kdf93bDfJ8fdsl80sdjkF_dfS9..."
                          className="w-full bg-[#111726] border border-gray-800 focus:border-emerald-500 text-xs text-white rounded-lg py-2.5 px-3 outline-none font-mono"
                        />
                      </div>
                      
                      <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-lg text-emerald-400 text-[10px] leading-relaxed">
                        <b>Como funciona a integração:</b> O SmartPoint utiliza as credenciais seguras do backend para replicar todas as movimentações. Garanta que o e-mail do Service Account tenha permissão de <b>Editor</b> na sua Planilha Google.
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold py-2.5 px-6 rounded-xl transition-all shadow-md shadow-blue-500/10 cursor-pointer"
                  >
                    Salvar Parâmetros
                  </button>
                </div>

              </form>

            </div>
          )}

          {/* Active Tab: Audit Trail Logs */}
          {activeTab === 'audit' && (
            <div className="space-y-4">
              
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Logs de Auditoria ({systemLogs.length})</h2>
                <p className="text-xs text-gray-400">Rastreabilidade completa de todas as ações administrativas, rejeições e sincronias do SmartPoint.</p>
              </div>

              {/* System logs view details style */}
              <div className="bg-[#121829] border border-gray-800/80 rounded-xl overflow-hidden shadow-lg mt-4 font-mono text-[11px]">
                <table className="w-full text-left border-collapse divide-y divide-gray-850/60">
                  <thead className="bg-[#182035]/80 text-gray-400 text-[10px] uppercase font-bold">
                    <tr>
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4">Usuário</th>
                      <th className="py-3 px-4">Ação</th>
                      <th className="py-3 px-4">Detalhes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-850/30">
                    {systemLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-850/10 transition-all">
                        <td className="py-2.5 px-4 text-gray-500 select-none">{new Date(log.timestamp).toLocaleString('pt-BR')}</td>
                        <td className="py-2.5 px-4 text-blue-400 font-semibold">{log.usuario}</td>
                        <td className="py-2.5 px-4">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase ${
                            log.tipo === 'success' ? 'bg-emerald-500/10 text-emerald-400' :
                            log.tipo === 'warning' ? 'bg-amber-500/10 text-amber-500' :
                            log.tipo === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'
                          }`}>
                            {log.acao}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-gray-350">{log.detalhes}</td>
                      </tr>
                    ))}
                    {systemLogs.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-12 text-center text-gray-500">
                          Nenhum log registrado na trilha de auditoria corporativa.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          )}

          {/* Active Tab: Companies Administration CRUD */}
          {activeTab === 'companies' && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Gestão de Empresas ({companies.length})</h2>
                <p className="text-xs text-gray-400">Organize os múltiplos perfis de filiais convencionadas para atendimento REP-P.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Save Company Form */}
                <div className="bg-[#121829]/80 border border-gray-800/85 rounded-xl p-5 shadow h-fit space-y-4">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Nova Empresa / Filial</h3>
                  <form onSubmit={handleAddCompany} className="space-y-3">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1 font-mono">Razão Social / Nome</label>
                      <input 
                        type="text"
                        value={compForm.nome}
                        onChange={(e) => setCompForm(p => ({ ...p, nome: e.target.value }))}
                        placeholder="Ex: SmartPoint Filial SP"
                        className="w-full bg-gray-900 border border-gray-850 focus:border-blue-500 rounded-lg p-2.5 text-xs text-white outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1 font-mono">CNPJ da Filial</label>
                      <input 
                        type="text"
                        value={compForm.cnpj}
                        onChange={(e) => {
                          let v = e.target.value.replace(/\D/g, "");
                          if (v.length > 14) v = v.slice(0, 14);
                          if (v.length > 12) v = `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8, 12)}-${v.slice(12)}`;
                          else if (v.length > 8) v = `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8)}`;
                          else if (v.length > 5) v = `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5)}`;
                          else if (v.length > 2) v = `${v.slice(0, 2)}.${v.slice(2)}`;
                          setCompForm(p => ({ ...p, cnpj: v }));
                        }}
                        placeholder="00.000.000/0001-00"
                        className="w-full bg-gray-900 border border-gray-850 focus:border-blue-500 rounded-lg p-2.5 text-xs text-white outline-none font-mono"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1 font-mono">Endereço Comercial</label>
                      <input 
                        type="text"
                        value={compForm.endereco || ""}
                        onChange={(e) => setCompForm(p => ({ ...p, endereco: e.target.value }))}
                        placeholder="Av. Paulista, 1000 - Bela Vista"
                        className="w-full bg-gray-900 border border-gray-850 focus:border-blue-500 rounded-lg p-2.5 text-xs text-white outline-none"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 font-bold text-xs text-white rounded-lg cursor-pointer flex items-center justify-center gap-1.5 transition-all"
                    >
                      <Plus className="h-4 w-4" />
                      Cadastrar Filial
                    </button>
                  </form>
                </div>

                {/* Companies List Table */}
                <div className="lg:col-span-2 bg-[#121829]/50 border border-gray-800/85 rounded-xl overflow-hidden shadow">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-[#182035]/80 text-gray-400 text-[10px] uppercase font-bold border-b border-gray-800">
                      <tr>
                        <th className="py-3 px-4">Filial / Nome</th>
                        <th className="py-3 px-4 font-mono">CNPJ</th>
                        <th className="py-3 px-4">Localização / Endereço</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-850/30">
                      {companies.map((comp) => (
                        <tr key={comp.id} className="hover:bg-gray-850/15 transition-all">
                          <td className="py-3 px-4 font-bold text-white">{comp.nome}</td>
                          <td className="py-3 px-4 font-mono text-gray-300">{comp.cnpj}</td>
                          <td className="py-3 px-4 text-gray-400 truncate max-w-[160px]">{comp.endereco}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              comp.status === 'ativo' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-800 text-gray-400'
                            }`}>
                              {comp.status === 'ativo' ? 'Ativo' : 'Inativo'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {comp.status === 'ativo' && (
                              <button
                                onClick={() => handleDeleteCompany(comp.id, comp.nome)}
                                className="p-1 text-red-400 hover:bg-red-500/10 rounded cursor-pointer transition-all"
                                title="Desativar Empresa"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {companies.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-gray-500">
                            Nenhuma empresa cadastrada para multiempresa.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

              </div>
            </div>
          )}

          {/* Active Tab: Work Shifts Scales CRUD */}
          {activeTab === 'escalas' && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Escalas & Parâmetros de Jornada ({escalas.length})</h2>
                <p className="text-xs text-gray-400">Configure os turnos de trabalho para cálculo de atrasos, horas extras e limites de tolerâncias.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Save Scale Form */}
                <div className="bg-[#121829]/80 border border-gray-800/85 rounded-xl p-5 shadow h-fit space-y-4">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Nova Escala de Trabalho</h3>
                  <form onSubmit={handleAddScale} className="space-y-3">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1 font-mono">Nome da Escala</label>
                      <input 
                        type="text"
                        value={scaleForm.nome}
                        onChange={(e) => setScaleForm(p => ({ ...p, nome: e.target.value }))}
                        placeholder="Ex: Administrativo Flex 44h"
                        className="w-full bg-gray-900 border border-gray-850 focus:border-blue-500 rounded-lg p-2.5 text-xs text-white outline-none"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] uppercase text-gray-400 mb-1">Entrada</label>
                        <input 
                          type="time" 
                          value={scaleForm.entrada} 
                          onChange={(e) => setScaleForm(p => ({ ...p, entrada: e.target.value }))} 
                          className="w-full bg-gray-900 border border-gray-850 text-white rounded p-1.5 text-center text-xs" 
                          required 
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] uppercase text-gray-400 mb-1">Saída Almoço</label>
                        <input 
                          type="time" 
                          value={scaleForm.almocoSaida} 
                          onChange={(e) => setScaleForm(p => ({ ...p, almocoSaida: e.target.value }))} 
                          className="w-full bg-gray-900 border border-gray-850 text-white rounded p-1.5 text-center text-xs" 
                          required 
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] uppercase text-gray-400 mb-1">Retorno Almoço</label>
                        <input 
                          type="time" 
                          value={scaleForm.almocoRetorno} 
                          onChange={(e) => setScaleForm(p => ({ ...p, almocoRetorno: e.target.value }))} 
                          className="w-full bg-gray-900 border border-gray-850 text-white rounded p-1.5 text-center text-xs" 
                          required 
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] uppercase text-gray-400 mb-1">Saída Final</label>
                        <input 
                          type="time" 
                          value={scaleForm.saida} 
                          onChange={(e) => setScaleForm(p => ({ ...p, saida: e.target.value }))} 
                          className="w-full bg-gray-900 border border-gray-850 text-white rounded p-1.5 text-center text-xs" 
                          required 
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1 font-mono">Tolerância Geral (minutos)</label>
                      <input 
                        type="number"
                        value={scaleForm.tolerancia}
                        onChange={(e) => setScaleForm(p => ({ ...p, tolerancia: Number(e.target.value) }))}
                        className="w-full bg-gray-900 border border-gray-850 focus:border-blue-500 rounded-lg p-2.5 text-xs text-white outline-none"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 font-bold text-xs text-white rounded-lg cursor-pointer flex items-center justify-center gap-1.5 transition-all"
                    >
                      <Plus className="h-4 w-4" />
                      Cadastrar Escala
                    </button>
                  </form>
                </div>

                {/* Scales list layout */}
                <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 h-fit">
                  {escalas.map((sc) => (
                    <div key={sc.id} className="bg-[#121829]/50 border border-gray-800/80 rounded-xl p-4 shadow flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="text-xs font-bold text-white shrink-0 truncate max-w-[140px]">{sc.nome}</h4>
                          <span className="text-[9px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded">
                            Tolerância: {sc.tolerancia}m
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-400 font-mono py-2 bg-gray-950/20 p-2 rounded border border-gray-855/30">
                          <div>Entrada: <b className="text-gray-200">{sc.entrada}</b></div>
                          <div>S. Almoço: <b className="text-gray-200">{sc.almocoSaida}</b></div>
                          <div>R. Almoço: <b className="text-gray-200">{sc.almocoRetorno}</b></div>
                          <div>Saída F.: <b className="text-gray-200">{sc.saida}</b></div>
                        </div>
                      </div>
                      <div className="flex justify-end pt-3 mt-2 border-t border-gray-850/40">
                        <button
                          onClick={() => handleDeleteScale(sc.id, sc.nome)}
                          className="text-[10px] text-red-400 hover:bg-red-500/10 py-1 px-2.5 rounded cursor-pointer transition-all flex items-center gap-1"
                        >
                          <Trash2 className="h-3 w-3" /> Deletar
                        </button>
                      </div>
                    </div>
                  ))}
                  {escalas.length === 0 && (
                    <div className="col-span-2 py-10 text-center text-gray-500 bg-[#121829]/40 rounded-xl border border-gray-800/70">
                      Nenhuma jornada ou escala de horários configurada.
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

        </main>

      </div>

      {/* MODAL 1: EMPLOYEE CREATE & EDIT */}
      {isEmployeeModalOpen && (
        <div className="fixed inset-0 bg-gray-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-[#121829] border border-gray-800/80 rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto shadow-2xl space-y-4">
            
            <div className="flex justify-between items-center pb-2 border-b border-gray-800/40">
              <h3 className="text-md font-bold text-white">
                {editingEmployee ? `Editar: ${editingEmployee.nome}` : "Cadastrar Novo Funcionário"}
              </h3>
              <button 
                onClick={() => {
                  setIsEmployeeModalOpen(false);
                  resetEmployeeForm();
                }}
                className="text-gray-400 hover:text-white text-xs px-2.5 py-1 rounded bg-gray-900 border border-gray-800"
              >
                Fechar
              </button>
            </div>

            <form onSubmit={handleSaveEmployee} className="space-y-4">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-300 uppercase tracking-wider mb-1">Nome Completo</label>
                  <input
                    type="text"
                    value={empForm.nome}
                    onChange={(e) => setEmpForm(p => ({ ...p, nome: e.target.value }))}
                    className="w-full bg-[#131b2d] border border-gray-850 hover:border-gray-800 focus:border-blue-500 text-xs text-white rounded-lg p-2.5 outline-none"
                    placeholder="Ex: Carlos Santos"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-300 uppercase tracking-wider mb-1">CPF</label>
                  <input
                    type="text"
                    value={empForm.cpf}
                    onChange={(e) => setEmpForm(p => ({ ...p, cpf: formatCpf(e.target.value) }))}
                    placeholder="000.000.000-00"
                    className="w-full bg-[#131b2d] border border-gray-850 hover:border-gray-800 focus:border-blue-500 text-xs text-white rounded-lg p-2.5 outline-none font-mono tracking-widest"
                    disabled={editingEmployee !== null}
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-300 uppercase tracking-wider mb-1">Cargo</label>
                  <input
                    type="text"
                    value={empForm.cargo}
                    onChange={(e) => setEmpForm(p => ({ ...p, cargo: e.target.value }))}
                    placeholder="Ex: Desenvolvedor Jr"
                    className="w-full bg-[#131b2d] border border-gray-850 hover:border-gray-800 focus:border-blue-500 text-xs text-white rounded-lg p-2.5 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-300 uppercase tracking-wider mb-1">Setor</label>
                  <input
                    type="text"
                    value={empForm.setor}
                    onChange={(e) => setEmpForm(p => ({ ...p, setor: e.target.value }))}
                    placeholder="Ex: Tecnologia"
                    className="w-full bg-[#131b2d] border border-gray-850 hover:border-gray-800 focus:border-blue-500 text-xs text-white rounded-lg p-2.5 outline-none"
                  />
                </div>
              </div>

              {/* INDIVIDUAL DIGITAL SIGNATURE KEY */}
              <div className="p-3 bg-gray-900/45 border border-gray-850 rounded-xl space-y-1">
                <label className="block text-[10px] font-bold text-gray-300 uppercase tracking-wider font-mono">
                  Assinatura Eletrônica / Chave Digital (ICP-Brasil)
                </label>
                <input
                  type="text"
                  value={empForm.assinaturaDigital}
                  onChange={(e) => setEmpForm(p => ({ ...p, assinaturaDigital: e.target.value }))}
                  placeholder="Ex: sha256_icp_brasil_certificate_token..."
                  className="w-full bg-[#131b2d] border border-gray-850 hover:border-gray-800 focus:border-blue-500 text-xs text-white rounded-lg p-2.5 outline-none font-mono text-gray-300"
                />
                <p className="text-[9px] text-gray-500">Chave pública de infraestrutura ICP-Brasil associada a este funcionário para emissão e validação fiscal do comprovante fiscal REP-P.</p>
              </div>

              {/* EMPRESA & ESCALA ASSOCIATIVA RELATIONS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-300 uppercase tracking-wider mb-1">Empresa Associada</label>
                  <select
                    value={empForm.empresaId}
                    onChange={(e) => setEmpForm(p => ({ ...p, empresaId: e.target.value }))}
                    className="w-full bg-[#131b2d] border border-gray-850 focus:border-blue-500 text-xs text-white rounded-lg p-2.5 outline-none select:bg-slate-900"
                  >
                    <option value="">-- Selecione uma Empresa --</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.id} className="bg-slate-900">{c.nome} ({c.cnpj})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-300 uppercase tracking-wider mb-1">Escala Operacional de Trabalho</label>
                  <select
                    value={empForm.escalaId}
                    onChange={(e) => {
                      const selId = e.target.value;
                      const selectedScale = escalas.find(s => s.id === selId);
                      if (selectedScale) {
                        setEmpForm(p => ({
                          ...p,
                          escalaId: selId,
                          entrada: selectedScale.entrada,
                          almocoSaida: selectedScale.almocoSaida,
                          almocoRetorno: selectedScale.almocoRetorno,
                          saida: selectedScale.saida
                        }));
                      } else {
                        setEmpForm(p => ({ ...p, escalaId: selId }));
                      }
                    }}
                    className="w-full bg-[#131b2d] border border-gray-850 focus:border-blue-500 text-xs text-white rounded-lg p-2.5 outline-none select:bg-slate-900"
                  >
                    <option value="">-- Personalizada / Padrão --</option>
                    {escalas.map(s => (
                      <option key={s.id} value={s.id} className="bg-slate-900">{s.nome} ({s.entrada} - {s.saida})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* ESCALAS DE JORNADA HORARIOS */}
              <div className="p-3 bg-gray-900/50 border border-gray-850/60 rounded-xl">
                <p className="text-[10px] font-mono text-blue-400 uppercase tracking-widest font-semibold mb-2.5">Horários de Trabalho Ativos (REP-P)</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <label className="block text-[9px] text-gray-400 mb-0.5">Entrada</label>
                    <input type="time" value={empForm.entrada} onChange={(e) => setEmpForm(p=>({ ...p, entrada: e.target.value }))} className="w-full bg-[#131b2d] border border-gray-850 text-white p-1 rounded font-mono text-center tracking-wider" />
                  </div>
                  <div>
                    <label className="block text-[9px] text-gray-400 mb-0.5 font-sans">Almoço (S)</label>
                    <input type="time" value={empForm.almocoSaida} onChange={(e) => setEmpForm(p=>({ ...p, almocoSaida: e.target.value }))} className="w-full bg-[#131b2d] border border-gray-850 text-white p-1 rounded font-mono text-center tracking-wider" />
                  </div>
                  <div>
                    <label className="block text-[9px] text-gray-400 mb-0.5 font-sans">Almoço (R)</label>
                    <input type="time" value={empForm.almocoRetorno} onChange={(e) => setEmpForm(p=>({ ...p, almocoRetorno: e.target.value }))} className="w-full bg-[#131b2d] border border-gray-850 text-white p-1 rounded font-mono text-center tracking-wider" />
                  </div>
                  <div>
                    <label className="block text-[9px] text-gray-400 mb-0.5 font-sans">Saída Final</label>
                    <input type="time" value={empForm.saida} onChange={(e) => setEmpForm(p=>({ ...p, saida: e.target.value }))} className="w-full bg-[#131b2d] border border-gray-850 text-white p-1 rounded font-mono text-center tracking-wider" />
                  </div>
                </div>
              </div>

              {/* FACE BIOMETRICS REGISTRATION PHOTO CAPTURE */}
              <div className="space-y-2.5">
                <label className="block text-[10px] font-bold text-gray-300 uppercase tracking-wider">Foto de Perfil Biométrico</label>
                
                <div className="flex gap-4 items-center flex-col sm:flex-row">
                  <div className="h-24 w-24 rounded-xl bg-gray-950 border border-gray-800 overflow-hidden flex items-center justify-center shrink-0">
                    {rawPhotoUpload ? (
                      <img src={rawPhotoUpload} alt="Face sample" className="h-full w-full object-cover" />
                    ) : (
                      <BadgeInfo className="h-6 w-6 text-gray-600" />
                    )}
                  </div>

                  <div className="flex flex-col gap-2 w-full text-xs">
                    <p className="text-[11px] text-gray-400">Insira uma imagem rica em contraste e de frente para fins de validação pelo reconhecedor de faces SmartPoint.</p>
                    
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={startProfileCamera}
                        className="bg-gray-900 border border-gray-800 text-gray-300 hover:text-white p-2 rounded-lg font-medium tracking-wide flex items-center gap-1.5 shrink-0"
                      >
                        <Camera className="h-4 w-4 text-blue-400" />
                        Tirar com Webcam
                      </button>

                      <label className="bg-gray-950 border border-gray-800 text-gray-300 hover:text-white hover:border-gray-700 p-2 rounded-lg font-medium tracking-wide flex items-center gap-1.5 cursor-pointer text-center shrink-0">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoUploadChange}
                          className="hidden"
                        />
                        Selecionar Arquivo
                      </label>
                    </div>
                  </div>
                </div>

                {usingCameraForProfile && (
                  <div className="bg-gray-950 p-3 rounded-xl border border-gray-850 flex flex-col items-center gap-3">
                    <div className="w-48 h-48 rounded-xl overflow-hidden border border-blue-500 relative">
                      <video ref={profileVideoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
                    </div>
                    <div className="flex gap-2 w-full max-w-[200px]">
                      <button type="button" onClick={stopProfileCamera} className="flex-1 py-1.5 bg-gray-900 border border-gray-800 text-xs rounded-lg text-gray-400 hover:text-white">Cancelar</button>
                      <button type="button" onClick={snapProfilePicture} className="flex-1 py-1.5 bg-blue-600 font-bold text-xs rounded-lg text-white hover:bg-blue-500">Capturar</button>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-gray-800/40 flex justify-end gap-2.5 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setIsEmployeeModalOpen(false);
                    resetEmployeeForm();
                  }}
                  className="py-2.5 px-4 bg-gray-900 border border-gray-800 hover:border-gray-750 text-gray-400 hover:text-white rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="py-2.5 px-6 bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-md font-bold"
                >
                  Confirmar Cadastro
                </button>
              </div>

            </form>

            <canvas ref={profileCanvasRef} className="hidden" />
          </div>
        </div>
      )}

      {/* MODAL 2: MANUAL PONTO INSERTER */}
      {isManualPontoModalOpen && (
        <div className="fixed inset-0 bg-gray-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#121829] border border-gray-800/80 rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4">
            
            <div className="flex justify-between items-center pb-2 border-b border-gray-800/40">
              <h3 className="text-md font-bold text-white">Lançar Ponto Manual</h3>
              <button 
                onClick={() => setIsManualPontoModalOpen(false)}
                className="text-gray-400 hover:text-white text-xs px-2.5 py-1 rounded bg-gray-900 border border-gray-800"
              >
                Fechar
              </button>
            </div>

            <form onSubmit={handleManualPontoSubmit} className="space-y-4 text-xs">
              
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">CPF do Funcionário</label>
                <input
                  type="text"
                  value={manualForm.cpf}
                  onChange={(e) => setManualForm(p => ({ ...p, cpf: formatCpf(e.target.value) }))}
                  placeholder="000.000.000-00"
                  className="w-full bg-[#131b2d] border border-gray-850 p-2.5 rounded-lg outline-none font-mono tracking-widest text-white text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Data</label>
                  <input
                    type="date"
                    value={manualForm.data}
                    onChange={(e) => setManualForm(p => ({ ...p, data: e.target.value }))}
                    className="w-full bg-[#131b2d] border border-gray-850 p-2 rounded-lg text-white font-mono text-center"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Hora (HH:MM)</label>
                  <input
                    type="time"
                    value={manualForm.hora}
                    onChange={(e) => setManualForm(p => ({ ...p, hora: e.target.value }))}
                    className="w-full bg-[#131b2d] border border-gray-850 p-2 rounded-lg text-white font-mono text-center select-all"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Tipo da Batida</label>
                <select
                  value={manualForm.tipo}
                  onChange={(e) => setManualForm(p => ({ ...p, tipo: e.target.value as TimeLogType }))}
                  className="w-full bg-[#131b2d] border border-gray-850 p-2.5 rounded-lg text-white text-xs"
                >
                  <option value="entrada">Entrada</option>
                  <option value="almoco_saida">Almoço (Saída)</option>
                  <option value="almoco_retorno">Almoço (Retorno)</option>
                  <option value="saida_final">Saída Final</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setIsManualPontoModalOpen(false)}
                  className="py-2.5 px-4 bg-gray-900 border border-gray-800 text-gray-400 hover:text-white rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="py-2.5 px-6 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold"
                >
                  Lançar Ponto
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* TOAST SYSTEM ALERTS */}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 p-4 rounded-xl shadow-xl flex items-center gap-3 border ${
          toast.type === 'success' ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/25' :
          toast.type === 'error' ? 'bg-red-950/90 text-red-300 border-red-500/25' :
          'bg-gray-900/90 text-blue-300 border-blue-500/25'
        }`}>
          {toast.type === 'success' ? <CheckCircle className="h-5 w-5 text-emerald-400" /> : <ShieldAlert className="h-5 w-5 text-red-400" />}
          <span className="text-xs font-semibold">{toast.message}</span>
        </div>
      )}

    </div>
  );
}
