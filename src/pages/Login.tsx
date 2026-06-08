import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { useNavigate } from "react-router";
import {
  Shield, Mail, Lock, User, ArrowLeft,
  Zap, LogIn, UserCircle
} from "lucide-react";

type AuthView = "login" | "signup" | "verify";

export default function Login() {
  const navigate = useNavigate();
  const [view, setView] = useState<AuthView>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [devCode, setDevCode] = useState("");

  const loginMutation = trpc.emailAuth.login.useMutation({
    onSuccess: (data) => {
      if (data.token) {
        localStorage.setItem("email_auth_token", data.token);
        window.location.href = "/#/dashboard";
      }
    },
    onError: (err) => setError(err.message),
  });

  const signupMutation = trpc.emailAuth.signup.useMutation({
    onSuccess: (data) => {
      setMessage(data.message);
      setDevCode(data.code || "");
      setView("verify");
    },
    onError: (err) => setError(err.message),
  });

  const verifyMutation = trpc.emailAuth.verify.useMutation({
    onSuccess: (data) => {
      if (data.token) {
        localStorage.setItem("email_auth_token", data.token);
        window.location.href = "/#/dashboard";
      }
    },
    onError: (err) => setError(err.message),
  });

  const resendMutation = trpc.emailAuth.resendCode.useMutation({
    onSuccess: (data) => {
      setDevCode(data.code || "");
      setMessage("New code sent!");
    },
    onError: (err) => setError(err.message),
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    loginMutation.mutate({ email, password });
  };

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    signupMutation.mutate({ email, password, name });
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    verifyMutation.mutate({ email, code });
  };

  const handleGoogleLogin = () => {
    setError("Google OAuth requires configuration. Please use email/password signup instead.");
  };

  const continueAsGuest = () => {
    localStorage.setItem("guest_mode", "true");
    navigate("/dashboard");
  };

  const clearAll = () => {
    setError("");
    setMessage("");
    setDevCode("");
    setCode("");
  };

  return (
    <div className="min-h-screen bg-[#050507] flex items-center justify-center px-4">
      <div className="w-full max-w-[400px]">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="font-['Archivo'] font-bold text-white text-2xl tracking-tight inline-flex items-center justify-center">
            VELOCIT
            <span className="relative">
              Y
              <span className="absolute -right-2.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#E85D4E]" />
            </span>
          </div>
          <p className="mt-2 text-sm text-[#6B7280]">Game Without Limits</p>
        </div>

        {/* Card */}
        <div className="bg-[#0A0A0F] border border-[rgba(255,255,255,0.08)] rounded-2xl p-8">
          {/* View: Login */}
          {view === "login" && (
            <>
              <div className="text-center mb-6">
                <h2 className="font-['Archivo'] text-xl text-white mb-1">Welcome Back</h2>
                <p className="text-sm text-[#6B7280]">Sign in to your account</p>
              </div>

              {/* Google Login */}
              <button onClick={handleGoogleLogin}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-[#111118] border border-[rgba(255,255,255,0.1)] rounded-lg text-white text-sm font-medium hover:border-[rgba(255,255,255,0.2)] transition-all cursor-pointer mb-4">
                <svg width="18" height="18" viewBox="0 0 18 18">
                  <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
                  <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.58-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
                  <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
                  <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
                </svg>
                Sign in with Google
              </button>

              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-[rgba(255,255,255,0.08)]" />
                <span className="text-xs text-[#6B7280] uppercase">or</span>
                <div className="flex-1 h-px bg-[rgba(255,255,255,0.08)]" />
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs text-[#6B7280] mb-1.5">Email</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-[#111118] border border-[rgba(255,255,255,0.08)] rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#E85D4E] transition-colors"
                      placeholder="you@example.com" required />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-[#6B7280] mb-1.5">Password</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-[#111118] border border-[rgba(255,255,255,0.08)] rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#E85D4E] transition-colors"
                      placeholder="Enter your password" required />
                  </div>
                </div>
                {error && (
                  <p className="text-xs text-[#E85D4E] bg-[rgba(232,93,78,0.1)] border border-[rgba(232,93,78,0.2)] px-3 py-2 rounded-lg">{error}</p>
                )}
                <button type="submit" disabled={loginMutation.isPending}
                  className="w-full py-2.5 bg-[#E85D4E] text-white rounded-lg text-sm font-medium hover:bg-[#D44A3C] transition-all disabled:opacity-50 cursor-pointer border-0">
                  {loginMutation.isPending ? "Signing in..." : "Sign In"}
                </button>
              </form>

              <div className="mt-5 text-center">
                <p className="text-sm text-[#6B7280]">
                  Don&apos;t have an account?{" "}
                  <button onClick={() => { clearAll(); setView("signup"); }}
                    className="text-[#E85D4E] hover:underline bg-transparent border-0 cursor-pointer">Sign up</button>
                </p>
              </div>

              {/* Continue as Guest */}
              <div className="mt-4 pt-4 border-t border-[rgba(255,255,255,0.08)]">
                <button onClick={continueAsGuest}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-transparent border border-[rgba(255,255,255,0.08)] rounded-lg text-[#9CA3AF] text-sm hover:text-white hover:border-[rgba(255,255,255,0.2)] transition-all cursor-pointer">
                  <UserCircle size={16} />
                  Continue as Guest
                </button>
                <p className="text-center text-[10px] text-[#6B7280] mt-2">
                  Browse servers and test pings. Sign up for a free 3-day trial to connect.
                </p>
              </div>
            </>
          )}

          {/* View: Signup */}
          {view === "signup" && (
            <>
              <button onClick={() => { clearAll(); setView("login"); }}
                className="flex items-center gap-1 text-xs text-[#6B7280] hover:text-white transition-colors mb-4 bg-transparent border-0 cursor-pointer">
                <ArrowLeft size={14} /> Back to sign in
              </button>

              <div className="mb-6">
                <h2 className="font-['Archivo'] text-xl text-white mb-1">Create Account</h2>
                <p className="text-sm text-[#6B7280]">Get your free 3-day trial</p>
              </div>

              {/* Trial info banner */}
              <div className="bg-[rgba(232,93,78,0.08)] border border-[rgba(232,93,78,0.15)] rounded-lg p-3 mb-4 flex items-center gap-2">
                <Zap size={14} className="text-[#E85D4E] shrink-0" />
                <p className="text-xs text-[#D1D5DB]">
                  Sign up and verify your email to instantly get a <strong className="text-white">3-day free trial</strong> with all premium features unlocked.
                </p>
              </div>

              <form onSubmit={handleSignup} className="space-y-4">
                <div>
                  <label className="block text-xs text-[#6B7280] mb-1.5">Name</label>
                  <div className="relative">
                    <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                      className="w-full bg-[#111118] border border-[rgba(255,255,255,0.08)] rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#E85D4E] transition-colors"
                      placeholder="Your name" required />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-[#6B7280] mb-1.5">Email</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-[#111118] border border-[rgba(255,255,255,0.08)] rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#E85D4E] transition-colors"
                      placeholder="you@example.com" required />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-[#6B7280] mb-1.5">Password</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-[#111118] border border-[rgba(255,255,255,0.08)] rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#E85D4E] transition-colors"
                      placeholder="Min 6 characters" required minLength={6} />
                  </div>
                </div>
                {error && (
                  <p className="text-xs text-[#E85D4E] bg-[rgba(232,93,78,0.1)] border border-[rgba(232,93,78,0.2)] px-3 py-2 rounded-lg">{error}</p>
                )}
                <button type="submit" disabled={signupMutation.isPending}
                  className="w-full py-2.5 bg-[#E85D4E] text-white rounded-lg text-sm font-medium hover:bg-[#D44A3C] transition-all disabled:opacity-50 cursor-pointer border-0">
                  {signupMutation.isPending ? "Creating account..." : "Create Account & Start Trial"}
                </button>
              </form>

              <p className="mt-5 text-center text-sm text-[#6B7280]">
                Already have an account?{" "}
                <button onClick={() => { clearAll(); setView("login"); }}
                  className="text-[#E85D4E] hover:underline bg-transparent border-0 cursor-pointer">Sign in</button>
              </p>

              <div className="mt-4 pt-4 border-t border-[rgba(255,255,255,0.08)]">
                <button onClick={continueAsGuest}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-transparent border border-[rgba(255,255,255,0.08)] rounded-lg text-[#9CA3AF] text-sm hover:text-white hover:border-[rgba(255,255,255,0.2)] transition-all cursor-pointer">
                  <UserCircle size={16} />
                  Continue as Guest
                </button>
              </div>
            </>
          )}

          {/* View: Verify */}
          {view === "verify" && (
            <>
              <div className="text-center mb-6">
                <div className="w-12 h-12 rounded-full bg-[rgba(232,93,78,0.1)] flex items-center justify-center mx-auto mb-3">
                  <Zap size={20} className="text-[#E85D4E]" />
                </div>
                <h2 className="font-['Archivo'] text-xl text-white mb-1">Verify Your Email</h2>
                <p className="text-sm text-[#6B7280]">
                  Enter the 6-digit code sent to <span className="text-white">{email}</span>
                </p>
              </div>

              {devCode && (
                <div className="mb-4 bg-[rgba(74,222,128,0.1)] border border-[rgba(74,222,128,0.2)] rounded-lg p-3 text-center">
                  <p className="text-xs text-[#4ADE80]">Your verification code is:</p>
                  <p className="text-2xl font-['JetBrains_Mono'] font-bold text-[#4ADE80] tracking-[0.2em]">{devCode}</p>
                  <p className="text-[10px] text-[#4ADE80] opacity-60 mt-1">(In production this would be sent via email)</p>
                </div>
              )}

              <form onSubmit={handleVerify} className="space-y-4">
                <div>
                  <label className="block text-xs text-[#6B7280] mb-1.5">Verification Code</label>
                  <input type="text" value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="w-full bg-[#111118] border border-[rgba(255,255,255,0.08)] rounded-lg px-4 py-2.5 text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#E85D4E] transition-colors text-center font-['JetBrains_Mono'] text-lg tracking-[0.3em]"
                    placeholder="000000" maxLength={6} required />
                </div>
                {error && (
                  <p className="text-xs text-[#E85D4E] bg-[rgba(232,93,78,0.1)] border border-[rgba(232,93,78,0.2)] px-3 py-2 rounded-lg">{error}</p>
                )}
                {message && (
                  <p className="text-xs text-[#4ADE80] bg-[rgba(74,222,128,0.1)] border border-[rgba(74,222,128,0.2)] px-3 py-2 rounded-lg">{message}</p>
                )}
                <button type="submit" disabled={verifyMutation.isPending}
                  className="w-full py-2.5 bg-[#E85D4E] text-white rounded-lg text-sm font-medium hover:bg-[#D44A3C] transition-all disabled:opacity-50 cursor-pointer border-0">
                  {verifyMutation.isPending ? "Verifying..." : "Verify & Start Trial"}
                </button>
                <button type="button" onClick={() => { setError(""); resendMutation.mutate({ email }); }}
                  disabled={resendMutation.isPending}
                  className="w-full py-2 bg-transparent text-[#9CA3AF] rounded-lg text-sm hover:text-white transition-colors cursor-pointer border border-[rgba(255,255,255,0.08)]">
                  {resendMutation.isPending ? "Sending..." : "Resend Code"}
                </button>
              </form>

              <div className="mt-4 pt-4 border-t border-[rgba(255,255,255,0.08)]">
                <button onClick={continueAsGuest}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-transparent border border-[rgba(255,255,255,0.08)] rounded-lg text-[#9CA3AF] text-sm hover:text-white hover:border-[rgba(255,255,255,0.2)] transition-all cursor-pointer">
                  <UserCircle size={16} />
                  Continue as Guest
                </button>
              </div>
            </>
          )}
        </div>

        {/* Security badge */}
        <div className="flex items-center justify-center gap-2 mt-6 text-[#6B7280]">
          <Shield size={14} />
          <span className="text-xs">Secure authentication</span>
        </div>
      </div>
    </div>
  );
}
