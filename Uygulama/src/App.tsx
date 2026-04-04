import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard, Ticket, Users, ScanLine, Plus, Search, CheckCircle2,
  XCircle, AlertCircle, Download, Trash2, Calendar, LogOut, ChevronRight,
  Loader2, History, Lock, ArrowRight, User as UserIcon, QrCode, Megaphone,
  Power, PowerOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, addDays, isAfter, parseISO } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { QRCodeSVG } from 'qrcode.react';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Types
interface Agency {
  id: string;
  name: string;
  contact: string;
  createdAt: string;
}

interface Campaign {
  id: string;
  name: string;
  agencyId: string;
  agencyName?: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt: string;
}

interface AccessCode {
  id: string;
  code: string;
  agencyId: string;
  campaignId: string;
  agencyName?: string;
  campaignName?: string;
  expirationDate: string;
  usedAt?: string;
  createdAt: string;
  status: 'active' | 'used' | 'expired';
}

// Components
const SidebarItem = ({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all duration-200",
      active ? "bg-stone-800 text-stone-100 shadow-lg" : "text-stone-500 hover:bg-stone-100 hover:text-stone-800"
    )}
  >
    <Icon size={20} />
    <span className="font-medium">{label}</span>
    {active && <motion.div layoutId="active-pill" className="ml-auto w-1.5 h-1.5 rounded-full bg-stone-100" />}
  </button>
);

const Card = ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden", className)} {...props}>
    {children}
  </div>
);

const Button = ({ variant = 'primary', className, loading, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'success', loading?: boolean }) => {
  const variants = {
    primary: "bg-stone-900 text-white hover:bg-stone-800",
    secondary: "bg-stone-100 text-stone-900 hover:bg-stone-200",
    outline: "border border-stone-200 text-stone-700 hover:bg-stone-50",
    danger: "bg-red-50 text-red-600 hover:bg-red-100 border border-red-100",
    success: "bg-green-600 text-white hover:bg-green-700"
  };
  return (
    <button
      className={cn("px-4 py-2 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed", variants[variant], className)}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? <Loader2 className="animate-spin" size={18} /> : children}
    </button>
  );
};

const Input = ({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) => (
  <div className="space-y-1.5 w-full">
    {label && <label className="text-sm font-medium text-stone-700">{label}</label>}
    <input
      className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:ring-2 focus:ring-stone-900 focus:border-transparent outline-none transition-all placeholder:text-stone-400 disabled:bg-stone-50 disabled:text-stone-500"
      {...props}
    />
  </div>
);

// Main App
export default function App() {
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'agencies' | 'campaigns' | 'generate' | 'validate' | 'reports'>('dashboard');
  const [loading, setLoading] = useState(false);

  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [recentCodes, setRecentCodes] = useState<AccessCode[]>([]);
  const [stats, setStats] = useState({ total: 0, used: 0, active: 0 });

  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    const storedUser = localStorage.getItem('museum_user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      if (parsedUser.role === 'sales') {
        setActiveTab('validate');
      }
    }
  }, []);

  const fetchData = async () => {
    if (!user) return;
    try {
      const [agRes, cmpRes, codeRes] = await Promise.all([
        fetch('/api/agencies'),
        fetch('/api/campaigns'),
        fetch('/api/codes')
      ]);

      if (agRes.ok) setAgencies(await agRes.json());
      if (cmpRes.ok) setCampaigns(await cmpRes.json());
      if (codeRes.ok) {
        const data = await codeRes.json();
        setRecentCodes(data);
        setStats({
          total: data.length,
          used: data.filter((c: any) => c.status === 'used').length,
          active: data.filter((c: any) => c.status === 'active').length
        });
      }
    } catch (err) {
      console.error('Fetch data error:', err);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData)
      });
      const data = await res.json();
      if (data.success) {
        setUser(data.user);
        localStorage.setItem('museum_user', JSON.stringify(data.user));
        if (data.user.role === 'sales') {
          setActiveTab('validate');
        } else {
          setActiveTab('dashboard');
        }
      } else {
        setLoginError(data.error || 'Giriş başarısız');
      }
    } catch (err) {
      setLoginError('Bağlantı hatası');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('museum_user');
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md w-full space-y-8">
          <div className="text-center space-y-2">
            <div className="w-20 h-20 bg-stone-900 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl">
              <QrCode className="text-white" size={40} />
            </div>
            <h1 className="text-4xl font-bold text-stone-900 tracking-tight">Museum Portal</h1>
            <p className="text-stone-500">Giriş Yönetim Sistemi</p>
          </div>

          <Card className="p-8">
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-4">
                <Input label="Kullanıcı Adı" type="text" required placeholder="Kullanıcı adınız" value={loginData.username} onChange={(e) => setLoginData({ ...loginData, username: e.target.value })} />
                <Input label="Şifre" type="password" required placeholder="••••••••" value={loginData.password} onChange={(e) => setLoginData({ ...loginData, password: e.target.value })} />
              </div>
              {loginError && (
                <div className="p-3 rounded-xl bg-red-50 text-red-600 text-sm flex items-center gap-2 border border-red-100">
                  <AlertCircle size={16} />{loginError}
                </div>
              )}
              <Button type="submit" className="w-full py-4 text-lg" loading={loading}>
                Giriş Yap <ArrowRight size={20} />
              </Button>
            </form>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Sales Role UI
  if (user.role === 'sales') {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col">
        <header className="bg-white border-b border-stone-200 p-4 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-stone-900 rounded-xl flex items-center justify-center shadow-lg">
              <Ticket className="text-white" size={20} />
            </div>
            <span className="font-bold text-xl tracking-tight text-stone-900">Gişe Doğrulama</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-stone-900">{user.username}</p>
              <p className="text-xs text-stone-500 capitalize">{user.role}</p>
            </div>
            <Button variant="outline" onClick={handleLogout} className="text-red-600 border-red-100 hover:bg-red-50">
              <LogOut size={16} /> Çıkış
            </Button>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-10 overflow-y-auto">
          <CodeValidator />
        </main>
      </div>
    );
  }

  // Admin Role UI
  return (
    <div className="min-h-screen bg-stone-50 flex">
      <aside className="w-72 bg-white border-r border-stone-200 flex flex-col p-6 sticky top-0 h-screen">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-10 h-10 bg-stone-900 rounded-xl flex items-center justify-center shadow-lg">
            <Ticket className="text-white" size={20} />
          </div>
          <span className="font-bold text-xl tracking-tight text-stone-900">Museum.</span>
        </div>

        <nav className="flex-1 space-y-2">
          <SidebarItem icon={LayoutDashboard} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <SidebarItem icon={Users} label="Acentalar" active={activeTab === 'agencies'} onClick={() => setActiveTab('agencies')} />
          <SidebarItem icon={Megaphone} label="Kampanyalar" active={activeTab === 'campaigns'} onClick={() => setActiveTab('campaigns')} />
          <SidebarItem icon={Plus} label="Kod Üret" active={activeTab === 'generate'} onClick={() => setActiveTab('generate')} />
          <SidebarItem icon={ScanLine} label="Doğrulama (Test)" active={activeTab === 'validate'} onClick={() => setActiveTab('validate')} />
          <SidebarItem icon={History} label="Raporlar" active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} />
        </nav>

        <div className="mt-auto pt-6 border-t border-stone-100">
          <div className="flex items-center gap-3 px-2 mb-4">
            <div className="w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center border border-stone-200">
              <UserIcon size={20} className="text-stone-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-stone-900 truncate">{user.username}</p>
              <p className="text-xs text-stone-500 truncate capitalize">{user.role}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 text-stone-500 hover:text-red-600 transition-colors px-2 text-sm font-medium">
            <LogOut size={16} /> Çıkış Yap
          </button>
        </div>
      </aside>

      <main className="flex-1 p-10 overflow-y-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && <Dashboard stats={stats} recentCodes={recentCodes} agencies={agencies} onViewAll={() => setActiveTab('reports')} onOpenValidator={() => setActiveTab('validate')} />}
          {activeTab === 'agencies' && <AgencyManager agencies={agencies} onRefresh={fetchData} />}
          {activeTab === 'campaigns' && <CampaignManager campaigns={campaigns} agencies={agencies} onRefresh={fetchData} />}
          {activeTab === 'generate' && <CodeGenerator campaigns={campaigns} onRefresh={fetchData} />}
          {activeTab === 'validate' && <CodeValidator />}
          {activeTab === 'reports' && <Reports codes={recentCodes} campaigns={campaigns} agencies={agencies} />}
        </AnimatePresence>
      </main>
    </div>
  );
}

// --- Tab Components ---

function Dashboard({ stats, recentCodes, agencies, onViewAll, onOpenValidator }: { stats: any, recentCodes: AccessCode[], agencies: Agency[], onViewAll: () => void, onOpenValidator: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-8">
      <header>
        <h2 className="text-3xl font-bold text-stone-900">Genel Bakış</h2>
        <p className="text-stone-500">Müze yönetim paneline hoş geldiniz.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Ticket size={24} /></div>
            <span className="text-xs font-medium text-stone-400">Toplam Kod</span>
          </div>
          <p className="text-4xl font-bold text-stone-900">{stats.total}</p>
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-green-50 text-green-600 rounded-lg"><CheckCircle2 size={24} /></div>
            <span className="text-xs font-medium text-stone-400">Kullanılan</span>
          </div>
          <p className="text-4xl font-bold text-stone-900">{stats.used}</p>
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><AlertCircle size={24} /></div>
            <span className="text-xs font-medium text-stone-400">Aktif Kodlar</span>
          </div>
          <p className="text-4xl font-bold text-stone-900">{stats.active}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <div className="p-6 border-b border-stone-100 flex items-center justify-between">
            <h3 className="font-bold text-stone-900">Son Aktiviteler</h3>
            <Button variant="outline" className="text-xs py-1 h-8" onClick={onViewAll}>Tümünü Gör</Button>
          </div>
          <div className="divide-y divide-stone-100">
            {recentCodes.slice(0, 5).map(code => (
              <div key={code.id} className="p-4 flex items-center gap-4 hover:bg-stone-50 transition-colors">
                <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", code.status === 'used' ? "bg-green-50 text-green-600" : "bg-blue-50 text-blue-600")}>
                  {code.status === 'used' ? <CheckCircle2 size={18} /> : <Ticket size={18} />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-stone-900">{code.code}</p>
                  <p className="text-xs text-stone-500">{code.campaignName || code.agencyName}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-stone-900">{code.status === 'used' ? 'Kullanıldı' : 'Üretildi'}</p>
                  <p className="text-[10px] text-stone-400">{format(parseISO(code.usedAt || code.createdAt), 'dd.MM.yyyy HH:mm')}</p>
                </div>
              </div>
            ))}
            {recentCodes.length === 0 && <div className="p-10 text-center text-stone-400 italic">Henüz aktivite yok</div>}
          </div>
        </Card>

        <Card className="p-8 flex flex-col items-center justify-center text-center space-y-4 bg-stone-900 text-white border-none">
          <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-2">
            <ScanLine size={32} className="text-white" />
          </div>
          <h3 className="text-xl font-bold">Tarama Yapmaya Hazır mısınız?</h3>
          <p className="text-stone-400 text-sm max-w-xs">Gişe personeli arayüzünü test etmek için doğrulama panelini açın.</p>
          <Button variant="secondary" className="w-full mt-4" onClick={onOpenValidator}>Doğrulama Ekranını Aç</Button>
        </Card>
      </div>
    </motion.div>
  );
}

function AgencyManager({ agencies, onRefresh }: { agencies: Agency[], onRefresh: () => void }) {
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/agencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, contact })
      });
      if (res.ok) {
        setName(''); setContact(''); setIsAdding(false);
        onRefresh();
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-stone-900">Acentalar</h2>
          <p className="text-stone-500">Turizm acentası partnerlerinizi yönetin.</p>
        </div>
        <Button onClick={() => setIsAdding(true)}><Plus size={20} /> Yeni Acenta</Button>
      </header>

      <AnimatePresence>
        {isAdding && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <Card className="p-6 bg-stone-50 border-stone-200">
              <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <Input label="Acenta Adı" value={name} onChange={e => setName(e.target.value)} required />
                <Input label="İletişim Bilgisi" value={contact} onChange={e => setContact(e.target.value)} required />
                <div className="flex gap-2">
                  <Button type="submit" loading={loading} className="flex-1">Kaydet</Button>
                  <Button type="button" variant="outline" onClick={() => setIsAdding(false)}>İptal</Button>
                </div>
              </form>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {agencies.map(agency => (
          <Card key={agency.id} className="p-6 hover:border-stone-400 transition-colors">
            <div className="w-12 h-12 bg-stone-100 rounded-xl flex items-center justify-center text-stone-600 font-bold text-xl mb-4">
              {agency.name.charAt(0)}
            </div>
            <h3 className="font-bold text-lg text-stone-900">{agency.name}</h3>
            <p className="text-sm text-stone-500 mb-4">{agency.contact}</p>
          </Card>
        ))}
      </div>
    </motion.div>
  );
}

function CampaignManager({ campaigns, agencies, onRefresh }: { campaigns: Campaign[], agencies: Agency[], onRefresh: () => void }) {
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({ name: '', agencyId: '', startDate: '', endDate: '' });
  const [loading, setLoading] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setFormData({ name: '', agencyId: '', startDate: '', endDate: '' });
        setIsAdding(false);
        onRefresh();
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      await fetch(`/api/campaigns/${id}/toggle`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus })
      });
      onRefresh();
    } catch (err) { console.error(err); }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-stone-900">Kampanyalar</h2>
          <p className="text-stone-500">Kod üretim kampanyalarını ve geçerlilik tarihlerini yönetin.</p>
        </div>
        <Button onClick={() => setIsAdding(true)}><Plus size={20} /> Yeni Kampanya</Button>
      </header>

      <AnimatePresence>
        {isAdding && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <Card className="p-6 bg-stone-50 border-stone-200">
              <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Kampanya Adı" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                <div className="space-y-1.5 w-full">
                  <label className="text-sm font-medium text-stone-700">Acenta (Firma)</label>
                  <select required className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:ring-2 focus:ring-stone-900 outline-none bg-white"
                    value={formData.agencyId} onChange={e => setFormData({ ...formData, agencyId: e.target.value })}>
                    <option value="">Acenta Seçin...</option>
                    {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <Input label="Başlangıç Tarihi" type="date" value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} required />
                <Input label="Bitiş Tarihi" type="date" value={formData.endDate} onChange={e => setFormData({ ...formData, endDate: e.target.value })} required />
                <div className="col-span-full flex gap-2 justify-end mt-2">
                  <Button type="button" variant="outline" onClick={() => setIsAdding(false)}>İptal</Button>
                  <Button type="submit" loading={loading}>Kampanyayı Başlat</Button>
                </div>
              </form>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {campaigns.map(cmp => (
          <Card key={cmp.id} className={cn("p-6 transition-colors", !cmp.isActive && "opacity-60 bg-stone-50")}>
            <div className="flex items-start justify-between mb-4">
              <div className={cn("px-3 py-1 text-xs font-bold uppercase rounded-full", cmp.isActive ? "bg-green-100 text-green-700" : "bg-stone-200 text-stone-600")}>
                {cmp.isActive ? 'Aktif' : 'Pasif'}
              </div>
              <button onClick={() => toggleStatus(cmp.id, cmp.isActive)} className={cn("p-2 rounded-lg transition-colors", cmp.isActive ? "text-red-600 hover:bg-red-50" : "text-green-600 hover:bg-green-50")} title={cmp.isActive ? "Pasife Al" : "Aktifleştir"}>
                {cmp.isActive ? <PowerOff size={18} /> : <Power size={18} />}
              </button>
            </div>
            <h3 className="font-bold text-xl text-stone-900">{cmp.name}</h3>
            <p className="text-sm font-medium text-stone-600 mb-4">{cmp.agencyName}</p>

            <div className="space-y-2 pt-4 border-t border-stone-100">
              <div className="flex justify-between text-xs">
                <span className="text-stone-500">Başlangıç:</span>
                <span className="font-medium text-stone-900">{format(parseISO(cmp.startDate), 'dd.MM.yyyy')}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-stone-500">Bitiş:</span>
                <span className="font-medium text-stone-900">{format(parseISO(cmp.endDate), 'dd.MM.yyyy')}</span>
              </div>
            </div>
          </Card>
        ))}
        {campaigns.length === 0 && <div className="col-span-full p-10 text-center text-stone-500">Henüz kampanya bulunmuyor.</div>}
      </div>
    </motion.div>
  );
}

function CodeGenerator({ campaigns, onRefresh }: { campaigns: Campaign[], onRefresh: () => void }) {
  const activeCampaigns = campaigns.filter(c => c.isActive);
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [prefix, setPrefix] = useState('');
  const [randomLength, setRandomLength] = useState(5);
  const [count, setCount] = useState(100);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const generateRandomCode = (prefixStr: string, length: number) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = prefixStr;
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const generateBulk = async () => {
    const cmp = campaigns.find(c => c.id.toString() === selectedCampaign);
    if (!cmp) return setError('Lütfen bir kampanya seçin.');
    if (count <= 0 || count > 100000) return setError('Lütfen 1 ile 100.000 arasında bir miktar girin.');
    if (randomLength < 3) return setError('Güvenlik için rastgele karakter sayısı en az 3 olmalıdır.');

    setLoading(true); setError(null); setGeneratedCodes([]); setProgress(0);

    const CHUNK_SIZE = 5000;
    const totalChunks = Math.ceil(count / CHUNK_SIZE);
    const allGeneratedCodes: string[] = [];

    try {
      for (let c = 0; c < totalChunks; c++) {
        const currentChunkSize = Math.min(CHUNK_SIZE, count - (c * CHUNK_SIZE));
        const chunkCodes: string[] = [];

        for (let i = 0; i < currentChunkSize; i++) {
          const codeStr = generateRandomCode(prefix.toUpperCase(), randomLength);
          chunkCodes.push(codeStr);
          allGeneratedCodes.push(codeStr);
        }

        const res = await fetch('/api/codes/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            codes: chunkCodes,
            agencyId: cmp.agencyId,
            campaignId: cmp.id,
            expirationDate: cmp.endDate
          })
        });

        if (!res.ok) throw new Error('Sunucu hatası: Kodlar kaydedilemedi.');
        setProgress(Math.round(((c + 1) / totalChunks) * 100));
      }
      setGeneratedCodes(allGeneratedCodes);
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Kodlar üretilirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = () => {
    const cmp = campaigns.find(c => c.id.toString() === selectedCampaign);
    const header = "Code,Campaign,Agency,Expiration\n";
    const rows = generatedCodes.map(c => `${c},${cmp?.name},${cmp?.agencyName},${format(parseISO(cmp!.endDate), 'dd.MM.yyyy')}`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kodlar-${cmp?.name}.csv`;
    a.click();
  };

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="max-w-4xl mx-auto space-y-8">
      <header className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-stone-900">Şablonlu Kod Üretimi</h2>
        <p className="text-stone-500">Kampanyaya özel, belirlediğiniz şablonda kodlar üretin.</p>
      </header>

      <Card className="p-8">
        <div className="space-y-6">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-stone-700">Kampanya Seçin</label>
            <select className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:ring-2 focus:ring-stone-900 outline-none bg-white"
              value={selectedCampaign} onChange={e => { setSelectedCampaign(e.target.value); setError(null); }}>
              <option value="">Aktif bir kampanya seçin...</option>
              {activeCampaigns.map(c => <option key={c.id} value={c.id}>{c.name} ({c.agencyName})</option>)}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-stone-50 rounded-xl border border-stone-200">
            <div className="space-y-4">
              <Input label="Sabit Başlangıç (Örnek: YAZ26-)" placeholder="İsteğe bağlı" value={prefix} onChange={e => setPrefix(e.target.value.toUpperCase())} />
              <Input label="Rastgele Karakter Sayısı" type="number" min="3" max="15" value={randomLength} onChange={e => setRandomLength(parseInt(e.target.value) || 5)} />
            </div>
            <div className="flex flex-col justify-center items-center p-4 bg-white rounded-xl border border-stone-200 shadow-sm">
              <span className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">Örnek Çıktı</span>
              <span className="text-2xl font-mono font-bold text-stone-900 tracking-widest">
                {prefix}<span className="text-stone-400">{'X'.repeat(randomLength)}</span>
              </span>
            </div>
          </div>

          <Input label="Üretilecek Miktar" type="number" min="1" max="100000" value={count || ''} onChange={e => setCount(parseInt(e.target.value) || 0)} />
        </div>

        {loading && (
          <div className="mt-8 space-y-2">
            <div className="flex justify-between text-sm font-medium text-stone-600">
              <span>Kodlar Hazırlanıyor...</span><span>%{progress}</span>
            </div>
            <div className="w-full h-3 bg-stone-100 rounded-full overflow-hidden">
              <motion.div className="h-full bg-stone-900" initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
            </div>
          </div>
        )}

        {error && <div className="mt-4 p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm flex items-center gap-2"><AlertCircle size={16} />{error}</div>}

        {!loading && (
          <Button onClick={generateBulk} className="w-full mt-8 py-4 text-lg" disabled={!selectedCampaign || count <= 0}>
            {count.toLocaleString()} Adet Kod Üret
          </Button>
        )}
      </Card>

      <AnimatePresence>
        {generatedCodes.length > 0 && !loading && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-stone-900">Üretilen Kodlar ({generatedCodes.length.toLocaleString()})</h3>
              <Button variant="outline" onClick={downloadCSV}><Download size={18} /> CSV Olarak İndir</Button>
            </div>
            <Card className="bg-stone-50 p-6 max-h-[600px] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {generatedCodes.slice(0, 100).map((c, i) => (
                  <div key={i} className="bg-white p-4 rounded-xl border border-stone-200 flex flex-col items-center gap-3 shadow-sm">
                    <QRCodeSVG value={c} size={80} level="M" />
                    <span className="font-mono text-sm font-bold text-stone-900 tracking-wider">{c}</span>
                  </div>
                ))}
                {generatedCodes.length > 100 && (
                  <div className="col-span-full text-center py-8 text-stone-500 font-medium">
                    ...ve {(generatedCodes.length - 100).toLocaleString()} adet daha. Tümünü görmek ve QR kod linklerini almak için CSV dosyasını indirin.
                  </div>
                )}
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function CodeValidator() {
  const [input, setInput] = useState('');
  const [checkResult, setCheckResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [useLoading, setUseLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleCheck = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input) return;

    setLoading(true);
    setCheckResult(null);

    try {
      const res = await fetch('/api/codes/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: input })
      });
      const data = await res.json();
      setCheckResult(data);
    } catch (err) {
      setCheckResult({ status: 'error', message: 'Bağlantı hatası oluştu.' });
    } finally {
      setLoading(false);
    }
  };

  const handleUse = async () => {
    if (!checkResult?.code?.id) return;
    setUseLoading(true);
    try {
      const res = await fetch('/api/codes/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: checkResult.code.id })
      });
      const data = await res.json();
      if (data.success) {
        setCheckResult({ ...checkResult, status: 'used_success', message: 'Kod başarıyla kullanıldı ve giriş onaylandı.', code: data.code });
      } else {
        setCheckResult({ status: 'error', message: data.message || 'Kullanım başarısız.' });
      }
    } catch (err) {
      setCheckResult({ status: 'error', message: 'İşlem sırasında hata oluştu.' });
    } finally {
      setUseLoading(false);
      setInput('');
      inputRef.current?.focus();
    }
  };

  const reset = () => {
    setCheckResult(null);
    setInput('');
    inputRef.current?.focus();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto space-y-8">
      <header className="text-center space-y-2">
        <div className="w-16 h-16 bg-stone-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <ScanLine className="text-stone-900" size={32} />
        </div>
        <h2 className="text-3xl font-bold text-stone-900">Gişe Doğrulama</h2>
        <p className="text-stone-500">Müşteri kodunu okutun veya manuel girin.</p>
      </header>

      <Card className="p-8">
        <form onSubmit={handleCheck} className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
            <input
              ref={inputRef} autoFocus placeholder="Kodu okutun..."
              className="w-full pl-12 pr-4 py-4 rounded-xl border-2 border-stone-100 focus:border-stone-900 outline-none text-xl font-mono font-bold tracking-widest uppercase"
              value={input} onChange={e => setInput(e.target.value)}
              disabled={loading || useLoading || checkResult?.status === 'success'}
            />
          </div>
          {checkResult?.status === 'success' ? (
            <Button type="button" variant="outline" onClick={reset} className="px-8 text-lg">İptal</Button>
          ) : (
            <Button type="submit" loading={loading} className="px-8 text-lg">Sorgula</Button>
          )}
        </form>
      </Card>

      <AnimatePresence>
        {checkResult && (
          <motion.div initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
            <Card className={cn(
              "p-8 border-l-8",
              (checkResult.status === 'success' || checkResult.status === 'used_success') && "border-l-green-500 bg-green-50/30",
              checkResult.status === 'warning' && "border-l-amber-500 bg-amber-50/30",
              checkResult.status === 'error' && "border-l-red-500 bg-red-50/30"
            )}>
              <div className="flex items-start gap-6">
                <div className={cn(
                  "p-4 rounded-2xl",
                  (checkResult.status === 'success' || checkResult.status === 'used_success') && "bg-green-100 text-green-600",
                  checkResult.status === 'warning' && "bg-amber-100 text-amber-600",
                  checkResult.status === 'error' && "bg-red-100 text-red-600"
                )}>
                  {(checkResult.status === 'success' || checkResult.status === 'used_success') && <CheckCircle2 size={40} />}
                  {checkResult.status === 'warning' && <AlertCircle size={40} />}
                  {checkResult.status === 'error' && <XCircle size={40} />}
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <h3 className={cn(
                      "text-2xl font-bold",
                      (checkResult.status === 'success' || checkResult.status === 'used_success') && "text-green-900",
                      checkResult.status === 'warning' && "text-amber-900",
                      checkResult.status === 'error' && "text-red-900"
                    )}>
                      {checkResult.status === 'success' ? 'Kod Geçerli' :
                        checkResult.status === 'used_success' ? 'Giriş Onaylandı' :
                          checkResult.status === 'warning' ? 'Zaten Kullanılmış' : 'Geçersiz İşlem'}
                    </h3>
                    <p className="text-stone-600 mt-1 font-medium">{checkResult.message}</p>
                  </div>

                  {checkResult.code && (
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-stone-200/50">
                      <div>
                        <p className="text-[10px] uppercase font-bold text-stone-400">Kampanya</p>
                        <p className="font-semibold text-stone-900">{checkResult.code.campaignName || '-'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-stone-400">Firma (Acenta)</p>
                        <p className="font-semibold text-stone-900">{checkResult.code.agencyName || '-'}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-[10px] uppercase font-bold text-stone-400">Geçerlilik Tarihi</p>
                        <p className="font-semibold text-stone-900">{format(parseISO(checkResult.code.expirationDate), 'dd MMMM yyyy')}</p>
                      </div>
                    </div>
                  )}

                  {checkResult.status === 'success' && (
                    <div className="pt-4 mt-4 border-t border-green-200">
                      <Button variant="success" className="w-full py-4 text-lg shadow-lg shadow-green-600/20" onClick={handleUse} loading={useLoading}>
                        Müşteri Girişini Onayla (Kullanıldı İşaretle)
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Reports({ codes, campaigns, agencies }: { codes: AccessCode[], campaigns: Campaign[], agencies: Agency[] }) {
  const [selectedCampaign, setSelectedCampaign] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'used' | 'active' | 'expired'>('all');

  const campaignCodes = selectedCampaign === 'all'
    ? codes
    : codes.filter(c => c.campaignId?.toString() === selectedCampaign.toString());

  const stats = {
    total: campaignCodes.length,
    used: campaignCodes.filter(c => c.status === 'used').length,
    unused: campaignCodes.filter(c => c.status === 'active').length,
    expired: campaignCodes.filter(c => c.status === 'expired').length,
  };

  const displayedCodes = statusFilter === 'all'
    ? campaignCodes
    : campaignCodes.filter(c => c.status === statusFilter);

  const downloadCSV = () => {
    const header = "Kod,Kampanya,Acenta,Durum,Oluşturulma Tarihi,Kullanım Tarihi,Son Kullanma Tarihi\n";
    const rows = displayedCodes.map(code => {
      const status = code.status === 'used' ? 'Kullanıldı' : code.status === 'expired' ? 'Süresi Doldu' : 'Aktif';
      const created = format(parseISO(code.createdAt), 'dd.MM.yyyy HH:mm');
      const used = code.usedAt ? format(parseISO(code.usedAt), 'dd.MM.yyyy HH:mm:ss') : '-';
      const expired = format(parseISO(code.expirationDate), 'dd.MM.yyyy');
      return `${code.code},${code.campaignName || '-'},${code.agencyName || '-'},${status},${created},${used},${expired}`;
    }).join('\n');

    // UTF-8 BOM for Excel compatibility
    const blob = new Blob(["\uFEFF" + header + rows], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapor-${format(new Date(), 'yyyyMMdd-HHmm')}.csv`;
    a.click();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-stone-900">Kampanya Raporları</h2>
          <p className="text-stone-500">Kullanılan ve kullanılmayan kodların detaylı takibi.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-end gap-3 w-full md:w-auto">
          <div className="w-full sm:w-72">
            <label className="text-sm font-medium text-stone-700 mb-1.5 block">Kampanya Filtresi</label>
            <select
              className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:ring-2 focus:ring-stone-900 outline-none bg-white"
              value={selectedCampaign} onChange={e => { setSelectedCampaign(e.target.value); setStatusFilter('all'); }}
            >
              <option value="all">Tüm Kampanyalar</option>
              {campaigns.map(c => <option key={c.id} value={c.id}>{c.name} ({c.agencyName})</option>)}
            </select>
          </div>
          <Button variant="outline" onClick={downloadCSV} className="w-full sm:w-auto h-[46px] bg-white">
            <Download size={18} /> CSV İndir
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card
          onClick={() => setStatusFilter('all')}
          className={cn("p-4 cursor-pointer transition-all", statusFilter === 'all' ? "ring-2 ring-stone-900 ring-offset-2 bg-stone-900 text-white" : "bg-stone-900 text-white opacity-80 hover:opacity-100")}
        >
          <p className={cn("text-xs mb-1", statusFilter === 'all' ? "text-stone-300" : "text-stone-400")}>Toplam Kod</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </Card>

        <Card
          onClick={() => setStatusFilter('used')}
          className={cn("p-4 cursor-pointer transition-all bg-green-50", statusFilter === 'used' ? "ring-2 ring-green-500 ring-offset-2 border-transparent" : "border-green-100 hover:border-green-300")}
        >
          <p className="text-xs text-green-600 mb-1">Kullanılan</p>
          <p className="text-2xl font-bold text-green-700">{stats.used}</p>
        </Card>

        <Card
          onClick={() => setStatusFilter('active')}
          className={cn("p-4 cursor-pointer transition-all bg-blue-50", statusFilter === 'active' ? "ring-2 ring-blue-500 ring-offset-2 border-transparent" : "border-blue-100 hover:border-blue-300")}
        >
          <p className="text-xs text-blue-600 mb-1">Kullanılmayan (Aktif)</p>
          <p className="text-2xl font-bold text-blue-700">{stats.unused}</p>
        </Card>

        <Card
          onClick={() => setStatusFilter('expired')}
          className={cn("p-4 cursor-pointer transition-all bg-red-50", statusFilter === 'expired' ? "ring-2 ring-red-500 ring-offset-2 border-transparent" : "border-red-100 hover:border-red-300")}
        >
          <p className="text-xs text-red-600 mb-1">Süresi Dolan</p>
          <p className="text-2xl font-bold text-red-700">{stats.expired}</p>
        </Card>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-50 text-stone-500 text-xs uppercase tracking-wider font-bold">
                <th className="px-6 py-4">Kod</th>
                <th className="px-6 py-4">Kampanya</th>
                <th className="px-6 py-4">Durum</th>
                <th className="px-6 py-4">Oluşturulma</th>
                <th className="px-6 py-4">Kullanım Tarihi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {displayedCodes.slice(0, 500).map(code => {
                return (
                  <tr key={code.id} className="hover:bg-stone-50 transition-colors text-sm">
                    <td className="px-6 py-4 font-mono font-bold text-stone-900">{code.code}</td>
                    <td className="px-6 py-4 text-stone-600">{code.campaignName || '-'}</td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                        code.status === 'used' ? "bg-green-100 text-green-700" :
                          code.status === 'expired' ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
                      )}>
                        {code.status === 'used' ? 'Kullanıldı' : code.status === 'expired' ? 'Süresi Doldu' : 'Aktif'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-stone-500">{format(parseISO(code.createdAt), 'dd.MM.yyyy HH:mm')}</td>
                    <td className="px-6 py-4 text-stone-500 font-medium">{code.usedAt ? format(parseISO(code.usedAt), 'dd.MM.yyyy HH:mm:ss') : '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {displayedCodes.length > 500 && <div className="p-4 text-center text-stone-500 text-sm bg-stone-50">Sadece son 500 kayıt gösterilmektedir.</div>}
          {displayedCodes.length === 0 && <div className="p-20 text-center text-stone-400 italic">Bu kritere uygun kod bulunamadı.</div>}
        </div>
      </Card>
    </motion.div>
  );
}
