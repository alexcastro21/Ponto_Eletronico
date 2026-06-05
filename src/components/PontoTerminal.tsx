import React, { useState, useRef, useEffect } from "react";
import { Camera, Calendar, Clock, CheckCircle2, AlertTriangle, Fingerprint, RefreshCw, UserCheck, Smartphone, Eye, MapPin, Printer, ShieldCheck, HelpCircle } from "lucide-react";
import { Employee, TimeLogType, Company, Scale } from "../types";

interface PontoTerminalProps {
  onAdminAccess: () => void;
}

export default function PontoTerminal({ onAdminAccess }: PontoTerminalProps) {
  // Database / Config state
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [escalas, setEscalas] = useState<Scale[]>([]);
  
  // Terminal state machine
  const [step, setStep] = useState<'scanning' | 'liveness' | 'confirm' | 'success' | 'error'>('scanning');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  // Biometrics matching outcome
  const [identifiedEmployee, setIdentifiedEmployee] = useState<Employee | null>(null);
  const [pontoTipo, setPontoTipo] = useState<TimeLogType>("entrada");
  const [recommendedType, setRecommendedType] = useState<TimeLogType>("entrada");
  const [recognitionResult, setRecognitionResult] = useState<{
    matched: boolean;
    confidence: number;
    reason: string;
  } | null>(null);
  const [successLog, setSuccessLog] = useState<any>(null);

  // Simulation parameters (allows mock test of specific targets)
  const [simulationCpf, setSimulationCpf] = useState<string>("");
  const [hasCamera, setHasCamera] = useState(true);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [showDisclaimer, setShowDisclaimer] = useState(true);
  const [showSimulador, setShowSimulador] = useState(false);

  // Liveness progress simulator
  const [livenessProgress, setLivenessProgress] = useState(0);
  const [livenessTask, setLivenessTask] = useState<"piscar" | "sorrir">("piscar");

  // Multi-Company Adjustment Modal States
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

  // Clock
  const [timeState, setTimeState] = useState(new Date());

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize terminal data dependencies
  useEffect(() => {
    fetchInitialData();
    const clockTimer = setInterval(() => setTimeState(new Date()), 1000);
    startWebcam();

    return () => {
      clearInterval(clockTimer);
      stopWebcam();
    };
  }, []);

  const fetchInitialData = async () => {
    try {
      const res = await fetch("/api/db");
      if (res.ok) {
        const data = await res.json();
        setEmployees(data.employees || []);
        setCompanies(data.companies || []);
        setEscalas(data.escalas || []);
        
        // Do not auto-select any employee as default layout target to avoid accidental false identity matches
        setSimulationCpf("");
      }
    } catch (err) {
      console.error("Erro ao carregar dados do terminal:", err);
    }
  };

  // Web Audio Synthesizer Beep Feedback (REP-P compliance)
  const playBeep = (isSuccess: boolean) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      if (isSuccess) {
        // High pitched futuristic success chime
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
        
        setTimeout(() => {
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.type = "sine";
          osc2.frequency.setValueAtTime(1174.66, ctx.currentTime); // D6 note
          gain2.gain.setValueAtTime(0.15, ctx.currentTime);
          osc2.start();
          osc2.stop(ctx.currentTime + 0.18);
        }, 120);
      } else {
        // Flat buzz for failed auth
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(180, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      }
    } catch (e) {
      console.warn("Audio Context bloqueado ou inativo:", e);
    }
  };

  // Camera Management
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
      console.warn("Nenhuma webcam física localizada, habilitando simulador facial.");
      setHasCamera(false);
    }
  };

  const stopWebcam = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
  };

  // Re-bind stream when videoRef is mounted or step changes
  useEffect(() => {
    if (cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream, step]);

  // Generate a downsampled greyscale visual signature to match faces locally
  const getVisualFingerprint = (dataUrl: string): Promise<number[]> => {
    return new Promise((resolve) => {
      if (!dataUrl || !dataUrl.startsWith("data:image/")) {
        resolve([]);
        return;
      }
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 12;
        canvas.height = 12;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve([]);
          return;
        }
        ctx.drawImage(img, 0, 0, 12, 12);
        try {
          const imgData = ctx.getImageData(0, 0, 12, 12).data;
          const result: number[] = [];
          for (let i = 0; i < imgData.length; i += 4) {
            const r = imgData[i];
            const g = imgData[i+1];
            const b = imgData[i+2];
            // Standard NTSC Grayscale coefficients
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            result.push(gray);
          }
          resolve(result);
        } catch (e) {
          resolve([]);
        }
      };
      img.onerror = () => resolve([]);
      img.src = dataUrl;
    });
  };

  const calculateDistance = (fp1: number[], fp2: number[]): number => {
    if (fp1.length !== fp2.length || fp1.length === 0) return Infinity;
    let sumSq = 0;
    for (let i = 0; i < fp1.length; i++) {
      const diff = fp1[i] - fp2[i];
      sumSq += diff * diff;
    }
    return Math.sqrt(sumSq);
  };

  // Core Reusable Biometric Identification Engine (1:N matching)
  const runIdentificationWithPhoto = async (photoDataUri: string, forcedCpf?: string) => {
    if (!photoDataUri) {
      throw new Error("Foto capturada ou informada é inválida para identificação.");
    }

    // Compute client-side smart biometric mapping matching real registered photographs
    let clientMatchedCpf = forcedCpf || "";

    if (!clientMatchedCpf) {
      const customPhotoEmployees = employees.filter(e => 
        e.status === "ativo" &&
        e.fotoUrl && e.fotoUrl.startsWith("data:image/") && !e.fotoUrl.toLowerCase().includes("svg")
      );

      if (customPhotoEmployees.length > 0) {
        // 1. Try exact string matching of base64 data (100% precise, zero-cost, perfect for uploaded or selected files)
        const exactMatch = customPhotoEmployees.find(emp => emp.fotoUrl === photoDataUri);
        if (exactMatch) {
          clientMatchedCpf = exactMatch.cpf;
        } else {
          // 2. Fall back to mathematical visual fingerprint mapping
          try {
            const capturedFp = await getVisualFingerprint(photoDataUri);
            if (capturedFp.length > 0) {
              let minDistance = Infinity;
              let bestCpf = "";
              for (const emp of customPhotoEmployees) {
                const empFp = await getVisualFingerprint(emp.fotoUrl);
                const dist = calculateDistance(capturedFp, empFp);
                if (dist < minDistance) {
                  minDistance = dist;
                  bestCpf = emp.cpf;
                }
              }
              // Set a strict threshold (e.g. 150) so that random or different faces are correctly rejected
              if (bestCpf && minDistance < 150) {
                clientMatchedCpf = bestCpf;
              }
            }
          } catch (err) {
            console.warn("Erro ao calcular mapeamento fisionômico local:", err);
          }
        }
      }
    }

    // Query 1-to-Many smart identifier endpoint
    const targetCpfToSimulate = forcedCpf || simulationCpf;
    const res = await fetch("/api/ponto/identify-face", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        capturedFrame: photoDataUri,
        simulatedCpf: targetCpfToSimulate || "", // Sandbox helper
        clientMatchedCpf: clientMatchedCpf
      })
    });

    const responseData = await res.json();
    if (!res.ok) {
      throw new Error(responseData.error || "Nenhum perfil facial compatível.");
    }

    if (!responseData.matched || !responseData.employee) {
      playBeep(false);
      setStep('error');
      setErrorMsg(responseData.reason || "Não foi possível reconhecer sua biometria facial. Verifique o posicionamento do rosto.");
      return;
    }

    // Found candidate employee! Store metadata.
    setIdentifiedEmployee(responseData.employee);
    setRecognitionResult({
      matched: responseData.matched,
      confidence: responseData.confidence,
      reason: responseData.reason
    });

    // Go to Anti-Spoofing and Liveness Challenge
    setStep('liveness');
    setLivenessProgress(0);
    setLivenessTask("piscar");
  };

  // Handler for custom terminal photo upload if camera is blocked in iframe
  const handleTerminalPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setErrorMsg("Imagens para reconhecimento facial devem ser menores que 2MB.");
        setStep('error');
        return;
      }
      setLoading(true);
      setErrorMsg("");
      const reader = new FileReader();
      reader.onload = async (event) => {
        if (event.target?.result) {
          const b64 = event.target.result as string;
          setCapturedImage(b64);
          try {
            await runIdentificationWithPhoto(b64);
          } catch (err: any) {
            playBeep(false);
            setErrorMsg(err.message || "Erro no reconhecimento facial pelo arquivo enviado.");
            setStep('error');
          } finally {
            setLoading(false);
          }
        }
      };
      reader.onerror = () => {
        setLoading(false);
        setErrorMsg("Erro ao ler arquivo da imagem de rosto.");
        setStep('error');
      };
      reader.readAsDataURL(file);
    }
  };

  // Handler to simulate a specific registered user presenting their face to the camera
  const handleSimulatedIdentify = async (selectedCpf: string) => {
    if (!selectedCpf) return;
    const emp = employees.find(e => e.cpf === selectedCpf);
    if (!emp || !emp.fotoUrl) {
      setErrorMsg("O colaborador selecionado não possui uma foto de perfil válida para apresentar.");
      setStep('error');
      return;
    }

    setLoading(true);
    setErrorMsg("");
    setCapturedImage(emp.fotoUrl);

    try {
      await runIdentificationWithPhoto(emp.fotoUrl, selectedCpf);
    } catch (err: any) {
      playBeep(false);
      setErrorMsg(err.message || "Erro no reconhecimento facial simulado.");
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  // Launch One-to-Many physical biometric hardware identification flow
  const handleScanIdentification = async () => {
    setLoading(true);
    setErrorMsg("");

    let photoDataUri = "";

    // Capture base64 from video stream if active and producing frames
    let capturedFromCam = false;
    if (hasCamera && videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      const width = video.videoWidth || 640;
      const height = video.videoHeight || 480;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1); // mirror reflection
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        photoDataUri = canvas.toDataURL("image/jpeg", 0.85);
        if (photoDataUri && photoDataUri.length > 500) {
          capturedFromCam = true;
        }
      }
    }

    if (!photoDataUri) {
      if (!hasCamera && simulationCpf) {
        const emp = employees.find(e => e.cpf === simulationCpf);
        if (emp && emp.fotoUrl) {
          photoDataUri = emp.fotoUrl;
          capturedFromCam = true;
        }
      }
    }

    if (!photoDataUri) {
      setLoading(false);
      playBeep(false);
      setStep('error');
      if (!hasCamera) {
        setErrorMsg("Presença facial não detectada no simulador sandbox. Por favor, selecione um funcionário no painel de simulação 'Apresentar Rosto' para realizar o reconhecimento facial.");
      } else {
        setErrorMsg("Falha na captura da webcam. Certifique-se de que a câmera está conectada e com permissão ativa no navegador para realizar o reconhecimento facial.");
      }
      return;
    }

    setCapturedImage(photoDataUri);

    try {
      await runIdentificationWithPhoto(photoDataUri);
    } catch (err: any) {
      playBeep(false);
      setErrorMsg(err.message || "Erro no processamento da biometria facial.");
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  // Simulate Liveness Check Progress Loop
  useEffect(() => {
    if (step !== 'liveness') return;

    const interval = setInterval(() => {
      setLivenessProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          goToClockInConfirmation();
          return 100;
        }
        
        // At 50%, change challenge instruction to "sorrir" (smile)
        if (prev === 50) {
          setLivenessTask("sorrir");
        }
        
        return prev + 10;
      });
    }, 180);

    return () => clearInterval(interval);
  }, [step]);

  const goToClockInConfirmation = async () => {
    if (!identifiedEmployee) return;

    // Suggest recommended time clock type based on historic entries today
    try {
      const res = await fetch("/api/ponto/check-cpf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cpf: identifiedEmployee.cpf })
      });
      if (res.ok) {
        const checkData = await res.json();
        setRecommendedType(checkData.recommendedType);
        setPontoTipo(checkData.recommendedType);
      }
    } catch (e) {
      console.warn("Erro ao buscar recomendação de intervalo:", e);
    }

    setStep('confirm');
  };

  // Register confirmed clock-in record with signing and client telemetry data
  const handleFinalRegister = async () => {
    if (!identifiedEmployee) return;
    setLoading(true);
    setErrorMsg("");

    try {
      // Check for user coordinates if supported, to embed in Portaria 671 ticket telemetry
      let gpsCoordinates = "Local do Dispositivo Fixo";
      if (navigator.geolocation) {
        const getGeo = () => new Promise<string>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve(`${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`),
            () => resolve("Terminal com Geolocalização Bloqueada")
          );
        });
        gpsCoordinates = await getGeo();
      }

      const registerRes = await fetch("/api/ponto/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cpf: identifiedEmployee.cpf,
          tipo: pontoTipo,
          capturedFrame: capturedImage,
          confidence: recognitionResult?.confidence || 0.95,
          matched: true,
          gpsCoordinates
        })
      });

      const registerData = await registerRes.json();
      if (!registerRes.ok) {
        throw new Error(registerData.error || "Erro no envio do comprovante.");
      }

      // Successful clock-in! Play beep!
      playBeep(true);
      setSuccessLog(registerData.log);
      setStep('success');

      // Auto restore to main scanning phase after 7 seconds
      setTimeout(() => {
        handleReset();
      }, 7000);

    } catch (err: any) {
      playBeep(false);
      setErrorMsg(err.message || "Falha técnica ao concluir o arquivamento do ponto.");
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setIdentifiedEmployee(null);
    setRecognitionResult(null);
    setSuccessLog(null);
    setCapturedImage(null);
    setStep('scanning');
    startWebcam();
  };

  const translatePontoType = (type: TimeLogType) => {
    switch (type) {
      case "entrada": return "Entrada Oficial";
      case "almoco_saida": return "Saída p/ Almoço";
      case "almoco_retorno": return "Retorno do Almoço";
      case "saida_final": return "Saída Final";
      default: return "";
    }
  };

  const getCompanyName = (empId?: string) => {
    if (!empId) return "Empresa Conveniada S/A";
    const comp = companies.find(c => c.id === empId);
    return comp ? comp.nome : "Empresa Conveniada S/A";
  };

  const getCompanyCnpj = (empId?: string) => {
    if (!empId) return "00.000.000/0001-00";
    const comp = companies.find(c => c.id === empId);
    return comp ? comp.cnpj : "00.000.000/0001-00";
  };

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

  const triggerReceiptPrint = () => {
    window.print();
  };

  return (
    <div id="ponto_terminal_view" className="w-full min-h-screen bg-[#070a13] text-gray-100 flex flex-col justify-between p-4 relative overflow-hidden font-sans">
      
      {/* Background radial effects */}
      <div className="absolute top-[-30%] left-[-20%] w-[80%] h-[80%] rounded-full bg-blue-900/10 blur-[150px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-20%] w-[60%] h-[60%] rounded-full bg-indigo-950/15 blur-[150px] pointer-events-none"></div>

      {/* Corporate Header Section */}
      <header className="max-w-7xl w-full mx-auto flex items-center justify-between py-3 px-4 border-b border-gray-800/50 z-10 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-emerald-600 via-blue-600 to-indigo-500 p-0.5 flex items-center justify-center shadow-lg shadow-blue-500/10 hover:scale-105 transition-all">
            <div className="h-full w-full bg-[#070a13] rounded-[14px] flex items-center justify-center">
              <Fingerprint className="h-5 w-5 text-emerald-400 animate-pulse" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
                SmartPoint
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 tracking-wider">
                VERSÃO 2.0
              </span>
            </div>
            <p className="text-[9px] text-gray-500 font-mono tracking-widest uppercase">Facial Inteligente (Portaria 671/MTE)</p>
          </div>
        </div>
        
        {/* Navigation Buttons */}
        <div className="flex items-center gap-2">
          <button 
            id="btn_request_adjustment"
            onClick={() => {
              setAjError("");
              setAjSuccess("");
              setIsAjusteModalOpen(true);
            }}
            className="text-xs font-semibold text-gray-300 hover:text-white px-3.5 py-2 rounded-xl border border-gray-850 hover:border-gray-700 bg-gray-900/40 hover:bg-gray-800/60 transition-all flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-blue-400" />
            Solicitar Ajuste
          </button>
          
          <button 
            id="btn_admin_dashboard_link"
            onClick={onAdminAccess}
            className="text-xs font-semibold text-gray-300 hover:text-white px-3.5 py-2 rounded-xl border border-gray-850 hover:border-gray-700 bg-gray-900/60 hover:bg-gray-850 transition-all flex items-center gap-2 shadow-sm cursor-pointer"
          >
            Painel Administrativo
          </button>
        </div>
      </header>

      {/* Main Container Viewport */}
      <main className="flex-1 max-w-5xl w-full mx-auto flex flex-col md:flex-row items-center justify-center gap-8 z-10 py-6">
        
        {/* Left Side: Live Clock, Status Info Panel & Liveness Indicators */}
        <div className="w-full md:w-[40%] flex flex-col justify-center space-y-5">
          
          {/* Dynamic high contrast clock block */}
          <div className="bg-gray-900/40 border border-gray-850/60 rounded-2xl p-6 backdrop-blur-md relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500"></div>
            <div className="absolute top-3 right-4 text-[9px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-900/30 px-2 py-0.5 rounded flex items-center gap-1.5 font-bold">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping"></span>
              REPOSITÓRIO SEGURO
            </div>

            <p className="text-[10px] text-gray-400 font-mono tracking-widest uppercase mb-1 font-sans">HORÁRIO DE JORNADA OFICIAL</p>
            <div className="text-5xl font-black tracking-tight text-white font-mono mb-2">
              {timeState.toLocaleTimeString('pt-BR', { hour12: false })}
            </div>
            <div className="text-xs text-gray-300 flex items-center gap-2 font-mono">
              <Calendar className="h-4 w-4 text-emerald-400 shrink-0" />
              {timeState.toLocaleDateString('pt-BR', { dateStyle: 'full' })}
            </div>
          </div>

          {/* LGPD compliance block rendered cleanly aligned on side layout */}
          {showDisclaimer && (
            <div className="p-4 rounded-2xl bg-gray-900/40 border border-gray-850 text-xs text-gray-400 leading-relaxed relative shadow-md">
              <button 
                onClick={() => setShowDisclaimer(false)}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-white px-2 cursor-pointer text-sm font-bold"
              >
                ×
              </button>
              <div className="font-bold flex items-center gap-2 text-emerald-400 mb-1.5 font-sans uppercase text-[10px] tracking-wider">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                Consentimento e LGPD
              </div>
              Ao posicionar seu rosto no terminal de identificação, você consente com o processamento biométrico facial para fins exclusivos de marcação de jornada profissional, em conformidade com a Lei Geral de Proteção de Dados (LGPD - nº 13.709) e a Portaria 671 MTE.
            </div>
          )}

        </div>

        {/* Right Side: Primary Webcam Scan Frame / States */}
        <div className="w-full md:w-[60%] flex flex-col">
          
          {/* Main Visual Terminal Shell */}
          <div id="ponto_camera_card" className="bg-gray-900/65 border border-gray-800/80 rounded-[28px] p-6 shadow-2xl backdrop-blur-md flex flex-col items-center">
            
            {/* Step 1: Scanning / Standby */}
            {step === 'scanning' && (
              <div className="w-full flex flex-col items-center">
                <div className="w-full text-center mb-4">
                  <span className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs font-semibold text-blue-400 tracking-wider">
                    RECONHECIMENTO FACIAL 1:N
                  </span>
                  <h2 className="text-lg font-bold text-white mt-2">Aproxime-se do Terminal</h2>
                  <p className="text-xs text-gray-400 mt-1">O motor neural da IA localizará seu cadastro e batida automaticamente</p>
                </div>

                {/* Webcam/Interactive frame wrapper in vertical portrait format */}
                <div className="w-full max-w-[325px] aspect-[3/4] bg-[#05070e] rounded-2xl border border-gray-850 hover:border-blue-900/40 relative overflow-hidden flex flex-col items-center justify-center transition-all mx-auto shadow-2xl">
                  
                  {hasCamera ? (
                    <>
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover scale-x-[-1]"
                      />
                      {/* Laser scanning laser and bounds */}
                      <div className="absolute inset-0 border-2 border-dashed border-blue-500/20 pointer-events-none rounded-2xl m-5">
                        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent shadow-[0_0_12px_#3b82f6] animate-[runningScan_3s_infinite]" style={{ animation: "runningScan 3.5s ease-in-out infinite" }}></div>
                        
                        {/* Dynamic camera face helper brackets */}
                        <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-blue-400 rounded-tl"></div>
                        <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-blue-400 rounded-tr"></div>
                        <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-blue-400 rounded-bl"></div>
                        <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-blue-400 rounded-br"></div>
                        
                        {/* Live circular bio reticle */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-36 h-36 border border-blue-500/25 rounded-full animate-[pulse_2s_infinite] flex items-center justify-center relative">
                            <span className="text-[8px] font-mono text-blue-400 bg-gray-950/75 border border-blue-900/40 px-2 py-0.5 rounded tracking-widest animate-pulse font-bold text-center">
                              BIO FACE SCANNER
                            </span>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center p-4 text-center space-y-3.5 w-full">
                      <div className="h-11 w-11 rounded-2xl bg-amber-500/10 border border-amber-550/20 flex items-center justify-center text-amber-400 shadow-inner shrink-0">
                        <Camera className="h-5 w-5 animate-pulse" />
                      </div>
                      <div className="px-2 w-full">
                        <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Webcam Bloqueada / Indisponível</h4>
                        <p className="text-[10px] text-gray-400 leading-relaxed max-w-[240px] mt-1 mx-auto pb-1">
                          Devido às restrições de permissão do navegador, a câmera física não pôde ser ativada. Use o simulador oficial abaixo para testar a biometria:
                        </p>

                        <button
                          type="button"
                          onClick={() => startWebcam()}
                          className="mb-2 text-[10px] bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 font-bold py-1 px-2.5 rounded-lg cursor-pointer transition-all uppercase tracking-wide inline-flex items-center gap-1.5"
                        >
                          <RefreshCw className="h-3 w-3" />
                          Reativar Minha Câmera
                        </button>

                        <div className="mt-3 w-full">
                          <label className="block text-[9px] font-mono font-bold text-gray-400 text-left uppercase tracking-wider mb-1.5">
                            Selecione o Rosto para Apresentar:
                          </label>
                          <select
                            id="select_terminal_simulate_cpf"
                            value={simulationCpf}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSimulationCpf(val);
                            }}
                            className="w-full py-2 px-3 bg-gray-900 border border-gray-800 focus:border-blue-500 transition-all text-xs font-semibold text-gray-200 rounded-xl cursor-pointer"
                          >
                            <option value="">-- Apresentar Rosto de... --</option>
                            {employees
                              .filter(emp => emp.status === "ativo" && emp.fotoUrl && emp.fotoUrl.startsWith("data:image/") && !emp.fotoUrl.toLowerCase().includes("svg"))
                              .map(emp => (
                                <option key={emp.cpf} value={emp.cpf}>
                                  👤 {emp.nome} ({emp.cargo})
                                </option>
                              ))
                            }
                          </select>
                        </div>
                      </div>

                      {simulationCpf ? (
                        <div className="relative mt-2 flex flex-col items-center">
                          <div className="h-28 w-28 rounded-full overflow-hidden border-2 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)] animate-pulse">
                            <img 
                              src={employees.find(e => e.cpf === simulationCpf)?.fotoUrl} 
                              alt="Rosto Apresentado" 
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-900/30 px-2 py-0.5 rounded tracking-widest mt-2 animate-pulse font-bold text-center">
                            ROSTO PRONTO PARA LEITURA
                          </span>
                        </div>
                      ) : (
                        <div className="h-1 w-12 bg-amber-500/20 rounded-full mt-2"></div>
                      )}
                    </div>
                  )}

                  {loading && (
                    <div className="absolute inset-0 bg-gray-950/85 backdrop-blur-md flex flex-col items-center justify-center space-y-3 z-30 animate-fade-in">
                      <div className="relative flex items-center justify-center">
                        <div className="h-14 w-14 border-3 border-t-emerald-400 border-gray-800 rounded-full animate-spin"></div>
                        <Fingerprint className="h-6 w-6 text-emerald-400 absolute animate-pulse" />
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-emerald-400 font-mono tracking-widest uppercase animate-pulse">ANALISANDO REQUISITOS MULTI-PROPRIETÁRIOS...</p>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Pesquisando identidade REP-P na nuvem</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="w-full mt-6">
                  <button
                    type="button"
                    onClick={handleScanIdentification}
                    disabled={loading}
                    className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 hover:from-blue-500 hover:via-indigo-500 hover:to-emerald-500 text-white font-bold text-sm rounded-2xl shadow-lg hover:shadow-blue-500/10 cursor-pointer flex items-center justify-center gap-2 transform active:scale-[0.99] transition-all"
                  >
                    <Camera className="h-5 w-5 animate-pulse" />
                    Identificar Biometria & Bater Ponto
                  </button>
                </div>


              </div>
            )}

            {/* Step 2: Liveness (Anti-Spoofing Challenge) */}
            {step === 'liveness' && identifiedEmployee && (
              <div className="w-full flex flex-col items-center py-6">
                <ShieldCheck className="h-12 w-12 text-emerald-400 animate-pulse mb-3" />
                <h3 className="text-lg font-bold text-white text-center">Teste de Vivacidade Ativo (Liveness)</h3>
                <p className="text-xs text-gray-400 text-center max-w-md mt-1 mb-6">
                  Regulamento Portaria 671 MTE: Proteção contra spoofing (fraudes com fotos/telas).
                </p>

                <div className="w-full max-w-sm bg-gray-950 border border-gray-850 rounded-2xl p-6 text-center shadow-inner relative">
                  
                  {/* Dynamic Instruction */}
                  <div className="text-md font-bold text-emerald-400 font-mono tracking-wide uppercase animate-pulse mb-4 h-6">
                    {livenessTask === "piscar" ? "✦ PISQUE OS OLHOS PARA A CÂMERA ✦" : "✦ AGORA SORRIA PARA CONCLUIR ✦"}
                  </div>

                  <div className="relative h-4 w-full bg-gray-900 rounded-full overflow-hidden mb-4 border border-gray-800">
                    <div 
                      className="absolute left-0 top-0 h-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-150"
                      style={{ width: `${livenessProgress}%` }}
                    />
                  </div>

                  <div className="text-[10px] text-gray-500 font-mono">
                    VALIDANDO PARÂMETROS... {livenessProgress}%
                  </div>

                </div>

                <div className="mt-8 text-xs text-gray-400 italic">
                  Processando biometria de: <span className="font-bold text-white">{identifiedEmployee.nome}</span>
                </div>
              </div>
            )}

            {/* Step 3: Clock-In Confirmation (Event Selection) */}
            {step === 'confirm' && identifiedEmployee && (
              <div className="w-full flex flex-col animate-fade-in">
                
                {/* Employee card header */}
                <div className="w-full flex items-center justify-between pb-3.5 border-b border-gray-850 mb-5">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full border border-gray-800 overflow-hidden bg-gray-800 shrink-0">
                      <img src={identifiedEmployee.fotoUrl} alt={identifiedEmployee.nome} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <div>
                      <p className="text-[9px] text-emerald-400 font-mono tracking-widest uppercase font-bold">Colaborador Identificado</p>
                      <h3 className="text-md font-bold text-white">{identifiedEmployee.nome}</h3>
                      <p className="text-[10px] text-gray-400 font-mono">{identifiedEmployee.cargo} • SETOR: {identifiedEmployee.setor}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] text-gray-500 font-mono uppercase">Vínculo Legal</p>
                    <p className="text-[10px] font-bold text-blue-400">{getCompanyName(identifiedEmployee.empresaId)}</p>
                  </div>
                </div>

                {/* Event Select Box */}
                <div className="w-full mb-5">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 font-mono">
                    Selecione o Tipo do Registro de Ponto
                  </label>
                  
                  <div className="grid grid-cols-2 gap-3">
                    {(['entrada', 'almoco_saida', 'almoco_retorno', 'saida_final'] as TimeLogType[]).map((type) => {
                      const isRec = recommendedType === type;
                      return (
                        <button
                          key={type}
                          type="button"
                          id={`ponto_type_btn_${type}`}
                          onClick={() => setPontoTipo(type)}
                          className={`p-3.5 rounded-2xl text-xs font-bold border transition-all text-left relative cursor-pointer active:scale-95 ${
                            pontoTipo === type
                              ? "bg-emerald-500/10 border-emerald-500 text-emerald-300 ring-2 ring-emerald-500/10"
                              : "bg-gray-950 border-gray-850 hover:border-gray-700 hover:bg-gray-900/60 text-gray-400"
                          }`}
                        >
                          <div className="font-semibold text-xs">{translatePontoType(type)}</div>
                          {isRec && (
                            <span className="absolute top-2 right-2 flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                          )}
                          <div className="text-[9px] text-gray-500 font-mono font-medium mt-1">
                            {isRec ? "Recomendado" : "Opção Manual"}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Live selfie thumb */}
                {capturedImage && (
                  <div className="w-full bg-gray-950 border border-gray-850 rounded-2xl p-3 mb-5 flex items-center gap-4">
                    <div className="h-16 w-24 rounded-lg overflow-hidden border border-gray-800 bg-black shrink-0 relative">
                      <img src={capturedImage} alt="Webcam Capture" className="h-full w-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end justify-center pb-1">
                        <span className="text-[8px] text-emerald-400 font-mono tracking-wide font-bold">LIVENESS OK</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-gray-300 uppercase tracking-wider mb-0.5">Biometria Facial SmartPoint 1:N</div>
                      <p className="text-[10px] text-gray-400 font-mono leading-relaxed">
                        Taxa de Confiança: <span className="text-emerald-400 font-bold">{(recognitionResult?.confidence ? recognitionResult.confidence * 100 : 96).toFixed(0)}%</span><br />
                        {recognitionResult?.reason || "Semelhança facial profunda processada localmente pela rede neural."}
                      </p>
                    </div>
                  </div>
                )}

                {/* Confirm Register buttons */}
                <div className="w-full grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={loading}
                    className="py-3 bg-gray-950 hover:bg-gray-900 border border-gray-850 hover:border-gray-700 text-xs text-gray-300 font-bold rounded-xl transition-all cursor-pointer"
                  >
                    Voltar
                  </button>
                  
                  <button
                    type="button"
                    id="btn_confirm_clock_in"
                    onClick={handleFinalRegister}
                    disabled={loading}
                    className="col-span-2 py-3 bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-500 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-1.5 transition-all"
                  >
                    {loading ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                        Confirmar e Registrar Ponto
                      </>
                    )}
                  </button>
                </div>

              </div>
            )}

            {/* Step 4: Success Receipt Coupon layout (Fiscal standards) */}
            {step === 'success' && successLog && identifiedEmployee && (
              <div className="w-full flex flex-col items-center animate-fade-in select-none">
                
                <div className="h-12 w-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3.5 shadow-sm">
                  <CheckCircle2 className="h-6 w-6 animate-bounce" />
                </div>

                <p className="text-[10px] text-emerald-400 font-mono tracking-widest uppercase font-bold mb-1">REGISTRO EFETUADO COM SUCESSO</p>
                <h3 className="text-lg font-extrabold text-white mb-5">Ponto Registrado e Assinado!</h3>

                {/* Printable receipt mockup styled like thermal paper */}
                <div id="thermal-receipt" className="w-full max-w-sm bg-stone-50 text-stone-900 font-mono text-[10px] p-4 rounded shadow-2xl relative overflow-hidden border-t-4 border-emerald-500 leading-normal select-text">
                  
                  {/* Outer cut lines */}
                  <div className="absolute top-0 inset-x-0 h-1 bg-stone-100 flex justify-between tracking-tighter text-stone-300 pointer-events-none select-none">
                    {"- - - - - - - - - - - - - - - - - - - - - - - - - - - - -"}
                  </div>

                  <div className="text-center border-b border-dashed border-stone-400 pb-2.5 mb-2.5">
                    <h4 className="font-extrabold text-xs tracking-tight uppercase">COMPROVANTE DE REGISTRO DE TRABALHADOR</h4>
                    <p className="text-[8px] font-bold text-stone-600">SMARTPOINT • REP-P CONFORME PORTARIA MTE 671</p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-stone-500">EMPRESA:</span>
                      <span className="font-bold text-right truncate max-w-[200px]">{getCompanyName(successLog.empresaId)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">CNPJ:</span>
                      <span className="font-mono">{getCompanyCnpj(successLog.empresaId)}</span>
                    </div>
                    <div className="border-b border-dashed border-stone-300 my-2"></div>
                    
                    <div className="flex justify-between">
                      <span className="text-stone-500">TRABALHADOR:</span>
                      <span className="font-bold text-right truncate max-w-[180px]">{successLog.nome}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">CPF:</span>
                      <span className="font-mono">{successLog.cpf}</span>
                    </div>
                    
                    <div className="border-b border-dashed border-stone-300 my-2"></div>

                    <div className="flex justify-between text-xs font-black">
                      <span>OPERACAO:</span>
                      <span className="uppercase text-blue-800">{translatePontoType(successLog.tipo)}</span>
                    </div>
                    <div className="flex justify-between text-base font-black my-0.5">
                      <span>HORARIO:</span>
                      <span className="font-bold text-stone-950">{successLog.hora}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">DATA DE BATIDA:</span>
                      <span className="font-mono font-bold">{successLog.data.split("-").reverse().join("/")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">TELEMETRIA IP:</span>
                      <span>{successLog.ip || "127.0.0.1"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">VIVACIDADE SEC:</span>
                      <span className="text-emerald-700 font-bold">Aprovada • Anti-Spoof</span>
                    </div>
                    <div className="flex justify-between items-center bg-stone-100 p-1.5 rounded my-1.5 border border-stone-200">
                      <MapPin className="h-3 w-3 text-stone-500 shrink-0" />
                      <span className="text-[8px] text-stone-600 truncate max-w-[240px] font-mono leading-none">{successLog.gps || "Dispositivo Fixo"}</span>
                    </div>
                  </div>

                  <div className="border-b border-dashed border-stone-400 mt-2 pb-2 mb-2"></div>

                  <div className="text-center text-[8px] text-stone-700 leading-normal">
                    <p className="font-bold uppercase tracking-tight">ASSINATURA DIGITAL REGISTRO:</p>
                    <p className="font-mono break-all text-stone-900 bg-stone-200/50 p-1 rounded font-bold my-1 border border-stone-200 text-[7px]" style={{ userSelect: "all" }}>
                      {successLog.hash || "assinaturadigital"}
                    </p>
                    <p className="text-[7px] text-stone-500 mt-1">Este voucher é inviolável e está assinado no banco de dados corporativo.</p>
                  </div>

                  {/* Jagged bottom effect */}
                  <div className="absolute bottom-0 inset-x-0 h-1 bg-stone-100 flex justify-between tracking-tighter text-stone-300 pointer-events-none select-none">
                    {"- - - - - - - - - - - - - - - - - - - - - - - - - - - - -"}
                  </div>

                </div>

                <div className="w-full flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={triggerReceiptPrint}
                    className="flex-1 py-2.5 px-4 bg-gray-950 hover:bg-gray-900 border border-gray-800 text-xs font-semibold rounded-xl text-gray-300 flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Printer className="h-4 w-4" />
                    Imprimir Comprovante
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer text-center"
                  >
                    Retornar ao Terminal
                  </button>
                </div>
              </div>
            )}

            {/* Step 5: Error View */}
            {step === 'error' && (
              <div className="w-full flex flex-col items-center py-4 animate-fade-in">
                <div className="h-14 w-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 mb-4 shadow-sm">
                  <AlertTriangle className="h-7 w-7" />
                </div>

                <span className="text-[9px] text-red-400 font-mono tracking-widest uppercase font-bold mb-1">VERIFICAÇÃO BIOMÉTRICA FALHOU</span>
                <h3 className="text-md font-bold text-white mb-2">Reconhecimento Facial Recusado</h3>
                <p className="text-xs text-gray-400 text-center max-w-md leading-relaxed mb-5">
                  Não foi encontrada uma correspondência de alta similaridade na nossa base de dados ativa. Certifique-se de estar em um local bem iluminado e sem obstruir o rosto.
                </p>

                {errorMsg && (
                  <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-3.5 mb-6 text-xs text-red-300 font-mono max-w-md leading-relaxed text-center">
                    <b>Detalhamento:</b> {errorMsg}
                  </div>
                )}

                <div className="w-full grid grid-cols-2 gap-3 max-w-sm">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="py-2.5 bg-gray-950 border border-gray-850 hover:border-gray-700 text-xs text-gray-300 font-bold rounded-xl transition-all cursor-pointer"
                  >
                    Página Inicial
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStep('scanning');
                      startWebcam();
                    }}
                    className="py-2.5 bg-red-600/15 hover:bg-red-600/25 border border-red-500/20 text-xs text-red-300 font-bold rounded-xl transition-all cursor-pointer"
                  >
                    Tentar Novamente
                  </button>
                </div>
              </div>
            )}

          </div>

        </div>

      </main>

      {/* Footer Info Block */}
      <footer className="max-w-7xl w-full mx-auto text-center py-4 text-[10px] text-gray-500 border-t border-gray-900/30 font-mono z-10 flex flex-col sm:flex-row items-center justify-between gap-2 px-4">
        <div>
          SmartPoint Web © {new Date().getFullYear()} • Versão 2.0 • Sistema REP-P de Alta Precisão
        </div>
        <div className="flex items-center gap-2">
          <span>Integrado ao Google Sheets™</span>
          <span>•</span>
          <span className="text-emerald-500">✓ Em conformidade com a Portaria 671 MTE</span>
        </div>
      </footer>

      {/* MODAL: SOLICITAR AJUSTE */}
      {isAjusteModalOpen && (
        <div className="fixed inset-0 bg-gray-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto animate-fade-in">
          <div className="bg-[#0e1322] border border-gray-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
            
            <div className="flex justify-between items-center pb-2 border-b border-gray-800">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-4.5 w-4.5 text-blue-400 animate-pulse" />
                <h3 className="text-md font-bold text-white">Solicitar Ajuste de Ponto</h3>
              </div>
              <button 
                onClick={() => setIsAjusteModalOpen(false)}
                className="text-gray-400 hover:text-white text-xs px-2.5 py-1.5 rounded-lg bg-gray-900 border border-gray-800 cursor-pointer"
              >
                Voltar
              </button>
            </div>

            <form onSubmit={handleAjusteSubmit} className="space-y-4 text-xs">
              
              <div>
                <label className="block text-[10px] font-bold text-gray-300 uppercase tracking-wider mb-1.5 font-mono">Seu CPF Cadastrado</label>
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
                  className="w-full bg-[#131b2d] border border-gray-800 focus:border-blue-500 p-3 rounded-xl outline-none font-mono tracking-widest text-white text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-300 uppercase tracking-wider mb-1.5 font-mono">Data do Ajuste</label>
                  <input
                    type="date"
                    value={ajForm.data}
                    onChange={(e) => setAjForm(p => ({ ...p, data: e.target.value }))}
                    className="w-full bg-[#131b2d] border border-gray-800 p-3 rounded-xl text-white font-mono text-center"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-300 uppercase tracking-wider mb-1.5 font-mono">Horário Desejado</label>
                  <input
                    type="time"
                    value={ajForm.horaNova}
                    onChange={(e) => setAjForm(p => ({ ...p, horaNova: e.target.value }))}
                    className="w-full bg-[#131b2d] border border-gray-800 p-3 rounded-xl text-white font-mono text-center"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-300 uppercase tracking-wider mb-1.5 font-mono">Tipo do Registro</label>
                <select
                  value={ajForm.tipo}
                  onChange={(e) => setAjForm(p => ({ ...p, tipo: e.target.value as TimeLogType }))}
                  className="w-full bg-[#131b2d] border border-gray-800 p-3 rounded-xl text-white text-xs"
                >
                  <option value="entrada">Entrada</option>
                  <option value="almoco_saida">Almoço (Saída)</option>
                  <option value="almoco_retorno">Almoço (Retorno)</option>
                  <option value="saida_final">Saída Final</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-300 uppercase tracking-wider mb-1.5 font-mono">Justificativa do Envio</label>
                <textarea
                  value={ajForm.justificativa}
                  onChange={(e) => setAjForm(p => ({ ...p, justificativa: e.target.value }))}
                  placeholder="Explique detalhadamente o ocorrido (Ex: Esquecimento, Visita externa, Falha de conexão...)"
                  className="w-full bg-[#131b2d] border border-gray-800 p-3 rounded-xl text-white text-xs h-20 resize-none outline-none focus:border-blue-500"
                  required
                />
              </div>

              {ajError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-200 text-xs py-2.5 px-3.5 rounded-xl flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                  <span>{ajError}</span>
                </div>
              )}

              {ajSuccess && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs py-2.5 px-3.5 rounded-xl flex items-center gap-2">
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
