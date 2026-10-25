import { useNavigate } from "react-router";
import { ArrowLeft, UserCircle, Info } from "lucide-react";

// Email sign-in and sign-up need the app backend (/api/trpc), which isn't deployed
// on the static Netlify site. Until it is, this page offers guest mode only.
export default function Login() {
  const navigate = useNavigate();

  const continueAsGuest = () => {
    try { localStorage.setItem("guest_mode", "true"); } catch { /* storage blocked: guest mode still works */ }
    navigate("/dashboard");
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
          <p className="mt-2 text-sm text-[#6B7280]">BYO WireGuard dashboard</p>
        </div>

        {/* Card */}
        <div className="bg-[#0A0A0F] border border-[rgba(255,255,255,0.08)] rounded-2xl p-8" data-testid="signin-unavailable">
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-full bg-[rgba(163,184,212,0.1)] flex items-center justify-center mx-auto mb-3">
              <Info size={22} className="text-[#A3B8D4]" />
            </div>
            <h2 className="font-['Archivo'] text-xl text-white mb-1">Email sign-in unavailable</h2>
            <p className="text-sm text-[#6B7280]">
              Accounts aren&apos;t available right now, so there&apos;s no email sign-in or sign-up.
              Everything works in guest mode. Your provider details stay in this browser.
            </p>
          </div>

          <button onClick={continueAsGuest}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#E85D4E] text-white rounded-lg text-sm font-medium hover:bg-[#D44A3C] transition-all cursor-pointer border-0">
            <UserCircle size={16} />
            Continue as Guest
          </button>
        </div>

        <button onClick={() => navigate("/")}
          className="mt-6 mx-auto flex items-center gap-2 text-sm text-[#6B7280] hover:text-white transition-colors cursor-pointer bg-transparent border-0">
          <ArrowLeft size={14} /> Back to home
        </button>
      </div>
    </div>
  );
}
