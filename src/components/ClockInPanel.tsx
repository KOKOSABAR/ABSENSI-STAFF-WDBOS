/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { StaffShift, ClockInLog, SHIFT_DETAILS, ShiftType, MONTHS_INDONESIAN } from "../types";
import { Clock, CheckCircle2, AlertTriangle, User, Calendar, Smile, ShieldAlert } from "lucide-react";
import { motion } from "motion/react";

interface ClockInPanelProps {
  staffShifts: StaffShift[];
  onAddLog: (log: Omit<ClockInLog, "id" | "timestamp">) => void;
  logs: ClockInLog[];
  selectedMonth: number;
  selectedYear: number;
  selectedDay: number;
  setSelectedDay: React.Dispatch<React.SetStateAction<number>>;
}

export default function ClockInPanel({
  staffShifts,
  onAddLog,
  logs,
  selectedMonth,
  selectedYear,
  selectedDay,
  setSelectedDay,
}: ClockInPanelProps) {
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [clockInTime, setClockInTime] = useState("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [successStatus, setSuccessStatus] = useState<"ON TIME" | "TERLAMBAT" | "OFF" | null>(null);

  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();

  // Set default current time as string HH:mm:ss
  useEffect(() => {
    const now = new Date();
    const formatTime = (d: Date) => {
      const h = d.getHours().toString().padStart(2, "0");
      const m = d.getMinutes().toString().padStart(2, "0");
      const s = d.getSeconds().toString().padStart(2, "0");
      return `${h}:${m}:${s}`;
    };
    setClockInTime(formatTime(now));
  }, [selectedMonth, selectedYear]);

  const handleGetCurrentTime = () => {
    const now = new Date();
    const h = now.getHours().toString().padStart(2, "0");
    const m = now.getMinutes().toString().padStart(2, "0");
    const s = now.getSeconds().toString().padStart(2, "0");
    setClockInTime(`${h}:${m}:${s}`);
  };

  const selectedStaff = staffShifts.find((s) => s.id === selectedStaffId);
  const scheduledShift = selectedStaff ? (selectedStaff.schedule[selectedDay - 1] as ShiftType) : null;
  const shiftInfo = scheduledShift ? SHIFT_DETAILS[scheduledShift] : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff || !scheduledShift) return;

    // Validate time format HH:mm:ss
    const timeRegex = /^([0-1]\d|2[0-3]):([0-5]\d):([0-5]\d)$/;
    if (!timeRegex.test(clockInTime)) {
      alert("Format jam salah! Harus HH:MM:SS (Contoh: 07:42:15)");
      return;
    }

    // Determine status
    let status: "ON TIME" | "TERLAMBAT" | "OFF DAY" | "CUTI" = "ON TIME";
    if (scheduledShift === "1") {
      status = clockInTime <= "07:45:59" ? "ON TIME" : "TERLAMBAT";
    } else if (scheduledShift === "2") {
      status = clockInTime <= "19:45:59" ? "ON TIME" : "TERLAMBAT";
    } else if (scheduledShift === "OFF") {
      status = "OFF DAY";
    } else if (scheduledShift === "1/2") {
      // 1/2 off day can clock in, usually pagi or on time
      status = "ON TIME";
    } else if (scheduledShift === "CUTI") {
      status = "CUTI";
    }

    onAddLog({
      staffId: selectedStaff.id,
      staffName: selectedStaff.name,
      category: selectedStaff.category,
      day: selectedDay,
      shift: scheduledShift,
      clockInTime,
      status,
    });

    setSuccessStatus(status === "TERLAMBAT" ? "TERLAMBAT" : (status === "OFF DAY" || status === "CUTI" ? "OFF" : "ON TIME"));
    setSuccessMessage(`Berhasil melakukan Absensi Masuk untuk ${selectedStaff.name} pada Tanggal ${selectedDay} ${MONTHS_INDONESIAN[selectedMonth]} ${selectedYear}!`);
    
    // Clear message after 4 seconds
    setTimeout(() => {
      setSuccessMessage(null);
      setSuccessStatus(null);
    }, 4000);
  };

  // Get log for today/selected day to prevent multiple submissions of same day for same staff
  const existingLog = logs.find(l => l.staffId === selectedStaffId && l.day === selectedDay);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="clock-in-panel-container">
      {/* Clock-In Card */}
      <div className="lg:col-span-7 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-2">
            <Clock className="h-5 w-5 text-teal-600" />
            Sistem Ambil Absensi Mandiri (Simulasi)
          </h2>
          <p className="text-xs text-slate-500 mb-6">
            Pilih nama Anda, sesuaikan tanggal di bulan Juli, isikan jam kedatangan Anda, dan sistem akan langsung menentukan apakah Anda terlambat atau tepat waktu.
          </p>

          <form id="clock-in-form" onSubmit={handleSubmit} className="space-y-5">
            {/* Staff Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1">
                <User className="h-3 w-3 text-slate-400" />
                Nama Staff / Karyawan
              </label>
              <select
                id="clock-in-staff-select"
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 text-sm text-slate-800 font-medium focus:ring-2 focus:ring-teal-500 focus:bg-white focus:outline-none transition-all"
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
              >
                <option value="">-- Pilih Nama Staff --</option>
                {staffShifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.category})
                  </option>
                ))}
              </select>
            </div>

            {/* Date Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1">
                <Calendar className="h-3 w-3 text-slate-400" />
                Tanggal {MONTHS_INDONESIAN[selectedMonth]} {selectedYear}
              </label>
              <select
                id="clock-in-day-select"
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 text-sm text-slate-800 font-medium focus:ring-2 focus:ring-teal-500 focus:bg-white focus:outline-none transition-all"
                value={selectedDay}
                onChange={(e) => setSelectedDay(parseInt(e.target.value))}
              >
                {Array.from({ length: daysInMonth }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    Tanggal {i + 1} {MONTHS_INDONESIAN[selectedMonth]} {selectedYear}
                  </option>
                ))}
              </select>
            </div>

            {/* Time Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1">
                <Clock className="h-3 w-3 text-slate-400" />
                Jam Kedatangan (Format HH:MM:SS)
              </label>
              <div className="flex gap-2">
                <input
                  id="clock-in-time-input"
                  type="text"
                  required
                  placeholder="07:42:00"
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 text-sm font-mono text-slate-800 focus:ring-2 focus:ring-teal-500 focus:bg-white focus:outline-none transition-all"
                  value={clockInTime}
                  onChange={(e) => setClockInTime(e.target.value)}
                />
                <button
                  id="get-now-time-btn"
                  type="button"
                  onClick={handleGetCurrentTime}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs px-4 rounded-xl border border-slate-200 transition-colors cursor-pointer"
                >
                  Ambil Jam Sekarang
                </button>
              </div>
            </div>

            {/* Simulated preset quick sliders */}
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/60 space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Setelan Simulasi Jam Cepat:</span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  id="preset-pagi-ontime-btn"
                  type="button"
                  onClick={() => setClockInTime("07:35:12")}
                  className="bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-emerald-200 transition-colors cursor-pointer"
                >
                  Pagi Tepat Waktu (07:35:12)
                </button>
                <button
                  id="preset-pagi-telat-btn"
                  type="button"
                  onClick={() => setClockInTime("07:46:05")}
                  className="bg-rose-100 hover:bg-rose-200 text-rose-800 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-rose-200 transition-colors cursor-pointer"
                >
                  Pagi Terlambat (07:46:05)
                </button>
                <button
                  id="preset-malam-ontime-btn"
                  type="button"
                  onClick={() => setClockInTime("19:38:22")}
                  className="bg-blue-100 hover:bg-blue-200 text-blue-800 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-blue-200 transition-colors cursor-pointer"
                >
                  Malam Tepat Waktu (19:38:22)
                </button>
                <button
                  id="preset-malam-telat-btn"
                  type="button"
                  onClick={() => setClockInTime("19:47:15")}
                  className="bg-rose-100 hover:bg-rose-200 text-rose-800 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-rose-200 transition-colors cursor-pointer"
                >
                  Malam Terlambat (19:47:15)
                </button>
              </div>
            </div>

            {/* Feedback on schedule */}
            {selectedStaff && (
              <div className={`p-4 rounded-xl border ${shipStyle(scheduledShift)}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-bold text-slate-500 block uppercase">Jadwal Terdaftar Anda:</span>
                    <span className="text-sm font-extrabold text-slate-800">
                      {shiftInfo?.label || scheduledShift || "Belum ada jadwal"}
                    </span>
                  </div>
                  {scheduledShift === "1" || scheduledShift === "2" ? (
                    <div className="text-right">
                      <span className="text-xs font-bold text-slate-500 block uppercase">Batas Tepat Waktu:</span>
                      <span className="text-sm font-mono font-extrabold text-slate-800">
                        s/d {scheduledShift === "1" ? "07:45:59" : "19:45:59"}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            {existingLog && (
              <div className="bg-amber-50 text-amber-800 p-3 rounded-xl border border-amber-200 text-xs flex gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Staff sudah melakukan absensi hari ini!</p>
                  <p className="text-[11px] text-amber-700">Terdapat data absensi terdaftar: {existingLog.clockInTime} ({existingLog.status}). Menekan tombol Simpan akan menimpa data absensi sebelumnya.</p>
                </div>
              </div>
            )}

            <button
              id="submit-clock-in-btn"
              type="submit"
              disabled={!selectedStaffId}
              className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm transition-all shadow-md ${
                !selectedStaffId
                  ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200 shadow-none"
                  : "bg-teal-600 text-white hover:bg-teal-700 shadow-teal-100 cursor-pointer"
              }`}
            >
              Simpan Absensi / Clock-In
            </button>
          </form>
        </div>

        {/* Success Alert */}
        {successMessage && (
          <motion.div
            id="success-toast"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-4 p-4 rounded-xl border flex items-start gap-3 ${
              successStatus === "ON TIME"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : successStatus === "TERLAMBAT"
                ? "bg-rose-50 text-rose-800 border-rose-200"
                : "bg-slate-50 text-slate-800 border-slate-200"
            }`}
          >
            {successStatus === "ON TIME" ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            ) : successStatus === "TERLAMBAT" ? (
              <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
            ) : (
              <Smile className="h-5 w-5 text-slate-600 shrink-0" />
            )}
            <div>
              <p className="font-bold text-xs">{successStatus === "ON TIME" ? "Hore! Tepat Waktu" : successStatus === "TERLAMBAT" ? "Aduh! Terlambat" : "Informasi Absensi"}</p>
              <p className="text-[11px] leading-relaxed mt-0.5">{successMessage}</p>
            </div>
          </motion.div>
        )}
      </div>

      {/* Rules and Explanation card */}
      <div className="lg:col-span-5 space-y-6">
        <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-teal-400 uppercase tracking-widest flex items-center gap-1.5">
            <Smile className="h-4 w-4" />
            Aturan Batas Toleransi Jam Kerja
          </h3>
          <div className="space-y-4 text-xs text-slate-300">
            <div className="border-l-2 border-emerald-500 pl-3">
              <p className="font-bold text-white text-xs">SHIFT PAGI (Kode 1):</p>
              <p className="mt-1 font-mono text-[11px]">Batas Masuk: 07:45:00</p>
              <p className="text-slate-400 mt-0.5">Toleransi s/d 07:45:59 (<span className="text-emerald-400">ON TIME</span>)</p>
              <p className="text-slate-400">Masuk &ge; 07:46:00 (<span className="text-rose-400">TERLAMBAT</span>)</p>
            </div>

            <div className="border-l-2 border-blue-500 pl-3">
              <p className="font-bold text-white text-xs">SHIFT MALAM (Kode 2):</p>
              <p className="mt-1 font-mono text-[11px]">Batas Masuk: 19:45:00</p>
              <p className="text-slate-400 mt-0.5">Toleransi s/d 19:45:59 (<span className="text-blue-400">ON TIME</span>)</p>
              <p className="text-slate-400">Masuk &ge; 19:46:00 (<span className="text-rose-400">TERLAMBAT</span>)</p>
            </div>

            <div className="bg-slate-800 p-3 rounded-lg text-slate-400 leading-relaxed border border-slate-700/60">
              Sistem akan memvalidasi kecocokan shift pada tabel spreadsheet dengan input jam kedatangan Anda secara real-time. Jika di spreadsheet tertulis <span className="font-bold text-rose-400">OFF</span> atau <span className="font-bold text-purple-400">CUTI</span>, status log Anda otomatis akan menyesuaikan sebagai libur/cuti.
            </div>
          </div>
        </div>

        {/* Real-time stats preview in clockin panel */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <h4 className="text-xs font-bold text-slate-800 mb-3 uppercase tracking-wider">Log Absensi Hari Ini (Tanggal {selectedDay} {MONTHS_INDONESIAN[selectedMonth]})</h4>
          {logs.filter(l => l.day === selectedDay).length === 0 ? (
            <p className="text-xs text-slate-400 italic py-2">Belum ada staff yang clock-in di Tanggal {selectedDay} {MONTHS_INDONESIAN[selectedMonth]}.</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {logs
                .filter(l => l.day === selectedDay)
                .map((l) => (
                  <div key={l.id} className="flex justify-between items-center text-xs p-2 bg-slate-50 border border-slate-100 rounded-lg">
                    <span className="font-semibold text-slate-700 truncate max-w-[130px]">{l.staffName}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-slate-500 text-[10px]">{l.clockInTime}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-extrabold ${
                        l.status === "ON TIME" ? "bg-emerald-100 text-emerald-800" :
                        l.status === "TERLAMBAT" ? "bg-rose-100 text-rose-800" :
                        "bg-slate-200 text-slate-700"
                      }`}>
                        {l.status}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const shipStyle = (shift: string | null) => {
  if (shift === "1") return "bg-emerald-50 border-emerald-200 text-emerald-800";
  if (shift === "2") return "bg-blue-50 border-blue-200 text-blue-800";
  if (shift === "1/2") return "bg-amber-50 border-amber-200 text-amber-800";
  if (shift === "OFF") return "bg-rose-50 border-rose-200 text-rose-800";
  if (shift === "CUTI") return "bg-purple-50 border-purple-200 text-purple-800";
  return "bg-slate-50 border-slate-200 text-slate-700";
};
