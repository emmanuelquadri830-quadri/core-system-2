import React, { useState, useEffect } from 'react';
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { 
  Activity, 
  Users, 
  Zap, 
  Globe, 
  ArrowUpRight, 
  ArrowDownRight,
  Clock,
  Layout
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const generateData = () => {
  return Array.from({ length: 24 }, (_, i) => ({
    time: `${i}:00`,
    requests: Math.floor(Math.random() * 5000) + 2000,
    latency: Math.floor(Math.random() * 50) + 20,
    users: Math.floor(Math.random() * 1000) + 500,
  }));
};

const StatCard = ({ title, value, change, icon: Icon, trend }: { title: string, value: string, change: string, icon: any, trend: 'up' | 'down' }) => (
  <Card className="border-neutral-200/60 shadow-sm bg-white/50 backdrop-blur-sm">
    <CardContent className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="p-2 bg-neutral-100 rounded-lg text-neutral-600">
          <Icon size={18} />
        </div>
        <Badge variant="outline" className={`text-[10px] font-bold ${trend === 'up' ? 'text-emerald-600 border-emerald-100 bg-emerald-50' : 'text-rose-600 border-rose-100 bg-rose-50'}`}>
          {trend === 'up' ? <ArrowUpRight size={10} className="mr-1" /> : <ArrowDownRight size={10} className="mr-1" />}
          {change}
        </Badge>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">{title}</p>
        <h3 className="text-2xl font-bold text-neutral-900">{value}</h3>
      </div>
    </CardContent>
  </Card>
);

export default function Dashboard() {
  const [data, setData] = useState(generateData());

  useEffect(() => {
    const interval = setInterval(() => {
      setData(prev => {
        const newData = [...prev.slice(1), {
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          requests: Math.floor(Math.random() * 5000) + 2000,
          latency: Math.floor(Math.random() * 50) + 20,
          users: Math.floor(Math.random() * 1000) + 500,
        }];
        return newData;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 tracking-tight">System Performance</h2>
          <p className="text-sm text-neutral-500">Real-time telemetry from global edge nodes.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Live System Status: Healthy</span>
          </div>
          <button className="p-2 hover:bg-neutral-100 rounded-lg transition-colors text-neutral-500">
            <Layout size={18} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Requests" 
          value="1.2M" 
          change="+12.5%" 
          icon={Activity} 
          trend="up" 
        />
        <StatCard 
          title="Avg. Latency" 
          value="32ms" 
          change="-4.2%" 
          icon={Zap} 
          trend="down" 
        />
        <StatCard 
          title="Active Users" 
          value="45.2k" 
          change="+8.1%" 
          icon={Users} 
          trend="up" 
        />
        <StatCard 
          title="Global Reach" 
          value="142" 
          change="+2" 
          icon={Globe} 
          trend="up" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-neutral-200/60 shadow-sm bg-white/50 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Request Throughput</CardTitle>
                <CardDescription className="text-xs">Requests per second across all regions</CardDescription>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-[10px] font-medium text-neutral-500 uppercase">Primary</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-neutral-200" />
                  <span className="text-[10px] font-medium text-neutral-500 uppercase">Baseline</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="h-[300px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis 
                  dataKey="time" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#a3a3a3' }}
                  interval={4}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#a3a3a3' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: '1px solid #e5e5e5', 
                    borderRadius: '8px',
                    fontSize: '12px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                  }} 
                />
                <Area 
                  type="monotone" 
                  dataKey="requests" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorRequests)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-neutral-200/60 shadow-sm bg-white/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Regional Distribution</CardTitle>
            <CardDescription className="text-xs">Traffic load by geographic zone</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                { name: 'NA', value: 45 },
                { name: 'EU', value: 30 },
                { name: 'AS', value: 15 },
                { name: 'SA', value: 10 },
              ]}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#a3a3a3' }} />
                <YAxis hide />
                <Tooltip 
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: '1px solid #e5e5e5', 
                    borderRadius: '8px',
                    fontSize: '12px'
                  }} 
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {[0, 1, 2, 3].map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#3b82f6' : '#e5e5e5'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="border-neutral-200/60 shadow-sm bg-white/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-neutral-400" />
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-neutral-500">Uptime History</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-1 mt-2">
              {Array.from({ length: 30 }).map((_, i) => (
                <div 
                  key={i} 
                  className={`h-8 flex-1 rounded-sm ${i === 12 ? 'bg-amber-400' : 'bg-emerald-400'} opacity-80 hover:opacity-100 transition-opacity cursor-help`}
                  title={i === 12 ? "Minor degradation - 98.2%" : "Healthy - 100%"}
                />
              ))}
            </div>
            <div className="flex justify-between mt-2 text-[10px] font-medium text-neutral-400 uppercase tracking-tighter">
              <span>30 Days Ago</span>
              <span>Today</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-neutral-200/60 shadow-sm bg-white/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-neutral-400" />
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-neutral-500">API Latency</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 h-8">
              <div className="text-2xl font-bold">24ms</div>
              <div className="text-xs text-emerald-600 font-medium mb-1">Optimal</div>
            </div>
            <div className="w-full bg-neutral-100 h-1.5 rounded-full mt-2 overflow-hidden">
              <div className="bg-blue-500 h-full w-[24%]" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-neutral-200/60 shadow-sm bg-white/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-neutral-400" />
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-neutral-500">Concurrent Sessions</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 h-8">
              <div className="text-2xl font-bold">12,842</div>
              <div className="text-xs text-blue-600 font-medium mb-1">+12% vs last hr</div>
            </div>
            <div className="flex gap-0.5 mt-3">
              {Array.from({ length: 20 }).map((_, i) => (
                <div 
                  key={i} 
                  className="h-1 flex-1 bg-blue-500" 
                  style={{ opacity: 0.1 + (i / 20) }}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
