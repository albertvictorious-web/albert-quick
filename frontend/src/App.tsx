import { Routes, Route } from "react-router-dom";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Leads from "@/pages/Leads";
import MarketingAccounts from "@/pages/MarketingAccounts";
import TransferHistory from "@/pages/TransferHistory";
import RekapBulananPage from "@/pages/RekapBulananPage";
import CatatanPage from "@/pages/CatatanPage";
import JadwalProspek from "@/pages/JadwalProspek";
import GantiPasswordPage from "@/pages/GantiPasswordPage";
import { Toaster } from "@/components/ui/sonner";

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  return (
    <>
      <Toaster position="top-right" richColors />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Dashboard />} />
        <Route path="/leads" element={<Leads />} />
        <Route path="/jadwal-prospek" element={<JadwalProspek />} />
        <Route path="/catatan" element={<CatatanPage />} />
        <Route path="/akun-marketing" element={<MarketingAccounts />} />
        <Route path="/rekap-bulanan" element={<RekapBulananPage />} />
        <Route path="/riwayat-perpindahan" element={<TransferHistory />} />
        <Route path="/ganti-password" element={<GantiPasswordPage />} />
      </Routes>
    </>
  );
}
