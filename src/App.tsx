import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router";
import LandingPage from "@/pages/LandingPage";
import NotFound from "@/pages/NotFound";

// Lazy load secondary pages for faster initial load
const Pricing = lazy(() => import("@/pages/Pricing"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Login = lazy(() => import("@/pages/Login"));

function App() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#050507]" />}>
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
