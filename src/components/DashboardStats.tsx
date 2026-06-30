/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { StaffShift, ClockInLog, MONTHS_INDONESIAN } from "../types";
import { Users, CheckCircle, Clock, Percent, ListTodo, AlertOctagon } from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

interface DashboardStatsProps {
  staffShifts: StaffShift[];
  logs: ClockInLog[];
  selectedMonth: number;
  selectedYear: number;
}

export default function DashboardStats({ staffShifts, logs, selectedMonth, selectedYear }: DashboardStatsProps) {
  // 1. Overall stats
  const totalStaff = staffShifts.length;
  const totalLogs = logs.length;
  
  const totalOnTime = logs.filter((l) => l.status === "ON TIME").length;
  const totalLate = logs.filter((l) => l.status === "TERLAMBAT").length;
  const onTimePercentage = totalLogs > 0 ? Math.round((totalOnTime / (totalOnTime + totalLate)) * 100) : 100;

  // 2. Division Breakdown
  const divisionCounts = staffShifts.reduce((acc, curr) => {
    acc[curr.category] = (acc[curr.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // 3. Shift Schedule distribution (across all 31 days)
  let totalPagiShifts = 0;
  let totalMalamShifts = 0;
  let totalHalfShifts = 0;
  let totalOffShifts = 0;
  let totalCutiShifts = 0;

  staffShifts.forEach((s) => {
    s.schedule.forEach((val) => {
      if (val === "1") totalPagiShifts++;
      else if (val === "2") totalMalamShifts++;
      else if (val === "1/2") totalHalfShifts++;
      else if (val === "OFF") totalOffShifts++;
      else if (val === "CUTI") totalCutiShifts++;
    });
  });

  const shiftDistData = [
    { name: "Pagi (1)", value: totalPagiShifts, color: "#10b981" },
    { name: "Malam (2)", value: totalMalamShifts, color: "#3b82f6" },
    { name: "Setengah Hari (1/2)", value: totalHalfShifts, color: "#f59e0b" },
    { name: "Off Day (OFF)", value: totalOffShifts, color: "#ef4444" },
    { name: "Cuti (CUTI)", value: totalCutiShifts, color: "#a855f7" },
  ];

  // 4. Status Chart Data (ON TIME vs TERLAMBAT)
  const statusChartData = [
    { name: "Tepat Waktu", value: totalOnTime, color: "#059669" },
    { name: "Terlambat", value: totalLate, color: "#e11d48" },
  ];

  // 5. Leaderboard of Late staff (Terlambat)
  const lateLeaderboard = staffShifts.map((s) => {
    const lateCount = logs.filter((l) => l.staffId === s.id && l.status === "TERLAMBAT").length;
    return { name: s.name, category: s.category, count: lateCount };
  })
  .filter((x) => x.count > 0)
  .sort((a, b) => b.count - a.count)
  .slice(0, 5);

  // 6. Trend data by Day of Selected Month
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const dailyTrend: Record<number, { day: string; "Tepat Waktu": number; "Terlambat": number }> = {};
  for (let d = 1; d <= daysInMonth; d++) {
    dailyTrend[d] = { day: `${d}`, "Tepat Waktu": 0, "Terlambat": 0 };
  }
  logs.forEach((l) => {
    if (l.status === "ON TIME") {
      dailyTrend[l.day]["Tepat Waktu"]++;
    } else if (l.status === "TERLAMBAT") {
      dailyTrend[l.day]["Terlambat"]++;
    }
  });
  const trendChartData = Object.values(dailyTrend).filter(
    (item) => item["Tepat Waktu"] > 0 || item["Terlambat"] > 0
  );

  return (
    <div className="space-y-6" id="dashboard-stats-container">
      {/* Metrics Panel */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Total Staff Terdaftar</span>
            <span className="text-2xl font-black text-slate-800">{totalStaff} Orang</span>
          </div>
          <div className="h-12 w-12 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center shadow-inner">
            <Users className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Log Absensi Disimpan</span>
            <span className="text-2xl font-black text-slate-800">{totalLogs} Absen</span>
          </div>
          <div className="h-12 w-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shadow-inner">
            <ListTodo className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Absen Tepat Waktu</span>
            <span className="text-2xl font-black text-emerald-600">{totalOnTime} Kali</span>
          </div>
          <div className="h-12 w-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shadow-inner">
            <CheckCircle className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Persentase Tepat Waktu</span>
            <span className="text-2xl font-black text-teal-700">{onTimePercentage}%</span>
          </div>
          <div className="h-12 w-12 bg-teal-50 text-teal-700 rounded-xl flex items-center justify-center shadow-inner">
            <Percent className="h-6 w-6" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart of status */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-teal-600" />
            Proporsi Tepat Waktu vs Terlambat
          </h3>
          <div className="h-64 flex items-center justify-center">
            {totalLogs === 0 ? (
              <p className="text-xs text-slate-400 italic">Belum ada data log absensi untuk digambarkan.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {statusChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} Absen`, "Jumlah"]} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Bar Chart of daily trend */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-600" />
            Tren Harian Kehadiran ({MONTHS_INDONESIAN[selectedMonth]} {selectedYear})
          </h3>
          <div className="h-64">
            {trendChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">
                Simulasi kedatangan staff di halaman Clock-In untuk melihat diagram tren harian!
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Tepat Waktu" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Terlambat" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Shift Code Distribution Breakdown */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <h3 className="text-sm font-bold text-slate-800 mb-4">
            Total Alokasi Shift Sebulan (Unit-Hari {MONTHS_INDONESIAN[selectedMonth]})
          </h3>
          <div className="space-y-3.5">
            {shiftDistData.map((item) => {
              const pct = totalPagiShifts + totalMalamShifts + totalHalfShifts + totalOffShifts + totalCutiShifts > 0
                ? Math.round((item.value / (totalPagiShifts + totalMalamShifts + totalHalfShifts + totalOffShifts + totalCutiShifts)) * 100)
                : 0;
              return (
                <div key={item.name} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-600">{item.name}</span>
                    <span className="font-mono text-slate-500 font-bold">{item.value.toLocaleString()} Hari ({pct}%)</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: item.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Late Leaderboard - Staff with highest late counts */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-1 flex items-center gap-1.5">
              <AlertOctagon className="h-4 w-4 text-rose-600" />
              Tingkat Terlambat Tertinggi (Top 5)
            </h3>
            <p className="text-[11px] text-slate-400 mb-4">
              Daftar staff dengan frekuensi terlambat terbanyak berdasarkan log absensi bulan ini.
            </p>

            {lateLeaderboard.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                Bagus sekali! Belum ada karyawan yang tercatat terlambat.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {lateLeaderboard.map((item, index) => (
                  <div key={item.name} className="flex justify-between items-center py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-6 w-6 rounded-full bg-rose-50 text-rose-600 font-extrabold text-xs flex items-center justify-center">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-bold text-xs text-slate-800">{item.name}</p>
                        <p className="text-[10px] text-slate-400">{item.category}</p>
                      </div>
                    </div>
                    <span className="bg-rose-100 text-rose-800 text-[10px] font-extrabold px-2.5 py-1 rounded-full">
                      {item.count}x Terlambat
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
