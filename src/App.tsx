import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ArchitectureDiagram from './components/ArchitectureDiagram';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TooltipProvider } from '@/components/ui/tooltip';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Database, Lock, Globe } from 'lucide-react';

const PlaceholderView = ({ title, icon: Icon }: { title: string, icon: any }) => (
  <div className="flex flex-col items-center justify-center h-full min-h-[600px] text-center p-8">
    <div className="w-16 h-16 bg-neutral-50 rounded-2xl flex items-center justify-center text-neutral-300 mb-6 border border-neutral-100">
      <Icon size={32} />
    </div>
    <h2 className="text-xl font-bold text-neutral-900 mb-2">{title}</h2>
    <p className="text-sm text-neutral-500 max-w-md">
      This module is currently being provisioned for your enterprise instance. 
      Check back shortly for real-time data synchronization.
    </p>
  </div>
);

export default function App() {
  const [activeTab, setActiveTab] = useState('architecture');

  return (
    <TooltipProvider>
      <div className="flex bg-neutral-50/30 min-h-screen font-sans selection:bg-blue-100 selection:text-blue-900">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        
        <main className="flex-1 overflow-hidden flex flex-col">
          <header className="h-16 border-b border-neutral-200/60 bg-white/80 backdrop-blur-md sticky top-0 z-10 flex items-center justify-between px-8">
            <div className="flex items-center gap-4">
              <span className="text-xs font-bold uppercase tracking-widest text-neutral-400">System</span>
              <div className="h-4 w-[1px] bg-neutral-200" />
              <span className="text-xs font-bold text-neutral-900 uppercase tracking-widest">
                {activeTab.replace('-', ' ')}
              </span>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">v4.2.0-stable</span>
              </div>
              <button className="px-4 py-1.5 bg-neutral-900 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-neutral-800 transition-colors shadow-sm">
                Deploy Changes
              </button>
            </div>
          </header>

          <ScrollArea className="flex-1">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="h-full"
              >
                {activeTab === 'dashboard' && <Dashboard />}
                {activeTab === 'architecture' && <ArchitectureDiagram />}
                {activeTab === 'data' && <PlaceholderView title="Data Node Management" icon={Database} />}
                {activeTab === 'compliance' && <PlaceholderView title="Security & Compliance" icon={Shield} />}
                {activeTab === 'api' && <PlaceholderView title="API Key Infrastructure" icon={Lock} />}
              </motion.div>
            </AnimatePresence>
          </ScrollArea>

          <footer className="h-12 border-t border-neutral-200/60 bg-white flex items-center justify-between px-8">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 text-[10px] font-medium text-neutral-400 uppercase tracking-wider">
                <Globe size={12} />
                <span>Global Mesh: Active</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-medium text-neutral-400 uppercase tracking-wider">
                <Shield size={12} />
                <span>Encryption: AES-256</span>
              </div>
            </div>
            <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-widest">
              © 2026 The Learning Company. All Rights Reserved.
            </p>
          </footer>
        </main>
      </div>
    </TooltipProvider>
  );
}
