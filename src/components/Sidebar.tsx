import React from 'react';
import { 
  LayoutDashboard, 
  Network, 
  Settings, 
  HelpCircle, 
  Bell, 
  Search,
  ChevronRight,
  Database,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NavItem = ({ 
  icon: Icon, 
  label, 
  active = false, 
  onClick 
}: { 
  icon: any, 
  label: string, 
  active?: boolean,
  onClick?: () => void
}) => (
  <button
    onClick={onClick}
    className={cn(
      "w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all duration-200 group",
      active 
        ? "bg-blue-50 text-blue-600 shadow-sm" 
        : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900"
    )}
  >
    <div className="flex items-center gap-3">
      <Icon size={18} className={cn(active ? "text-blue-600" : "text-neutral-400 group-hover:text-neutral-600")} />
      <span className="text-sm font-medium">{label}</span>
    </div>
    {active && <ChevronRight size={14} className="text-blue-400" />}
  </button>
);

export default function Sidebar({ 
  activeTab, 
  setActiveTab 
}: { 
  activeTab: string, 
  setActiveTab: (tab: string) => void 
}) {
  return (
    <div className="w-64 h-screen border-r border-neutral-200/60 bg-white flex flex-col sticky top-0">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black text-xl shadow-lg shadow-blue-200">
            L
          </div>
          <div>
            <h1 className="text-xs font-black uppercase tracking-[0.2em] text-neutral-900 leading-none">The Learning</h1>
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-blue-600 mt-1">Company</p>
          </div>
        </div>

        <div className="relative mb-6">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input 
            type="text" 
            placeholder="Search architecture..." 
            className="w-full bg-neutral-50 border border-neutral-200 rounded-lg py-2 pl-9 pr-4 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
          />
        </div>

        <nav className="space-y-1">
          <p className="px-4 text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-2">Main</p>
          <NavItem 
            icon={LayoutDashboard} 
            label="Dashboard" 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')}
          />
          <NavItem 
            icon={Network} 
            label="Architecture" 
            active={activeTab === 'architecture'} 
            onClick={() => setActiveTab('architecture')}
          />
          <NavItem 
            icon={Database} 
            label="Data Nodes" 
            active={activeTab === 'data'} 
            onClick={() => setActiveTab('data')}
          />
        </nav>

        <nav className="mt-8 space-y-1">
          <p className="px-4 text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-2">Security</p>
          <NavItem 
            icon={ShieldCheck} 
            label="Compliance" 
            active={activeTab === 'compliance'} 
            onClick={() => setActiveTab('compliance')}
          />
          <NavItem 
            icon={Zap} 
            label="API Keys" 
            active={activeTab === 'api'} 
            onClick={() => setActiveTab('api')}
          />
        </nav>
      </div>

      <div className="mt-auto p-6 border-t border-neutral-100">
        <div className="space-y-1">
          <NavItem icon={Settings} label="Settings" onClick={() => {}} />
          <NavItem icon={HelpCircle} label="Support" onClick={() => {}} />
        </div>
        
        <div className="mt-6 flex items-center justify-between p-3 bg-neutral-50 rounded-xl border border-neutral-200/60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500" />
            <div>
              <p className="text-xs font-bold text-neutral-900">Admin</p>
              <p className="text-[10px] text-neutral-500">Enterprise Plan</p>
            </div>
          </div>
          <Bell size={14} className="text-neutral-400" />
        </div>
      </div>
    </div>
  );
}
