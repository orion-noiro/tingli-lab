"use client";

import React, { useState } from "react";
import { Check, LogIn, LogOut, Shield, Sparkles, UserPlus, X } from "lucide-react";
import { AuthUser, UserProfile } from "@/types/phonetics";

interface HanlinAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthUser | null;
  localProfile: UserProfile;
  scholarsList: AuthUser[];
  onAuthSuccess: (user: AuthUser, restoredProfile?: UserProfile | null) => void;
  onLogout: () => void;
}

export default function HanlinAuthModal({
  isOpen,
  onClose,
  currentUser,
  localProfile,
  scholarsList,
  onAuthSuccess,
  onLogout,
}: HanlinAuthModalProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [migrateLocal, setMigrateLocal] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const payload =
        mode === "login"
          ? { username, password }
          : {
              username,
              displayName: displayName || username,
              password,
              migratedProfile: migrateLocal ? localProfile : undefined,
            };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Falha na autenticação.");
      } else if (data.user) {
        onAuthSuccess(data.user, data.profileJson || null);
        onClose();
      }
    } catch (err) {
      setError(`Erro de conexão: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickScholarLogin = async (scholarUsername: string) => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: scholarUsername, password: "hanlin123" }),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        onAuthSuccess(data.user, data.profileJson || null);
        onClose();
      } else {
        setUsername(scholarUsername);
        setMode("login");
        setError("Digite a senha desta conta para entrar.");
      }
    } catch {
      setError("Erro ao alternar conta.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-xuan-bg border-2 border-xuan-border rounded-xl max-w-lg w-full p-6 shadow-xl space-y-5 text-xuan-ink">
        {/* Cabeçalho estilo Registro da Academia Imperial (翰林院) */}
        <div className="flex items-start justify-between border-b border-xuan-border pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-lg imperial-seal flex items-center justify-center font-serif font-bold text-lg bg-[#9E2A2B]/10">
              翰林
            </div>
            <div>
              <h2 className="font-serif text-lg font-bold tracking-wide">
                Passaporte da Academia Imperial · 翰林院
              </h2>
              <p className="text-xs text-xuan-muted">
                Autenticação SQLite persistente para Duelos Síncronos, Fantasmas e Exames 科举
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg border border-xuan-border hover:bg-xuan-subtle text-xuan-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Conta Ativa Atual */}
        {currentUser && (
          <div className="p-3.5 rounded-lg bg-xuan-card border border-xuan-border flex items-center justify-between">
            <div>
              <div className="text-xs text-xuan-muted">Erudito Autenticado:</div>
              <div className="font-serif font-bold text-sm">
                {currentUser.displayName}{" "}
                <span className="text-xs font-normal text-[#9E2A2B]">
                  [{currentUser.scholarRank} · ELO {currentUser.eloRating}]
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="px-3 py-1.5 rounded-lg border border-[#9E2A2B]/40 text-[#9E2A2B] hover:bg-[#9E2A2B] hover:text-[#F5F2E9] text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sair
            </button>
          </div>
        )}

        {/* Abas Entrar / Criar Conta */}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-xuan-card border border-xuan-border">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError(null);
            }}
            className={`py-2 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition ${
              mode === "login"
                ? "bg-[#9E2A2B] text-[#F5F2E9]"
                : "text-xuan-muted hover:text-xuan-ink"
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            Entrar com Senha
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("register");
              setError(null);
            }}
            className={`py-2 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition ${
              mode === "register"
                ? "bg-[#9E2A2B] text-[#F5F2E9]"
                : "text-xuan-muted hover:text-xuan-ink"
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            Registrar Nova Conta
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-xuan-muted mb-1">
              Usuário (Login único, sem espaços):
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ex.: lucas_chen"
              className="w-full px-3.5 py-2 rounded-lg bg-xuan-card border border-xuan-border text-sm text-xuan-ink focus:outline-none focus:border-[#9E2A2B]"
            />
          </div>

          {mode === "register" && (
            <div>
              <label className="block text-xs font-semibold text-xuan-muted mb-1">
                Nome de Exibição / Título Acadêmico:
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="ex.: Lucas · 卢卡斯"
                className="w-full px-3.5 py-2 rounded-lg bg-xuan-card border border-xuan-border text-sm text-xuan-ink focus:outline-none focus:border-[#9E2A2B]"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-xuan-muted mb-1">
              Senha Secreta:
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2 rounded-lg bg-xuan-card border border-xuan-border text-sm text-xuan-ink focus:outline-none focus:border-[#9E2A2B]"
            />
          </div>

          {mode === "register" && (
            <label className="flex items-center gap-2 text-xs text-xuan-muted cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={migrateLocal}
                onChange={(e) => setMigrateLocal(e.target.checked)}
                className="accent-[#9E2A2B]"
              />
              <span>
                Importar meu progresso local atual ({localProfile.xp} XP e cartões FSRS) para esta conta
              </span>
            </label>
          )}

          {error && (
            <div className="p-2.5 rounded-lg bg-[#9E2A2B]/10 border border-[#9E2A2B]/40 text-xs text-[#9E2A2B] font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-[#9E2A2B] hover:bg-[#7D2021] text-[#F5F2E9] font-serif font-bold text-sm transition flex items-center justify-center gap-2"
          >
            <Shield className="w-4 h-4" />
            {loading
              ? "Autenticando no Registro Imperial..."
              : mode === "login"
              ? "Autenticar Passaporte Hànlín"
              : "Inscrever Erudito & Salvar no SQLite"}
          </button>
        </form>

        {/* Troca Rápida de Erudito (Para Testes & Amigos Locais) */}
        {scholarsList.length > 0 && (
          <div className="pt-3 border-t border-xuan-border space-y-2">
            <div className="text-[11px] font-semibold text-xuan-muted flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#9C7A3C]" />
              Troca Rápida de Conta (Membros da Academia / Amigos):
            </div>
            <div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto">
              {scholarsList.slice(0, 6).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleQuickScholarLogin(s.username)}
                  className="px-2.5 py-1.5 rounded-md bg-xuan-card hover:bg-xuan-subtle border border-xuan-border text-left text-xs flex items-center justify-between transition"
                >
                  <span className="truncate font-medium">{s.displayName}</span>
                  <span className="text-[10px] text-[#9C7A3C] font-mono shrink-0 ml-1">
                    {s.eloRating}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
