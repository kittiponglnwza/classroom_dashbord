import { CheckCircle2, Clock, ListTodo, ClipboardList } from 'lucide-react';

export default function TaskStats({ assignments = [] }) {
  const total = assignments.length;
  const todo = assignments.filter(a => a.status === 'todo').length;
  const doing = assignments.filter(a => a.status === 'doing').length;
  const done = assignments.filter(a => a.status === 'done').length;

  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  const stats = [
    {
      label: 'All Assignments',
      value: total,
      icon: ClipboardList,
      color: 'text-brand-400 bg-brand-500/10 border-brand-500/10'
    },
    {
      label: 'To Do (ยังไม่เริ่ม)',
      value: todo,
      icon: ListTodo,
      color: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/10'
    },
    {
      label: 'In Progress (กำลังทำ)',
      value: doing,
      icon: Clock,
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/10'
    },
    {
      label: 'Completed (เสร็จแล้ว)',
      value: done,
      icon: CheckCircle2,
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/10'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Stats Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div 
            key={stat.label}
            className="bg-dark-card border border-dark-border rounded-xl p-5 hover:border-dark-border/80 transition-all duration-300 relative overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-dark-muted font-medium mb-1">{stat.label}</p>
                <h4 className="text-2xl font-bold font-heading text-white">{stat.value}</h4>
              </div>
              <div className={`p-2.5 rounded-lg border ${stat.color}`}>
                <stat.icon size={20} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Progress Bar Container */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-5">
        <div className="flex items-center justify-between text-sm mb-2.5">
          <span className="font-semibold text-white">Course Completion Progress</span>
          <span className="font-bold text-brand-400">{percent}% ({done}/{total} done)</span>
        </div>
        <div className="w-full bg-dark-sidebar border border-dark-border rounded-full h-3 overflow-hidden">
          <div 
            className="bg-gradient-to-r from-brand-600 to-brand-400 h-full rounded-full transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
