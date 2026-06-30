/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { ClockInLog, MONTHS_INDONESIAN } from "../types";
import { Search, Calendar, Filter, Trash2, CheckCircle2, AlertTriangle, HelpCircle, FileDown } from "lucide-react";

interface ClockInLogsProps {
  logs: ClockInLog[];
  onDeleteLog: (logId: string) => void;
  onClearAllLogs: () => void;
  selectedMonth: number;
  selectedYear: number;
}

export default function ClockInLogs({ logs, onDeleteLog, onClearAllLogs, selectedMonth, selectedYear }: ClockInLogsProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDayFilter, setSelectedDayFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Sorting: newest logs first (logs usually have seeded logs, so we sort by Day descending and then by Timestamp/ID)
  const sortedLogs = [...logs].sort((a, b) => {
    if (b.day !== a.day) {
      return b.day - a.day;
    }
    return b.clockInTime.localeCompare(a.clockInTime);
  });

  const filteredLogs = sortedLogs.filter((log) => {
    const matchesSearch = log.staffName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDay = selectedDayFilter === "ALL" || log.day === parseInt(selectedDayFilter);
    const matchesStatus = statusFilter === "ALL" || log.status === statusFilter;
    return matchesSearch && matchesDay && matchesStatus;
  });

  // Calculate statistics of current filtered log set
  const stats = filteredLogs.reduce(
    (acc, log) => {
      if (log.status === "ON TIME") acc.onTime++;
      else if (log.status === "TERLAMBAT") acc.late++;
      else acc.others++;
      return acc;
    },
    { onTime: 0, late: 0, others: 0 }
  );

  const handleDownloadCSV = () => {
    if (filteredLogs.length === 0) return;
    
    // Create headers
    const headers = ["Nama Staff", "Divisi", `Tanggal (${MONTHS_INDONESIAN[selectedMonth]} ${selectedYear})`, "Shift Asal", "Jam Masuk", "Status Absensi"];
    const rows = filteredLogs.map(l => [
      l.staffName,
      l.category,
      `Hari ${l.day}`,
      l.shift === "1" ? "Pagi" : l.shift === "2" ? "Malam" : l.shift,
      l.clockInTime,
      l.status
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `log_absensi_${MONTHS_INDONESIAN[selectedMonth].toLowerCase()}_${selectedYear}_filtered.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6" id="clock-in-logs-container">
      {/* Header and Counters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Log Filtered</span>
            <span className="text-xl font-black text-slate-800">{filteredLogs.length} Records</span>
          </div>
          <div className="h-10 w-10 bg-slate-50 text-slate-600 rounded-lg flex items-center justify-center font-bold">
            All
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tepat Waktu (ON TIME)</span>
            <span className="text-xl font-black text-emerald-600">{stats.onTime} Staff</span>
          </div>
          <div className="h-10 w-10 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Terlambat (TERLAMBAT)</span>
            <span className="text-xl font-black text-rose-600">{stats.late} Staff</span>
          </div>
          <div className="h-10 w-10 bg-rose-50 text-rose-600 rounded-lg flex items-center justify-center">
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Off / Cuti</span>
            <span className="text-xl font-black text-slate-500">{stats.others} Staff</span>
          </div>
          <div className="h-10 w-10 bg-slate-50 text-slate-500 rounded-lg flex items-center justify-center">
            <HelpCircle className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Filter and Control Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              id="logs-search-input"
              type="text"
              placeholder="Cari nama staff..."
              className="pl-9 pr-4 py-2 w-56 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
            <Calendar className="h-3.5 w-3.5 text-slate-500" />
            <select
              id="logs-day-filter"
              className="bg-transparent border-none text-xs text-slate-600 focus:outline-none pr-1"
              value={selectedDayFilter}
              onChange={(e) => setSelectedDayFilter(e.target.value)}
            >
              <option value="ALL">Semua Tanggal</option>
              {Array.from({ length: 31 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  Hari {i + 1}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
            <Filter className="h-3.5 w-3.5 text-slate-500" />
            <select
              id="logs-status-filter"
              className="bg-transparent border-none text-xs text-slate-600 focus:outline-none pr-1"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">Semua Status</option>
              <option value="ON TIME">ON TIME</option>
              <option value="TERLAMBAT">TERLAMBAT</option>
              <option value="OFF DAY">OFF DAY</option>
              <option value="CUTI">CUTI</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="logs-download-csv-btn"
            onClick={handleDownloadCSV}
            disabled={filteredLogs.length === 0}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 text-xs font-semibold px-3.5 py-2 rounded-lg border border-slate-200 transition-colors cursor-pointer"
          >
            <FileDown className="h-3.5 w-3.5" />
            Export CSV
          </button>
          
          <button
            id="logs-clear-all-btn"
            onClick={() => {
              if (window.confirm("Hapus seluruh log absensi? Aksi ini tidak dapat dibatalkan.")) {
                onClearAllLogs();
              }
            }}
            className="bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold px-3.5 py-2 rounded-lg border border-rose-100 transition-colors cursor-pointer"
          >
            Hapus Semua Log
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 text-slate-500 text-xs font-bold border-b border-slate-200">
              <tr>
                <th className="px-5 py-3 w-16 text-center">Tgl</th>
                <th className="px-5 py-3">Nama Staff</th>
                <th className="px-5 py-3">Divisi</th>
                <th className="px-5 py-3 text-center">Shift Jadwal</th>
                <th className="px-5 py-3 text-center">Jam Absensi</th>
                <th className="px-5 py-3 text-center">Status Kehadiran</th>
                <th className="px-5 py-3 text-center w-20">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400 italic">
                    Belum ada log absensi terdaftar yang cocok dengan filter Anda.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 text-center font-mono font-bold text-slate-500 bg-slate-50/50">
                      Hari {log.day}
                    </td>
                    <td className="px-5 py-3 font-semibold text-slate-900">
                      {log.staffName}
                    </td>
                    <td className="px-5 py-3 text-slate-500 font-medium">
                      {log.category}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                        log.shift === "1" ? "bg-emerald-100 text-emerald-800" :
                        log.shift === "2" ? "bg-blue-100 text-blue-800" :
                        log.shift === "1/2" ? "bg-amber-100 text-amber-800" :
                        log.shift === "OFF" ? "bg-rose-100 text-rose-800" :
                        "bg-purple-100 text-purple-800"
                      }`}>
                        {log.shift === "1" ? "PAGI" : log.shift === "2" ? "MALAM" : log.shift}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center font-mono font-bold text-slate-800">
                      {log.clockInTime}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold inline-block ${
                        log.status === "ON TIME" ? "bg-emerald-100 text-emerald-800" :
                        log.status === "TERLAMBAT" ? "bg-rose-100 text-rose-800" :
                        log.status === "OFF DAY" ? "bg-slate-100 text-slate-700" :
                        "bg-purple-100 text-purple-800"
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <button
                        id={`delete-log-btn-${log.id}`}
                        onClick={() => onDeleteLog(log.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                        title="Hapus Log"
                      >
                        <Trash2 className="h-4 w-4 inline" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
