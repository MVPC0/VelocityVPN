import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router";
import LandingPage from "@/pages/LandingPage";
import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";

// Lazy load heavy pages to keep initial bundle small
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Pricing = lazy(() => import("@/pages/Pricing"));

function App() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#050507] flex items-center justify-center text-[#6B7280]">Loading...</div>}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

export default App;
