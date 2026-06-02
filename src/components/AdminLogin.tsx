import React, { useState } from "react";
import { Lock, User, ArrowLeft, RefreshCw, AlertCircle, ShieldAlert } from "lucide-react";

interface AdminLoginProps {
  onLoginSuccess: () => void;
  onBackToTerminal: () => void;
}

export default function AdminLogin({ onLoginSuccess, onBackToTerminal }: AdminLoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    // Simulate authentic standard system login delay
    setTimeout(() => {
      if (username === "admin" && password === "123456") {
        onLoginSuccess();
      } else {
        setErrorMsg("Credenciais inválidas. Utilize Usuário: 'admin' e Senha: '123456' para homologação.");
        setLoading(false);
      }
    }, 1200);
  };

  return (
    <div className="w-full min-h-screen bg-[#0b0f19] text-gray-100 flex flex-col justify-center items-center p-4 relative font-sans">
      
      {/* Background decorations */}
      <div className="absolute top-[25%] left-[25%] w-[400px] h-[400px] rounded-full bg-blue-500/5 blur-[120px] pointer-events-none"></div>
      
      <div className="w-full max-w-md bg-gray-900/65 border border-gray-800/80 rounded-2xl p-6 shadow-2xl backdrop-blur-md relative">
        
        {/* Back navigation */}
        <button 
          onClick={onBackToTerminal}
          className="hover:text-white text-gray-400 absolute top-5 left-5 text-xs flex items-center gap-1.5 transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao Terminal
        </button>

        <div className="text-center mt-6 mb-8">
          <div className="h-12 w-12 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-3 text-blue-400 shadow-inner">
            <Lock className="h-5 w-5" />
          </div>
          <h2 className="text-xl font-black text-white">SmartPoint Admin</h2>
          <p className="text-xs text-gray-400 mt-1">Acesse as configurações do sistema de ponto eletrônico</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Usuário Administrativo
            </label>
            <div className="relative">
              <User className="h-4 w-4 text-gray-500 absolute left-3 top-3.5" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                disabled={loading}
                className="w-full bg-[#131b2d] border border-gray-850 focus:border-blue-500 text-sm text-white rounded-xl py-3 pl-10 pr-4 outline-none transition-all focus:ring-1 focus:ring-blue-500/20 placeholder:text-gray-650"
                required
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Senha de Acesso
              </label>
            </div>
            <div className="relative">
              <Lock className="h-4 w-4 text-gray-500 absolute left-3 top-3.5" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                disabled={loading}
                className="w-full bg-[#131b2d] border border-gray-850 focus:border-blue-500 text-sm text-white rounded-xl py-3 pl-10 pr-4 outline-none transition-all focus:ring-1 focus:ring-blue-500/20 placeholder:text-gray-650"
                required
              />
            </div>
          </div>

          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-300 text-xs py-2.5 px-3.5 rounded-xl flex items-center gap-2">
              <AlertCircle className="h-4.5 w-4.5 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm py-3 px-4 rounded-xl transition-all shadow-md shadow-blue-500/10 active:scale-[0.99] flex items-center justify-center gap-2"
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              "Confirmar Login"
            )}
          </button>
        </form>

        {/* Demo Credentials Hint */}
        <div className="mt-6 p-3 rounded-lg bg-blue-500/5 border border-blue-500/10 text-[10px] text-blue-400/80 flex items-start gap-2.5">
          <ShieldAlert className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-blue-300">Homologação de Testes</p>
            <p className="mt-0.5 font-mono">
              Usuário default: <b>admin</b><br />
              Senha default: <b>123456</b>
            </p>
          </div>
        </div>

      </div>

    </div>
  );
}
