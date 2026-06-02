import React, { useState, useRef, useEffect } from "react";
import { Camera, Calendar, Clock, CheckCircle2, AlertTriangle, Fingerprint, RefreshCw, UserCheck, Eye, EyeOff } from "lucide-react";
import { Employee, TimeLogType } from "../types";

interface PontoTerminalProps {
  onAdminAccess: () => void;
}

export default function PontoTerminal({ onAdminAccess }: PontoTerminalProps) {
  const [cpf, setCpf] = useState("");
  const [step, setStep] = useState<'cpf' | 'webcam' | 'success' | 'error'>('cpf');
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [recommendedType, setRecommendedType] = useState<TimeLogType>("entrada");
  const [pontoTipo, setPontoTipo] = useState<TimeLogType>("entrada");
  const [hasCamera, setHasCamera] = useState(true);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [recognitionResult, setRecognitionResult] = useState<{
    matched: boolean;
    confidence: number;
    reason: string;
  } | null>(null);
  const [successInfo, setSuccessInfo] = useState<any>(null);

  // Employee Adjustment Request states
  const [isAjusteModalOpen, setIsAjusteModalOpen] = useState(false);
  const [ajForm, setAjForm] = useState({
    cpf: "",
    data: new Date().toISOString().split("T")[0],
    horaNova: "08:00",
    tipo: "entrada" as TimeLogType,
    justificativa: ""
  });
  const [ajError, setAjError] = useState("");
  const [ajSuccess, setAjSuccess] = useState("");
  const [ajLoading, setAjLoading] = useState(false);

  // UTC tracking clock states
  const [timeState, setTimeState] = useState(new Date());

  const handleAjusteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ajForm.cpf || !ajForm.data || !ajForm.horaNova || !ajForm.justificativa) {
      setAjError("Preencha todos os campos obrigatórios.");
      return;
    }
    setAjLoading(true);
    setAjError("");
    setAjSuccess("");
    try {
      const res = await fetch("/api/ajustes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ajForm)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao solicitar ajuste.");
      }
      setAjSuccess("Solicitação de ajuste fiscal e ponto enviada ao RH com sucesso!");
      setTimeout(() => {
        setIsAjusteModalOpen(false);
        setAjSuccess("");
      }, 3000);
      setAjForm({
        cpf: "",
        data: new Date().toISOString().split("T")[0],
        horaNova: "08:00",
        tipo: "entrada",
        justificativa: ""
      });
    } catch (err: any) {
      setAjError(err.message || "Falha técnica na solicitação.");
    } finally {
      setAjLoading(false);
    }
  };

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Live Clock effect
  useEffect(() => {
    const timer = setInterval(() => setTimeState(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Format CPF Input
  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 11) value = value.slice(0, 11);
    
    // Format: 000.000.000-00
    if (value.length > 9) {
      value = `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6, 9)}-${value.slice(9)}`;
    } else if (value.length > 6) {
      value = `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6)}`;
    } else if (value.length > 3) {
      value = `${value.slice(0, 3)}.${value.slice(3)}`;
    }
    setCpf(value);
  };

  // Identify employee by CPF
  const handleValidateCpf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cpf.length < 14) {
      setErrorMsg("Digite um CPF completo e válido.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const response = await fetch("/api/ponto/check-cpf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cpf })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "CPF não localizado.");
      }

      setEmployee(data.employee);
      setRecommendedType(data.recommendedType);
      setPontoTipo(data.recommendedType);
      setStep('webcam');
      startWebcam();
    } catch (err: any) {
      setErrorMsg(err.message || "Erro de validação de CPF.");
    } finally {
      setLoading(false);
    }
  };

  // Initialize camera
  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" }
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setHasCamera(true);
    } catch (err) {
      console.warn("Dispositivo de câmera bloqueado ou ausente:", err);
      setHasCamera(false); // Activates virtual simulation sandbox
    }
  };

  // Stop camera stream
  const stopWebcam = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
  };

  // Capture frame & Trigger Biometrics Analysis
  const handleCaptureAndRegister = async () => {
    if (!employee) return;
    setLoading(true);
    setErrorMsg("");

    let photoDataUri = "";

    if (hasCamera && videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(-1, 1); // Flip horizontally for natural mirror feel
        ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
        photoDataUri = canvas.toDataURL("image/jpeg", 0.85);
      }
    } else {
      // Fallback: Generate an elegant mock selfie SVG to send to db
      photoDataUri = employee.fotoUrl;
    }

    setCapturedImage(photoDataUri);

    try {
      // 1. Advanced AI facial recognition endpoint
      const faceRes = await fetch("/api/ponto/validate-face", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cpf: employee.cpf,
          capturedFrame: photoDataUri
        })
      });

      const faceData = await faceRes.json();
      if (!faceRes.ok) {
        throw new Error(faceData.error || "Falha no reconhecimento biométrico.");
      }

      setRecognitionResult(faceData);

      if (!faceData.matched) {
        setStep('error');
        setErrorMsg(faceData.reason || "Biometria facial divergente do cadastro.");
        stopWebcam();
        return;
      }

      // 2. Register timing clock
      const registerRes = await fetch("/api/ponto/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cpf: employee.cpf,
          tipo: pontoTipo,
          capturedFrame: photoDataUri,
          confidence: faceData.confidence,
          matched: faceData.matched
        })
      });

      const registerData = await registerRes.json();
      if (!registerRes.ok) {
        throw new Error(registerData.error || "Falha ao registrar ponto.");
      }

      setSuccessInfo(registerData.log);
      setStep('success');
      stopWebcam();

      // Auto clear after 6 seconds to return to home CPF terminal
      setTimeout(() => {
        handleReset();
      }, 6000);

    } catch (err: any) {
      setErrorMsg(err.message || "Ocorreu um erro no registro biométrico.");
      setStep('error');
      stopWebcam();
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    stopWebcam();
    setCpf("");
    setEmployee(null);
    setCapturedImage(null);
    setRecognitionResult(null);
    setSuccessInfo(null);
    setErrorMsg("");
    setStep('cpf');
  };

  const translatePontoType = (type: TimeLogType) => {
    switch (type) {
      case "entrada": return "Entrada Oficial";
      case "almoco_saida": return "Saída para Almoço";
      case "almoco_retorno": return "Retorno do Almoço";
      case "saida_final": return "Saída Final";
      default: return "";
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#0b0f19] text-gray-100 flex flex-col justify-between p-4 relative overflow-hidden font-sans">
      
      {/* Background elegant abstract mesh decoration */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-blue-900/10 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-950/15 blur-[120px] pointer-events-none"></div>

      {/* Top Header */}
      <header className="max-w-7xl w-full mx-auto flex items-center justify-between py-3 px-4 border-b border-gray-800/60 z-10 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Fingerprint className="h-5 w-5 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
              SmartPoint <span className="text-blue-500 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20">Web</span>
            </h1>
            <p className="text-[10px] text-gray-400 font-mono tracking-wider uppercase">Reconhecimento Facial</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => {
              setAjError("");
              setAjSuccess("");
              setIsAjusteModalOpen(true);
            }}
            className="text-xs font-semibold text-gray-400 hover:text-white px-3.5 py-1.5 rounded-lg border border-gray-800 hover:border-gray-700 bg-gray-900/20 hover:bg-gray-800/40 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            Solicitar Ajuste
          </button>
          <button 
            onClick={onAdminAccess}
            className="text-xs font-semibold text-gray-400 hover:text-white px-3.5 py-1.5 rounded-lg border border-gray-800 hover:border-gray-700 bg-gray-900/40 hover:bg-gray-800/60 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            Painel Administrativo
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto flex flex-col items-center justify-center z-10 py-6">
        
        {step === 'cpf' && (
          <div className="w-full max-w-md bg-gray-900/65 border border-gray-800/80 rounded-2xl p-6 shadow-2xl backdrop-blur-md relative">
            <div className="absolute top-4 right-4 text-[10px] font-mono text-gray-500 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping"></span>
              TERMINAL ONLINE
            </div>

            <div className="text-center mb-6">
              <div className="h-14 w-14 rounded-2xl bg-blue-500/10 border border-blue-500/15 flex items-center justify-center mx-auto mb-3">
                <Clock className="h-7 w-7 text-blue-400" />
              </div>
              <p className="text-xs text-blue-400 font-mono tracking-widest uppercase mb-1">Registro de Ponto Eletrônico</p>
              
              {/* Dynamic live clock display */}
              <div className="text-4xl font-extrabold tracking-tight text-white mb-2 font-mono">
                {timeState.toLocaleTimeString('pt-BR', { hour12: false })}
              </div>
              <div className="text-xs text-gray-400 flex items-center justify-center gap-1.5 font-mono">
                <Calendar className="h-3.5 w-3.5 text-gray-500" />
                {timeState.toLocaleDateString('pt-BR', { dateStyle: 'full' })}
              </div>
            </div>

            <form onSubmit={handleValidateCpf} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wide mb-1.5">
                  Informe seu CPF cadastrado
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={cpf}
                    onChange={handleCpfChange}
                    placeholder="000.000.000-00"
                    disabled={loading}
                    className="w-full bg-[#131b2d] border border-gray-800 hover:border-gray-700 focus:border-blue-500 text-white rounded-xl py-3 px-4 font-mono text-lg text-center tracking-widest outline-none transition-all placeholder:text-gray-600 focus:ring-1 focus:ring-blue-500/20 shadow-inner"
                    autoFocus
                  />
                </div>
              </div>

              {errorMsg && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-200 text-xs py-2.5 px-3.5 rounded-xl flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || cpf.length < 14}
                className={`w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                  cpf.length < 14
                    ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                    : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/15 cursor-pointer active:scale-[0.99]"
                }`}
              >
                {loading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Camera className="h-4 w-4" />
                    Iniciar Reconhecimento Facial
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {step === 'webcam' && employee && (
          <div className="w-full max-w-lg bg-gray-900/65 border border-gray-800/80 rounded-2xl p-6 shadow-2xl backdrop-blur-md flex flex-col items-center">
            
            <div className="w-full flex justify-between items-center mb-4 pb-2 border-b border-gray-800/40">
              <div>
                <p className="text-[10px] text-blue-400 font-mono tracking-wider uppercase">Identidade Validada</p>
                <h3 className="text-md font-bold text-white">{employee.nome}</h3>
              </div>
              <div className="px-2 py-0.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[10px] text-blue-400 font-mono shrink-0">
                {employee.cargo}
              </div>
            </div>

            {/* Selection of Event type */}
            <div className="w-full mb-4">
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
                Tipo do Registro de Ponto
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['entrada', 'almoco_saida', 'almoco_retorno', 'saida_final'] as TimeLogType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setPontoTipo(type)}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all text-left relative ${
                      pontoTipo === type
                        ? "bg-blue-600/15 border-blue-500 text-blue-200"
                        : "bg-gray-900/40 border-gray-800/60 text-gray-400 hover:border-gray-700 hover:text-gray-300"
                    }`}
                  >
                    <span>{translatePontoType(type)}</span>
                    {recommendedType === type && (
                      <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-blue-400 ring-2 ring-blue-500/20"></span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Webcam / Simulator frame holder */}
            <div className="w-full aspect-video bg-[#050811] rounded-xl border border-gray-800 relative overflow-hidden flex flex-col items-center justify-center">
              
              {hasCamera ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                  {/* Holographic face overlay scan bracket */}
                  <div className="absolute inset-0 border-[2px] border-dashed border-blue-500/25 pointer-events-none rounded-xl m-6 hover:border-blue-500/40 transition-all flex items-center justify-center">
                    <div className="w-48 h-48 border border-blue-500/40 rounded-full animate-pulse relative flex items-center justify-center">
                      <div className="absolute inset-0 bg-gradient-to-b from-blue-500/0 via-blue-500/10 to-blue-500/0 animate-bounce"></div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center text-center p-6 space-y-3">
                  <div className="h-12 w-12 rounded-full bg-indigo-500/10 border border-indigo-500/15 flex items-center justify-center text-indigo-400">
                    <UserCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">Modo Simulação Biométrica</h4>
                    <p className="text-xs text-gray-400 max-w-sm">
                      Nenhuma webcam ativa foi localizada. O sistema usará um algoritmo simulado de semelhança baseado no perfil facial e fará o registro com IA.
                    </p>
                  </div>
                </div>
              )}

              {loading && (
                <div className="absolute inset-0 bg-gray-950/80 backdrop-blur-sm flex flex-col items-center justify-center space-y-3 z-20">
                  <div className="relative flex items-center justify-center">
                    <div className="h-10 w-10 border-2 border-t-blue-500 border-gray-800 rounded-full animate-spin"></div>
                    <Fingerprint className="h-4 w-4 text-blue-400 absolute animate-pulse" />
                  </div>
                  <div>
                    <p className="text-xs text-blue-400 font-mono tracking-wider animate-pulse text-center">ANALSANDO FISIONOMIA COM IA...</p>
                    <p className="text-[10px] text-gray-500 text-center uppercase tracking-widest mt-0.5">Validando identidade profunda</p>
                  </div>
                </div>
              )}
            </div>

            <div className="w-full flex gap-2.5 mt-5">
              <button
                type="button"
                onClick={handleReset}
                disabled={loading}
                className="flex-1 py-2.5 px-4 rounded-xl border border-gray-800 text-xs text-gray-400 font-semibold hover:bg-gray-800 hover:text-white transition-all"
              >
                Voltar
              </button>
              
              <button
                type="button"
                onClick={handleCaptureAndRegister}
                disabled={loading}
                className="flex-[2] py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-blue-500/10 flex items-center justify-center gap-1.5 transition-all"
              >
                <Fingerprint className="h-4 w-4" />
                Registrar Ponto (Confirmar Face)
              </button>
            </div>
            
            <canvas ref={canvasRef} className="hidden" />
          </div>
        )}

        {step === 'success' && successInfo && employee && (
          <div className="w-full max-w-md bg-emerald-950/10 border border-emerald-500/25 rounded-2xl p-6 shadow-2xl backdrop-blur-md text-center flex flex-col items-center animate-fade-in">
            <div className="h-14 w-14 rounded-full bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center mb-4">
              <CheckCircle2 className="h-8 w-8 text-emerald-400 animate-bounce" />
            </div>

            <p className="text-[10px] text-emerald-400 font-mono tracking-widest uppercase mb-1">REGISTRO CONFIRMADO COM SUCESSO</p>
            <h3 className="text-xl font-black text-white mb-4">Ponto Registrado!</h3>

            <div className="w-full bg-gray-900/40 rounded-xl p-4 border border-gray-800/60 mb-5 space-y-2.5">
              <div className="flex justify-between items-center text-xs pb-2 border-b border-gray-800/40">
                <span className="text-gray-400">Colaborador</span>
                <span className="font-semibold text-white">{employee.nome}</span>
              </div>
              <div className="flex justify-between items-center text-xs pb-2 border-b border-gray-800/40">
                <span className="text-gray-400">CPF</span>
                <span className="font-mono text-white">{cpf}</span>
              </div>
              <div className="flex justify-between items-center text-xs pb-2 border-b border-gray-800/40">
                <span className="text-gray-400">Tipo</span>
                <span className="font-semibold text-blue-400">{translatePontoType(successInfo.tipo)}</span>
              </div>
              <div className="flex justify-between items-center text-xs pb-2 border-b border-gray-800/40">
                <span className="text-gray-400">Horário</span>
                <span className="font-mono font-bold text-white text-md">{successInfo.hora}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400">Data</span>
                <span className="font-mono text-white">{successInfo.data.split("-").reverse().join("/")}</span>
              </div>
            </div>

            {recognitionResult && (
              <div className="text-[10px] font-mono text-gray-500 mb-5 max-w-xs leading-relaxed">
                Biometria IA: Confiança de <b>{(recognitionResult.confidence * 100).toFixed(0)}%</b>.<br />
                {recognitionResult.reason}
              </div>
            )}

            <button
              type="button"
              onClick={handleReset}
              className="w-full py-2 bg-gray-900 border border-gray-800 hover:border-gray-700 text-xs font-semibold rounded-xl text-gray-300 hover:text-white transition-all shadow-sm"
            >
              Novo Registro
            </button>
          </div>
        )}

        {step === 'error' && (
          <div className="w-full max-w-md bg-red-950/10 border border-red-500/25 rounded-2xl p-6 shadow-2xl backdrop-blur-md text-center flex flex-col items-center">
            <div className="h-14 w-14 rounded-full bg-red-500/15 border border-red-500/20 flex items-center justify-center mb-4">
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>

            <p className="text-[10px] text-red-500 font-mono tracking-widest uppercase mb-1">FALHA DE VALIDAÇÃO DE IDENTIDADE</p>
            <h3 className="text-lg font-bold text-white mb-2">Reconhecimento Recusado</h3>
            <p className="text-xs text-gray-400 mb-5 leading-relaxed">
              Ocorreu uma divergência no reconhecimento facial biométrico. A webcam não conseguiu certificar a semelhança facial com as chaves corporativas cadastradas.
            </p>

            {errorMsg && (
              <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-3 mb-5 text-xs text-red-300 font-mono max-w-sm">
                <b>Motivo:</b> {errorMsg}
              </div>
            )}

            <div className="w-full grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleReset}
                className="py-2.5 bg-gray-900 border border-gray-800 text-xs font-semibold rounded-xl text-gray-400 hover:bg-gray-800 hover:text-white transition-all"
              >
                Início
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep('webcam');
                  startWebcam();
                }}
                className="py-2.5 bg-red-600/15 border border-red-500/20 text-xs font-semibold rounded-xl text-red-300 hover:bg-red-600/25 transition-all"
              >
                Tentar Novamente
              </button>
            </div>
          </div>
        )}

      </main>

      {/* Bottom Footer Info Section */}
      <footer className="max-w-7xl w-full mx-auto text-center py-4 text-[11px] text-gray-500 border-t border-gray-850/40 z-10 font-mono">
        SmartPoint Web © {new Date().getFullYear()} • Sistema de Ponto de Alta Precisão • Integrado ao Google Sheets™
      </footer>

      {/* MODAL: SOLICITAR AJUSTE */}
      {isAjusteModalOpen && (
        <div className="fixed inset-0 bg-gray-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-[#121829] border border-gray-800/80 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            
            <div className="flex justify-between items-center pb-2 border-b border-gray-800/40">
              <h3 className="text-md font-bold text-white">Solicitar Ajuste de Ponto</h3>
              <button 
                onClick={() => setIsAjusteModalOpen(false)}
                className="text-gray-400 hover:text-white text-xs px-2.5 py-1 rounded bg-gray-900 border border-gray-800 cursor-pointer"
              >
                Fechar
              </button>
            </div>

            <form onSubmit={handleAjusteSubmit} className="space-y-4 text-xs">
              
              <div>
                <label className="block text-[10px] font-bold text-gray-300 uppercase tracking-wider mb-1">Seu CPF Cadastrado</label>
                <input
                  type="text"
                  value={ajForm.cpf}
                  onChange={(e) => {
                    let v = e.target.value.replace(/\D/g, "");
                    if (v.length > 11) v = v.slice(0, 11);
                    if (v.length > 9) v = `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9)}`;
                    else if (v.length > 6) v = `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6)}`;
                    else if (v.length > 3) v = `${v.slice(0, 3)}.${v.slice(3)}`;
                    setAjForm(p => ({ ...p, cpf: v }));
                  }}
                  placeholder="000.000.000-00"
                  className="w-full bg-[#131b2d] border border-gray-800 p-2.5 rounded-lg outline-none font-mono tracking-widest text-white text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-300 uppercase tracking-wider mb-1">Data da Batida</label>
                  <input
                    type="date"
                    value={ajForm.data}
                    onChange={(e) => setAjForm(p => ({ ...p, data: e.target.value }))}
                    className="w-full bg-[#131b2d] border border-gray-800 p-2 rounded-lg text-white font-mono text-center"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-300 uppercase tracking-wider mb-1">Horário Correto</label>
                  <input
                    type="time"
                    value={ajForm.horaNova}
                    onChange={(e) => setAjForm(p => ({ ...p, horaNova: e.target.value }))}
                    className="w-full bg-[#131b2d] border border-gray-800 p-2 rounded-lg text-white font-mono text-center"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-300 uppercase tracking-wider mb-1">Tipo do Registro</label>
                <select
                  value={ajForm.tipo}
                  onChange={(e) => setAjForm(p => ({ ...p, tipo: e.target.value as TimeLogType }))}
                  className="w-full bg-[#131b2d] border border-gray-800 p-2.5 rounded-lg text-white text-xs"
                >
                  <option value="entrada">Entrada</option>
                  <option value="almoco_saida">Almoço (Saída)</option>
                  <option value="almoco_retorno">Almoço (Retorno)</option>
                  <option value="saida_final">Saída Final</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-300 uppercase tracking-wider mb-1">Justificativa do Envio</label>
                <textarea
                  value={ajForm.justificativa}
                  onChange={(e) => setAjForm(p => ({ ...p, justificativa: e.target.value }))}
                  placeholder="Explique detalhadamente o ocorrido (Ex: Esquecimento, Visita externa, Falha de conexão...)"
                  className="w-full bg-[#131b2d] border border-gray-800 p-2.5 rounded-lg text-white text-xs h-20 resize-none outline-none focus:border-blue-500"
                  required
                />
              </div>

              {ajError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-200 text-xs py-2 px-3 rounded-lg flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                  <span>{ajError}</span>
                </div>
              )}

              {ajSuccess && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs py-2 px-3 rounded-lg flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>{ajSuccess}</span>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setIsAjusteModalOpen(false)}
                  disabled={ajLoading}
                  className="py-2.5 px-4 bg-gray-900 border border-gray-800 text-gray-400 hover:text-white rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={ajLoading}
                  className="py-2.5 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold flex items-center gap-1 cursor-pointer"
                >
                  {ajLoading ? <RefreshCw className="h-4.5 w-4.5 animate-spin" /> : "Enviar Solicitação"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
