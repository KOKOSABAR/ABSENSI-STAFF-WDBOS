/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { StaffShift, ClockInLog, SHIFT_DETAILS, ShiftType, MONTHS_INDONESIAN } from "../types";
import { ChevronLeft, ChevronRight, Clock, CheckCircle2, AlertTriangle, AlertCircle } from "lucide-react";

interface DailyDashboardProps {
  staffShifts: StaffShift[];
  logs: ClockInLog[];
  onAddLog: (log: Omit<ClockInLog, "id" | "timestamp">) => void;
  onDeleteLog: (logId: string) => void;
  selectedMonth: number;
  selectedYear: number;
  selectedDay: number;
  setSelectedDay: React.Dispatch<React.SetStateAction<number>>;
}

export default function DailyDashboard({
  staffShifts,
  logs,
  onAddLog,
  onDeleteLog,
  selectedMonth,
  selectedYear,
  selectedDay,
  setSelectedDay,
}: DailyDashboardProps) {
  // Search term for filtering staff names
  const [searchTerm, setSearchTerm] = useState<string>("");
  
  // Track which log is currently being confirmed for cancellation
  const [confirmCancelLogId, setConfirmCancelLogId] = useState<string | null>(null);
  
  // Real-time Clock state - initialized to actual current local time
  const [simTime, setSimTime] = useState<Date>(() => new Date());

  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();

  // Update clock every second with actual real-world time
  useEffect(() => {
    const interval = setInterval(() => {
      setSimTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Format date helper
  const formatTimeStr = (date: Date) => {
    const h = date.getHours().toString().padStart(2, "0");
    const m = date.getMinutes().toString().padStart(2, "0");
    const s = date.getSeconds().toString().padStart(2, "0");
    return `${h}:${m}:${s}`;
  };

  const handleDayChange = (direction: "prev" | "next") => {
    if (direction === "prev") {
      setSelectedDay((prev) => (prev > 1 ? prev - 1 : daysInMonth));
    } else {
      setSelectedDay((prev) => (prev < daysInMonth ? prev + 1 : 1));
    }
  };

  // Filter staff by scheduled shift for the selected day
  const getStaffForShift = (shiftCode: "1" | "2") => {
    return staffShifts.filter((staff) => {
      const scheduled = staff.schedule[selectedDay - 1];
      // Note: "1" goes to Pagi, "2" goes to Malam.
      // If "1/2", it counts as off half day but let's see. In the screenshot, Nico Adriansyah (scheduled 1 on day 1) is in Pagi.
      // Arjun (scheduled 1 on day 1) is in Pagi.
      // Eric (CUTI on day 1) is not in Pagi or Malam.
      // Let's match strictly: if scheduled shift is "1" or includes "1" (like 1/2) we can map. But strictly, "1" is Shift Pagi, "2" is Shift Malam.
      return scheduled === shiftCode;
    });
  };

  const pagiStaff = getStaffForShift("1");
  const malamStaff = getStaffForShift("2");

  // Parse multi-line, comma, or semicolon separated search terms
  const searchTerms = searchTerm
    .split(/[\n,;]+/)
    .map((term) => term.trim().toLowerCase())
    .filter((term) => term.length > 0);

  const filteredPagiStaff = searchTerms.length === 0
    ? pagiStaff
    : pagiStaff.filter((staff) =>
        searchTerms.some((term) => staff.name.toLowerCase().includes(term))
      );

  const filteredMalamStaff = searchTerms.length === 0
    ? malamStaff
    : malamStaff.filter((staff) =>
        searchTerms.some((term) => staff.name.toLowerCase().includes(term))
      );

  // Get log for a staff on the selected day
  const getStaffLogForDay = (staffId: string) => {
    return logs.find((l) => l.staffId === staffId && l.day === selectedDay);
  };

  // Handle click on "MASUK" button
  const handlePencetMasuk = (staff: StaffShift, shiftCode: "1" | "2") => {
    const timeStr = formatTimeStr(simTime);
    
    // Determine status
    let status: "ON TIME" | "TERLAMBAT" | "OFF DAY" | "CUTI" = "ON TIME";
    if (shiftCode === "1") {
      // Pagi limit is 07:45:59. ON TIME is <= 07:45:59, otherwise TERLAMBAT
      status = timeStr <= "07:45:59" ? "ON TIME" : "TERLAMBAT";
    } else {
      // Malam limit is 19:45:59. ON TIME is <= 19:45:59, otherwise TERLAMBAT
      status = timeStr <= "19:45:59" ? "ON TIME" : "TERLAMBAT";
    }

    onAddLog({
      staffId: staff.id,
      staffName: staff.name,
      category: staff.category,
      day: selectedDay,
      shift: shiftCode,
      clockInTime: timeStr,
      status,
    });
  };

  // Group staff by their category for clean divider rendering
  const renderStaffGroup = (
    staffList: StaffShift[],
    category: "CS LINE" | "CS LC" | "KAPTEN KASIR" | "KASIR",
    shiftCode: "1" | "2"
  ) => {
    // Filter staff list belonging to this category
    let filtered = staffList.filter((s) => s.category === category);
    let displayName = category as string;

    const catClass = category.toLowerCase().replace(/\s+/g, "-");

    return (
      <>
        {/* Category Divider Bar */}
        <tr className={`category-divider-row category-${catClass} border-y transition-all duration-300`}>
          <td colSpan={5} className="px-3 py-2 text-center font-black text-xs tracking-widest uppercase font-mono">
            <span className="bolt-icon">⚡</span> <span className="category-text">{displayName}</span> <span className="bolt-icon">⚡</span>
          </td>
        </tr>

        {filtered.length === 0 ? (
          <tr>
            <td colSpan={5} className="px-2 py-3 text-center text-xs text-slate-500 italic bg-slate-950/40 font-mono">
              Tidak ada staff yang terjadwal
            </td>
          </tr>
        ) : (
          filtered.map((staff) => {
            const log = getStaffLogForDay(staff.id);
            const isPagi = shiftCode === "1";
            const jamMasukLimit = isPagi ? "07:45:00" : "19:45:00";
            const jamPulangLimit = isPagi ? "19:45:00" : "07:45:00";

            let rowBgClass = "border-b border-slate-900/60 bg-slate-950/10 hover:bg-slate-900/30 border-l-[4px] border-l-slate-700";
            let nameColorClass = "text-slate-300 font-bold";

            if (log) {
              if (log.status === "ON TIME") {
                rowBgClass = "border-b border-emerald-950/60 bg-gradient-to-r from-emerald-950/25 via-slate-950/5 to-transparent hover:from-emerald-950/35 hover:to-slate-950/10 border-l-[4px] border-l-emerald-500";
                nameColorClass = "text-emerald-300 font-extrabold font-mono tracking-wide";
              } else {
                rowBgClass = "border-b border-rose-950/60 bg-gradient-to-r from-rose-950/25 via-slate-950/5 to-transparent hover:from-rose-950/35 hover:to-slate-950/10 border-l-[4px] border-l-rose-500";
                nameColorClass = "text-rose-300 font-extrabold font-mono tracking-wide";
              }
            }

            return (
              <tr
                key={staff.id}
                className={`transition-colors ${rowBgClass}`}
              >
                {/* NAMA STAFF */}
                <td className={`px-2.5 py-2 text-xs uppercase tracking-wide truncate max-w-[110px] sm:max-w-[160px] ${nameColorClass}`}>
                  {staff.name}
                </td>

                {/* JAM KERJA */}
                <td className="px-1 py-2 text-center font-mono text-[11px] text-slate-300">
                  {jamMasukLimit}
                </td>

                {/* JAM PULANG */}
                <td className="px-1 py-2 text-center font-mono text-[11px] text-slate-400">
                  {jamPulangLimit}
                </td>

                {/* MASUK BUTTON */}
                <td className="px-1 py-2 text-center">
                  {log ? (
                    <div className="flex flex-col items-center justify-center gap-1">
                      <span className="font-mono text-xs font-black text-teal-400 bg-slate-950 px-1.5 py-0.5 rounded border border-teal-900/40">
                        {log.clockInTime}
                      </span>
                      {confirmCancelLogId === log.id ? (
                        <div className="flex items-center gap-1 justify-center">
                          <button
                            onClick={() => {
                              onDeleteLog(log.id);
                              setConfirmCancelLogId(null);
                            }}
                            className="text-[8px] font-black text-white bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 px-1.5 py-0.5 rounded shadow-sm cursor-pointer transition-all uppercase tracking-tight"
                            title="Konfirmasi Batalkan"
                          >
                            Yakin?
                          </button>
                          <button
                            onClick={() => setConfirmCancelLogId(null)}
                            className="text-[9px] font-bold text-slate-400 hover:text-slate-200 cursor-pointer transition-all px-0.5"
                            title="Kembali"
                          >
                            X
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmCancelLogId(log.id)}
                          className="text-[9px] font-bold text-rose-400/80 hover:text-rose-400 hover:underline tracking-wider uppercase transition-colors bg-transparent border-none p-0 cursor-pointer font-mono"
                          title="Batalkan absen masuk"
                        >
                          [ BATAL ]
                        </button>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => handlePencetMasuk(staff, shiftCode)}
                      className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded bg-slate-800 text-slate-300 hover:bg-gradient-to-r hover:from-teal-500 hover:to-emerald-500 hover:text-slate-950 active:scale-95 transition-all cursor-pointer border border-slate-700 hover:border-teal-400 shadow-md font-mono"
                    >
                      MASUK
                    </button>
                  )}
                </td>

                {/* STATUS */}
                <td className="px-1.5 py-2 text-center">
                  {log ? (
                    <span className={`px-2.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider inline-block min-w-[78px] text-center shadow-md ${
                      log.status === "ON TIME"
                        ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white border border-emerald-400/40"
                        : "bg-gradient-to-r from-rose-600 to-red-600 text-white border border-rose-400/40"
                    }`}>
                      {log.status}
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider inline-block bg-slate-900 text-slate-500 border border-slate-800/80 min-w-[78px] text-center font-mono">
                      WAITING
                    </span>
                  )}
                </td>
              </tr>
            );
          })
        )}
      </>
    );
  };

  // Stats for the active day
  const activeDayPagiLogCount = pagiStaff.filter((s) => getStaffLogForDay(s.id)).length;
  const activeDayMalamLogCount = malamStaff.filter((s) => getStaffLogForDay(s.id)).length;

  // Division breakdown calculation for the selected day
  const categories: ("CS LINE" | "CS LC" | "KAPTEN KASIR" | "KASIR")[] = [
    "CS LINE",
    "CS LC",
    "KAPTEN KASIR",
    "KASIR",
  ];

  const pagiStats = categories.map((cat) => {
    const total = staffShifts.filter((s) => s.category === cat).length;
    const scheduledToday = pagiStaff.filter((s) => s.category === cat).length;
    const presentToday = pagiStaff.filter((s) => s.category === cat && getStaffLogForDay(s.id)).length;
    return {
      name: cat,
      total,
      scheduledToday,
      presentToday,
    };
  });

  const malamStats = categories.map((cat) => {
    const total = staffShifts.filter((s) => s.category === cat).length;
    const scheduledToday = malamStaff.filter((s) => s.category === cat).length;
    const presentToday = malamStaff.filter((s) => s.category === cat && getStaffLogForDay(s.id)).length;
    return {
      name: cat,
      total,
      scheduledToday,
      presentToday,
    };
  });

  return (
    <div className="space-y-6" id="daily-dashboard-root">
      {/* Summary Stats for the selected day - NOW AT THE TOP (LUXURIOUS DARK GLASS DESIGN) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800 shadow-xl flex items-center justify-between relative overflow-hidden group">
          <div className="absolute top-0 left-0 h-[3px] w-full bg-gradient-to-r from-emerald-500 to-teal-500" />
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-mono">SHIFT PAGI HARI {selectedDay}</span>
            <span className="text-xl font-black text-emerald-400 tracking-tight block mt-1">{activeDayPagiLogCount} / {pagiStaff.length} Masuk</span>
          </div>
          <div className="h-11 w-11 bg-emerald-950/40 text-emerald-400 border border-emerald-800/60 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 shadow-lg font-mono">
            {pagiStaff.length > 0 ? Math.round((activeDayPagiLogCount / pagiStaff.length) * 100) : 0}%
          </div>
        </div>

        <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800 shadow-xl flex items-center justify-between relative overflow-hidden group">
          <div className="absolute top-0 left-0 h-[3px] w-full bg-gradient-to-r from-blue-500 to-indigo-500" />
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-mono">SHIFT MALAM HARI {selectedDay}</span>
            <span className="text-xl font-black text-blue-400 tracking-tight block mt-1">{activeDayMalamLogCount} / {malamStaff.length} Masuk</span>
          </div>
          <div className="h-11 w-11 bg-blue-950/40 text-blue-400 border border-blue-800/60 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 shadow-lg font-mono">
            {malamStaff.length > 0 ? Math.round((activeDayMalamLogCount / malamStaff.length) * 100) : 0}%
          </div>
        </div>
      </div>

      {/* Detail Breakdown per Divisi - SPLIT VIEW WITH COHESIVE CYBER-METALLIC FEEL */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="divisi-breakdown">
        {/* SHIFT PAGI */}
        <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800/60 shadow-xl">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 mb-3">
            <h4 className="text-[11px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1.5 font-mono">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              BREAKDOWN SHIFT PAGI
            </h4>
            <span className="text-[9px] font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-850 px-2 py-0.5 rounded font-mono uppercase">
              {pagiStaff.length} AKTIF
            </span>
          </div>
          <div className="space-y-2">
            {pagiStats.map((stat) => (
              <div key={stat.name} className="flex items-center justify-between text-xs py-1.5 hover:bg-slate-950 rounded px-2 transition-all border border-transparent hover:border-slate-800">
                <span className="font-bold text-slate-400 text-[10px] uppercase tracking-wider font-mono">{stat.name}</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-200 text-[10px] font-mono">{stat.scheduledToday} STAFF</span>
                  <span className="text-[9px] font-bold text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800/80 min-w-[55px] text-center font-mono">
                    {stat.presentToday}/{stat.scheduledToday}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SHIFT MALAM */}
        <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800/60 shadow-xl">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 mb-3">
            <h4 className="text-[11px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-1.5 font-mono">
              <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
              BREAKDOWN SHIFT MALAM
            </h4>
            <span className="text-[9px] font-bold text-blue-400 bg-blue-950/40 border border-blue-850 px-2 py-0.5 rounded font-mono uppercase">
              {malamStaff.length} AKTIF
            </span>
          </div>
          <div className="space-y-2">
            {malamStats.map((stat) => (
              <div key={stat.name} className="flex items-center justify-between text-xs py-1.5 hover:bg-slate-950 rounded px-2 transition-all border border-transparent hover:border-slate-800">
                <span className="font-bold text-slate-400 text-[10px] uppercase tracking-wider font-mono">{stat.name}</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-200 text-[10px] font-mono">{stat.scheduledToday} STAFF</span>
                  <span className="text-[9px] font-bold text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800/80 min-w-[55px] text-center font-mono">
                    {stat.presentToday}/{stat.scheduledToday}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Label and Compact Search Bar right above the Table Container */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mt-4">
        <div className="flex flex-col gap-0.5">
          <div className="text-slate-500 font-black text-[11px] uppercase tracking-widest flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-slate-400" />
            Dashboard Absensi Staff
          </div>
          <p className="text-[10px] text-slate-400">
            Pencet tombol <strong className="text-teal-600 font-black">MASUK</strong> untuk absen instan di jam berjalan saat ini.
          </p>
        </div>

        {/* Live Clock (Compact design for above the table) */}
        <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 self-start md:self-auto shadow-sm">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <Clock className="h-3.5 w-3.5 text-teal-400" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">JAM SEKARANG:</span>
          <span className="font-mono font-black text-sm text-teal-400 tracking-widest">
            {formatTimeStr(simTime)}
          </span>
        </div>
        
        {/* COMPACT SEARCH BOX ON THE RIGHT */}
        <div className="bg-slate-900 p-2 rounded-xl border border-slate-800 shadow-sm flex items-center gap-2 w-full md:max-w-xs shrink-0">
          <div className="flex flex-col gap-0.5 shrink-0 select-none">
            <span className="font-bold text-[9px] uppercase tracking-wider text-slate-300 font-mono">
              🔍 CARI STAFF
            </span>
            {searchTerm.trim() ? (
              <button
                onClick={() => setSearchTerm("")}
                className="text-[8px] font-bold text-rose-400 hover:text-rose-300 transition-colors text-left font-mono"
              >
                [Clear]
              </button>
            ) : (
              <span className="text-[7px] text-slate-500 font-mono">bisa koma/baris</span>
            )}
          </div>
          <textarea
            id="search-staff-textarea"
            rows={1}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Ketik nama staff..."
            className="flex-1 text-[11px] font-mono px-2 py-1 bg-slate-950 text-emerald-400 placeholder-slate-600 border border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 leading-normal resize-none min-h-[30px]"
          />
        </div>
      </div>

      {/* Main Double Column Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 bg-slate-950 p-4 rounded-3xl border-4 border-slate-900 shadow-2xl">
        
        {/* ========================================================= */}
        {/* CENTRAL DECK SELECTOR (STRETCHED OVER BOTH) - ULTRA LUXURIOUS ACCENT BAR */}
        {/* ========================================================= */}
        <div className="xl:col-span-2 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-900 p-1.5 rounded-2xl flex items-center justify-between shadow-2xl text-slate-200 font-bold font-mono select-none border-2 border-orange-500/25">
          {/* Green Block left */}
          <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 text-white px-5 py-2.5 rounded-xl border border-emerald-500/50 text-lg font-black flex items-center justify-center min-w-[65px] shadow-lg shadow-emerald-950/40">
            {filteredPagiStaff.length}
          </div>

          {/* Middle Date Controller */}
          <div className="flex items-center gap-6">
            <button
              onClick={() => handleDayChange("prev")}
              className="p-1.5 rounded-xl bg-slate-800/90 border border-slate-700 hover:bg-slate-700 hover:border-slate-500 active:scale-95 transition-all text-slate-200 cursor-pointer shadow-md"
            >
              <ChevronLeft className="h-5 w-5 stroke-[2.5]" />
            </button>

            <div className="flex flex-col items-center">
              <span className="text-[9px] font-black text-orange-400 uppercase tracking-[0.2em] mb-0.5">ABSENSI TANGGAL</span>
              <span className="text-sm md:text-base uppercase font-black text-slate-100 tracking-wider">
                {selectedDay} {MONTHS_INDONESIAN[selectedMonth]} {selectedYear}
              </span>
            </div>

            <button
              onClick={() => handleDayChange("next")}
              className="p-1.5 rounded-xl bg-slate-800/90 border border-slate-700 hover:bg-slate-700 hover:border-slate-500 active:scale-95 transition-all text-slate-200 cursor-pointer shadow-md"
            >
              <ChevronRight className="h-5 w-5 stroke-[2.5]" />
            </button>
          </div>

          {/* Right Counts */}
          <div className="flex gap-1.5">
            {/* Blue Block right showing Malam count */}
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 text-white px-5 py-2.5 rounded-xl border border-blue-500/50 text-lg font-black flex items-center justify-center min-w-[65px] shadow-lg shadow-blue-950/40">
              {filteredMalamStaff.length}
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* LEFT COLUMN: SHIFT PAGI */}
        {/* ========================================================= */}
        <div className="flex flex-col border-2 border-emerald-950 rounded-2xl overflow-hidden bg-slate-900/40">
          {/* Header 1 */}
          <div className="bg-[#183e2b] border-b border-emerald-800 py-3 text-center">
            <h3 className="text-xl font-black text-emerald-400 uppercase tracking-widest font-mono">
              SHIFT PAGI
            </h3>
            <p className="text-[10px] text-emerald-300 font-bold tracking-widest mt-0.5 uppercase">
              ABSENSI STAFF WDBOS
            </p>
          </div>

          {/* Table Headers */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-900 border-b border-slate-800 text-teal-400 text-[10px] font-black uppercase text-center">
                  <th className="px-2 py-2 text-left border-r border-slate-800">NAMA STAFF</th>
                  <th className="px-1 py-2 w-20 border-r border-slate-800">JAM KERJA</th>
                  <th className="px-1 py-2 w-20 border-r border-slate-800">JAM PULANG</th>
                  <th className="px-1.5 py-2 w-20 border-r border-slate-800">MASUK</th>
                  <th className="px-1.5 py-2 w-24">STATUS</th>
                </tr>
              </thead>
              <tbody>
                {/* Category: CS LINE */}
                {renderStaffGroup(filteredPagiStaff, "CS LINE", "1")}

                {/* Category: CS LC */}
                {renderStaffGroup(filteredPagiStaff, "CS LC", "1")}

                {/* Category: KAPTEN KASIR */}
                {renderStaffGroup(filteredPagiStaff, "KAPTEN KASIR", "1")}

                {/* Category: KASIR */}
                {renderStaffGroup(filteredPagiStaff, "KASIR", "1")}
              </tbody>
            </table>
          </div>
        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: SHIFT MALAM */}
        {/* ========================================================= */}
        <div className="flex flex-col border-2 border-blue-950 rounded-2xl overflow-hidden bg-slate-900/40">
          {/* Header 1 */}
          <div className="bg-[#1a2f4c] border-b border-blue-800 py-3 text-center">
            <h3 className="text-xl font-black text-blue-400 uppercase tracking-widest font-mono">
              SHIFT MALAM
            </h3>
            <p className="text-[10px] text-blue-300 font-bold tracking-widest mt-0.5 uppercase">
              ABSENSI STAFF WDBOS
            </p>
          </div>

          {/* Table Headers */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-900 border-b border-slate-800 text-teal-400 text-[10px] font-black uppercase text-center">
                  <th className="px-2 py-2 text-left border-r border-slate-800">NAMA STAFF</th>
                  <th className="px-1 py-2 w-20 border-r border-slate-800">JAM KERJA</th>
                  <th className="px-1 py-2 w-20 border-r border-slate-800">JAM PULANG</th>
                  <th className="px-1.5 py-2 w-20 border-r border-slate-800">MASUK</th>
                  <th className="px-1.5 py-2 w-24">STATUS</th>
                </tr>
              </thead>
              <tbody>
                {/* Category: CS LINE */}
                {renderStaffGroup(filteredMalamStaff, "CS LINE", "2")}

                {/* Category: CS LC */}
                {renderStaffGroup(filteredMalamStaff, "CS LC", "2")}

                {/* Category: KAPTEN KASIR */}
                {renderStaffGroup(filteredMalamStaff, "KAPTEN KASIR", "2")}

                {/* Category: KASIR */}
                {renderStaffGroup(filteredMalamStaff, "KASIR", "2")}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
