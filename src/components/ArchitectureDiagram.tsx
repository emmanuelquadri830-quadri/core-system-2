import React from 'react';
import { motion } from 'motion/react';
import { 
  Database, 
  Server, 
  Shield, 
  Cpu, 
  Globe, 
  Zap, 
  Layers, 
  Share2, 
  Cloud,
  Lock,
  Workflow,
  Activity
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const ArchitectureNode = ({ 
  icon: Icon, 
  title, 
  description, 
  status = 'active',
  delay = 0 
}: { 
  icon: any, 
  title: string, 
  description: string, 
  status?: 'active' | 'pending' | 'expansion',
  delay?: number
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay }}
    className="relative"
  >
    <Card className={`border-neutral-200/60 shadow-sm hover:shadow-md transition-all duration-300 bg-white/80 backdrop-blur-sm group ${status === 'expansion' ? 'border-dashed border-blue-300' : ''}`}>
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between">
          <div className={`p-2 rounded-lg ${status === 'active' ? 'bg-blue-50 text-blue-600' : status === 'pending' ? 'bg-amber-50 text-amber-600' : 'bg-neutral-50 text-neutral-400'}`}>
            <Icon size={20} />
          </div>
          <Badge variant={status === 'active' ? 'default' : status === 'pending' ? 'secondary' : 'outline'} className="text-[10px] font-medium uppercase tracking-wider px-1.5 py-0">
            {status}
          </Badge>
        </div>
        <CardTitle className="text-sm font-semibold mt-2 group-hover:text-blue-600 transition-colors">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <CardDescription className="text-xs text-neutral-500 leading-relaxed">
          {description}
        </CardDescription>
      </CardContent>
    </Card>
  </motion.div>
);

const ConnectionLine = ({ className }: { className?: string }) => (
  <div className={`absolute bg-neutral-200/50 ${className}`} />
);

export default function ArchitectureDiagram() {
  return (
    <div className="relative w-full max-w-6xl mx-auto p-8 min-h-[800px]">
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 -z-10 opacity-[0.03]" 
           style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-12 relative">
        
        {/* Layer 1: Infrastructure */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-4">
            <Cloud size={16} className="text-blue-500" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">Infrastructure</span>
          </div>
          <ArchitectureNode 
            icon={Server} 
            title="Compute Cluster" 
            description="Auto-scaling GPU instances for LLM inference and training."
            delay={0.1}
          />
          <ArchitectureNode 
            icon={Database} 
            title="Vector DB" 
            description="High-performance semantic search and long-term memory."
            delay={0.2}
          />
          <ArchitectureNode 
            icon={Shield} 
            title="Edge Security" 
            description="WAF, DDoS protection, and global CDN acceleration."
            delay={0.3}
          />
        </div>

        {/* Layer 2: Service Layer */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-4">
            <Layers size={16} className="text-blue-500" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">Service Layer</span>
          </div>
          <ArchitectureNode 
            icon={Cpu} 
            title="AI Engine" 
            description="Proprietary learning models and agentic workflow orchestration."
            delay={0.4}
          />
          <ArchitectureNode 
            icon={Workflow} 
            title="Content Pipeline" 
            description="Automated curriculum generation and asset processing."
            delay={0.5}
          />
          <ArchitectureNode 
            icon={Lock} 
            title="Auth Service" 
            description="Enterprise SSO, RBAC, and multi-tenant isolation."
            delay={0.6}
          />
        </div>

        {/* Layer 3: API & Integration */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-4">
            <Share2 size={16} className="text-blue-500" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">Connectivity</span>
          </div>
          <ArchitectureNode 
            icon={Globe} 
            title="GraphQL API" 
            description="Unified data access layer for web and mobile clients."
            delay={0.7}
          />
          <ArchitectureNode 
            icon={Zap} 
            title="Real-time Sync" 
            description="WebSocket layer for collaborative learning sessions."
            delay={0.8}
          />
          <ArchitectureNode 
            icon={Activity} 
            title="Telemetry" 
            description="Real-time monitoring and learning analytics stream."
            delay={0.9}
          />
        </div>

        {/* Layer 4: Expansion Pathways */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-4">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Zap size={16} className="text-blue-400" />
            </motion.div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">Future Readiness</span>
          </div>
          <ArchitectureNode 
            icon={Share2} 
            title="Third-party SDK" 
            description="External developer ecosystem for custom learning tools."
            status="pending"
            delay={1.0}
          />
          <ArchitectureNode 
            icon={Globe} 
            title="Global Nodes" 
            description="Expansion into APAC and EMEA regional data centers."
            status="expansion"
            delay={1.1}
          />
          <ArchitectureNode 
            icon={Cpu} 
            title="Quantum Core" 
            description="Next-gen processing for hyper-personalized learning."
            status="expansion"
            delay={1.2}
          />
        </div>

        {/* Connecting Lines (Visual only, simplified) */}
        <div className="hidden md:block">
          <ConnectionLine className="top-1/4 left-1/4 w-12 h-[1px]" />
          <ConnectionLine className="top-1/2 left-1/4 w-12 h-[1px]" />
          <ConnectionLine className="top-3/4 left-1/4 w-12 h-[1px]" />
          
          <ConnectionLine className="top-1/4 left-1/2 w-12 h-[1px]" />
          <ConnectionLine className="top-1/2 left-1/2 w-12 h-[1px]" />
          <ConnectionLine className="top-3/4 left-1/2 w-12 h-[1px]" />
          
          <ConnectionLine className="top-1/4 left-3/4 w-12 h-[1px]" />
          <ConnectionLine className="top-1/2 left-3/4 w-12 h-[1px]" />
          <ConnectionLine className="top-3/4 left-3/4 w-12 h-[1px]" />
        </div>
      </div>

      {/* Legend / Info */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="mt-16 p-6 bg-neutral-50 rounded-2xl border border-neutral-200/60 flex flex-wrap gap-8 items-center justify-center"
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-xs font-medium text-neutral-600">Production Ready</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="text-xs font-medium text-neutral-600">In Development</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full border border-dashed border-neutral-400" />
          <span className="text-xs font-medium text-neutral-600">Expansion Pathway</span>
        </div>
        <div className="h-4 w-[1px] bg-neutral-300 mx-2" />
        <p className="text-xs text-neutral-400 max-w-md text-center">
          Our architecture is built on a microservices foundation, utilizing containerized workloads 
          and a global service mesh to ensure 99.99% availability and sub-100ms latency.
        </p>
      </motion.div>
    </div>
  );
}
