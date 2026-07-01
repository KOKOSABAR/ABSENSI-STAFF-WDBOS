/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { getInitialStaffShifts, getInitialAttendanceLogs } from "./data";
import { StaffShift, ClockInLog, MONTHS_INDONESIAN } from "./types";
import DailyDashboard from "./components/DailyDashboard";
import AttendanceTable from "./components/AttendanceTable";
import ClockInPanel from "./components/ClockInPanel";
import ClockInLogs from "./components/ClockInLogs";
import DashboardStats from "./components/DashboardStats";
import ImportExport from "./components/ImportExport";
import { Grid, Clock, ListTodo, BarChart2, Save, Calendar, RefreshCw, LayoutDashboard, Cloud, CloudOff, CloudLightning, Sun, Moon } from "lucide-react";
import { getGasUrl, syncUpsertLog, syncDeleteLog, fetchDataFromGoogleSheets, syncAllToGoogleSheets, cleanTimeStr } from "./utils/googleSheets";
import DatePicker from "./components/DatePicker";

export default function App() {
  const [activeTab, setActiveTab] = useState<"daily" | "spreadsheet" | "clockin" | "logs" | "stats" | "backup">("daily");

  const [theme, setTheme] = useState<"light" | "black">(() => {
    const saved = localStorage.getItem("absen_theme");
    return (saved === "light" || saved === "black") ? saved : "black";
  });

  useEffect(() => {
    localStorage.setItem("absen_theme", theme);
  }, [theme]);

  const [syncStatus, setSyncStatus] = useState<"synced" | "syncing" | "error" | "unconfigured">(() => {
    return getGasUrl() ? "synced" : "unconfigured";
  });

  const [isPulling, setIsPulling] = useState(false);

  const handlePullData = async (showNotification = true) => {
    if (!getGasUrl()) {
      if (showNotification) alert("URL Google Apps Script belum dikonfigurasi.");
      return;
    }
    setIsPulling(true);
    setSyncStatus("syncing");
    try {
      const result = await fetchDataFromGoogleSheets(selectedMonth, selectedYear);
      if (result.success && result.staffShifts && result.logs) {
        setStaffShifts(result.staffShifts);
        setLogs(result.logs);
        setSyncStatus("synced");
        if (showNotification) alert("Berhasil menarik data terbaru dari Google Sheets!");
      } else {
        setSyncStatus("error");
        if (showNotification) alert(result.message || "Gagal menarik data.");
      }
    } catch (e) {
      setSyncStatus("error");
      if (showNotification) alert("Terjadi kesalahan saat menghubungkan ke Google Sheets.");
    } finally {
      setIsPulling(false);
    }
  };

  const [selectedMonth, setSelectedMonth] = useState<number>(() => {
    return new Date().getMonth();
  });
  
  const [selectedYear, setSelectedYear] = useState<number>(() => {
    return new Date().getFullYear();
  });

  const [selectedDay, setSelectedDay] = useState<number>(() => {
    return new Date().getDate();
  });

  useEffect(() => {
    localStorage.setItem("absen_selected_day", selectedDay.toString());
  }, [selectedDay]);

  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();

  useEffect(() => {
    if (selectedDay > daysInMonth) {
      setSelectedDay(daysInMonth);
    }
  }, [selectedMonth, selectedYear, daysInMonth, selectedDay]);

  // Initial states with lazy initialization from LocalStorage
  const [staffShifts, setStaffShifts] = useState<StaffShift[]>(() => {
    const now = new Date();
    const m = now.getMonth();
    const y = now.getFullYear();
    const key = `absen_staff_shifts_${y}_${m}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse saved staff shifts", e);
      }
    }
    return getInitialStaffShifts();
  });

  const [logs, setLogs] = useState<ClockInLog[]>(() => {
    const saved = localStorage.getItem("absen_logs");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as ClockInLog[];
        // Filter out any legacy sample seed logs and clean up messy time format
        return parsed
          .filter((l) => !l.id.startsWith("seed-log-"))
          .map((l) => ({ ...l, clockInTime: cleanTimeStr(l.clockInTime || "") }));
      } catch (e) {
        console.error("Failed to parse saved attendance logs", e);
      }
    }
    // Seed default logs based on parsed staff list
    const initialShifts = getInitialStaffShifts();
    return getInitialAttendanceLogs(initialShifts);
  });

  // Persist selected month/year
  useEffect(() => {
    localStorage.setItem("absen_selected_month", selectedMonth.toString());
  }, [selectedMonth]);

  useEffect(() => {
    localStorage.setItem("absen_selected_year", selectedYear.toString());
  }, [selectedYear]);

  // Load shifts dynamically when month/year changes
  useEffect(() => {
    let loadedShifts = null;
    const key = `absen_staff_shifts_${selectedYear}_${selectedMonth}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        loadedShifts = JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse saved staff shifts", e);
      }
    }
    // Fallback migration check for July 2026
    if (!loadedShifts && selectedMonth === 6 && selectedYear === 2026) {
      const oldSaved = localStorage.getItem("absen_staff_shifts");
      if (oldSaved) {
        try {
          loadedShifts = JSON.parse(oldSaved);
        } catch (e) {}
      }
    }
    
    if (loadedShifts) {
      setStaffShifts(loadedShifts);
    } else {
      // Generate fresh seeded shifts for this month
      setStaffShifts(getInitialStaffShifts());
    }

    // Background sync from Google Sheets if configured
    if (getGasUrl()) {
      handlePullData(false);
    }
  }, [selectedMonth, selectedYear]);

  // Sync shifts to local storage
  useEffect(() => {
    const key = `absen_staff_shifts_${selectedYear}_${selectedMonth}`;
    localStorage.setItem(key, JSON.stringify(staffShifts));
    localStorage.setItem("absen_staff_shifts", JSON.stringify(staffShifts));
  }, [staffShifts, selectedMonth, selectedYear]);

  // Periodic silent background sync (every 10 seconds) to sync other clients
  useEffect(() => {
    const url = getGasUrl();
    if (!url) return;

    const interval = setInterval(() => {
      fetchDataFromGoogleSheets(selectedMonth, selectedYear)
        .then((result) => {
          if (result.success && result.staffShifts && result.logs) {
            setStaffShifts(result.staffShifts);
            setLogs(result.logs);
            setSyncStatus("synced");
          }
        })
        .catch((err) => {
          console.error("Silent sync failed", err);
        });
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, [selectedMonth, selectedYear]);

  // Sync logs to local storage
  useEffect(() => {
    localStorage.setItem("absen_logs", JSON.stringify(logs));
  }, [logs]);

  // Handlers
  const handleUpdateSchedule = (staffId: string, dayIndex: number, newValue: string) => {
    const updated = staffShifts.map((staff) => {
      if (staff.id === staffId) {
        const updatedSchedule = [...staff.schedule];
        updatedSchedule[dayIndex] = newValue;
        return { ...staff, schedule: updatedSchedule };
      }
      return staff;
    });
    setStaffShifts(updated);

    // Kirim otomatis ke Google Sheets
    if (getGasUrl()) {
      setSyncStatus("syncing");
      syncAllToGoogleSheets(updated, logs, selectedMonth, selectedYear)
        .then((res) => setSyncStatus(res.success ? "synced" : "error"))
        .catch(() => setSyncStatus("error"));
    }
  };

  const handleAddStaff = (name: string, category: "CS LINE" | "CS LC" | "KAPTEN KASIR" | "KASIR") => {
    const newId = `custom-staff-${Date.now()}-${name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const defaultSchedule = Array(daysInMonth).fill("1");
    
    const newStaff: StaffShift = {
      id: newId,
      name,
      category,
      schedule: defaultSchedule,
    };

    const updated = [...staffShifts, newStaff];
    setStaffShifts(updated);

    // Kirim otomatis ke Google Sheets
    if (getGasUrl()) {
      setSyncStatus("syncing");
      syncAllToGoogleSheets(updated, logs, selectedMonth, selectedYear)
        .then((res) => setSyncStatus(res.success ? "synced" : "error"))
        .catch(() => setSyncStatus("error"));
    }
  };

  const handleDeleteStaff = (staffId: string) => {
    const updatedShifts = staffShifts.filter((s) => s.id !== staffId);
    const updatedLogs = logs.filter((l) => l.staffId !== staffId);
    setStaffShifts(updatedShifts);
    setLogs(updatedLogs);

    // Kirim otomatis ke Google Sheets
    if (getGasUrl()) {
      setSyncStatus("syncing");
      syncAllToGoogleSheets(updatedShifts, updatedLogs, selectedMonth, selectedYear)
        .then((res) => setSyncStatus(res.success ? "synced" : "error"))
        .catch(() => setSyncStatus("error"));
    }
  };

  const handleAddLog = (newLogData: Omit<ClockInLog, "id" | "timestamp">) => {
    const newLog: ClockInLog = {
      ...newLogData,
      id: `log-${Date.now()}-${newLogData.staffId}`,
      timestamp: new Date().toISOString(),
      month: selectedMonth,
      year: selectedYear,
    };

    setLogs((prev) => {
      // If there's an existing log for the same staff member on the same day in the same month & year, replace it
      const filtered = prev.filter(
        (l) => !(l.staffId === newLogData.staffId && l.day === newLogData.day && (l.month === undefined || l.month === selectedMonth) && (l.year === undefined || l.year === selectedYear))
      );
      return [newLog, ...filtered];
    });

    // KIRIM OTOMATIS KE GOOGLE SHEETS
    if (getGasUrl()) {
      setSyncStatus("syncing");
      syncUpsertLog(newLog, selectedMonth, selectedYear)
        .then((success) => {
          setSyncStatus(success ? "synced" : "error");
        })
        .catch(() => setSyncStatus("error"));
    }
  };

  const handleDeleteLog = (logId: string) => {
    setLogs((prev) => prev.filter((l) => l.id !== logId));

    // HAPUS OTOMATIS DARI GOOGLE SHEETS
    if (getGasUrl()) {
      setSyncStatus("syncing");
      syncDeleteLog(logId)
        .then((success) => {
          setSyncStatus(success ? "synced" : "error");
        })
        .catch(() => setSyncStatus("error"));
    }
  };

  const handleClearAllLogs = () => {
    setLogs([]);

    // Kirim otomatis ke Google Sheets
    if (getGasUrl()) {
      setSyncStatus("syncing");
      syncAllToGoogleSheets(staffShifts, [], selectedMonth, selectedYear)
        .then((res) => setSyncStatus(res.success ? "synced" : "error"))
        .catch(() => setSyncStatus("error"));
    }
  };

  const handleResetToDefault = () => {
    const key = `absen_staff_shifts_${selectedYear}_${selectedMonth}`;
    localStorage.removeItem(key);
    localStorage.removeItem("absen_staff_shifts");
    localStorage.removeItem("absen_logs");
    const defaults = getInitialStaffShifts();
    setStaffShifts(defaults);
    const seeded = getInitialAttendanceLogs(defaults).map(l => ({
      ...l,
      month: selectedMonth,
      year: selectedYear
    }));
    setLogs(seeded);

    // Kirim otomatis ke Google Sheets
    if (getGasUrl()) {
      setSyncStatus("syncing");
      syncAllToGoogleSheets(defaults, seeded, selectedMonth, selectedYear)
        .then((res) => setSyncStatus(res.success ? "synced" : "error"))
        .catch(() => setSyncStatus("error"));
    }
  };

  const handleImportState = (newState: { staffShifts: StaffShift[]; logs: ClockInLog[] }) => {
    setStaffShifts(newState.staffShifts);
    setLogs(newState.logs);

    // Kirim otomatis ke Google Sheets
    if (getGasUrl()) {
      setSyncStatus("syncing");
      syncAllToGoogleSheets(newState.staffShifts, newState.logs, selectedMonth, selectedYear)
        .then((res) => setSyncStatus(res.success ? "synced" : "error"))
        .catch(() => setSyncStatus("error"));
    }
  };

  const handleImportParsedShifts = (parsed: StaffShift[], mode: "merge" | "overwrite") => {
    let updated: StaffShift[];
    if (mode === "overwrite") {
      updated = parsed;
    } else {
      updated = [...staffShifts];
      parsed.forEach((newStaff) => {
        const existingIdx = updated.findIndex(
          (s) => s.name.trim().toUpperCase() === newStaff.name.trim().toUpperCase()
        );
        if (existingIdx !== -1) {
          updated[existingIdx] = {
            ...updated[existingIdx],
            category: newStaff.category,
            schedule: newStaff.schedule,
          };
        } else {
          updated.push(newStaff);
        }
      });
    }
    setStaffShifts(updated);

    // Kirim otomatis ke Google Sheets
    if (getGasUrl()) {
      setSyncStatus("syncing");
      syncAllToGoogleSheets(updated, logs, selectedMonth, selectedYear)
        .then((res) => setSyncStatus(res.success ? "synced" : "error"))
        .catch(() => setSyncStatus("error"));
    }
  };

  return (
    <div className={`min-h-screen ${theme === "light" ? "bg-slate-50 text-slate-900 theme-light" : "bg-[#070b13] text-slate-100 theme-black"} flex flex-col font-sans relative overflow-x-hidden`} id="app-root">
      {/* Abstract luxury ambient glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>

      {/* Top Banner / System Title */}
      <header className="bg-slate-950/80 border-b border-slate-900 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-3.5">
              <div className="h-11 w-11 bg-gradient-to-br from-teal-500 to-emerald-500 rounded-2xl flex items-center justify-center text-slate-950 font-black text-lg shadow-lg shadow-teal-500/20 transform hover:scale-105 transition-transform">
                W
              </div>
              <div>
                <h1 className="text-sm sm:text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-100 via-slate-200 to-teal-400 tracking-wider font-mono">
                  DASHBOARD ABSENSI STAFF
                </h1>
                <p className="text-[9px] sm:text-[10px] font-black text-teal-400/80 tracking-widest uppercase font-mono">
                  SISTEM INFORMASI & MANAJEMEN SHIFT KERJA (REAL-TIME)
                </p>
              </div>
            </div>

            {/* Google Sheets Sync Status Indicator */}
            <div className="flex items-center gap-2.5">
              {syncStatus === "synced" && (
                <div className="flex items-center gap-2 bg-emerald-950/50 border border-emerald-500/40 text-emerald-400 text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-xl shadow-lg shadow-emerald-950/30">
                  <Cloud className="h-4 w-4 text-emerald-400 animate-pulse shrink-0" />
                  <span className="hidden md:inline">SINKRON: SHEET AKTIF</span>
                  <span className="md:hidden">SINKRON</span>
                </div>
              )}
              {syncStatus === "syncing" && (
                <div className="flex items-center gap-2 bg-amber-950/50 border border-amber-500/40 text-amber-400 text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-xl shadow-lg shadow-amber-950/30">
                  <CloudLightning className="h-4 w-4 text-amber-400 animate-spin shrink-0" />
                  <span>SINKRONISASI...</span>
                </div>
              )}
              {syncStatus === "error" && (
                <div className="flex items-center gap-2 bg-rose-950/50 border border-rose-500/40 text-rose-400 text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-xl shadow-lg shadow-rose-950/30">
                  <CloudOff className="h-4 w-4 text-rose-400 shrink-0" />
                  <span>SINKRON GAGAL</span>
                </div>
              )}
              {syncStatus === "unconfigured" && (
                <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-850 text-slate-500 text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-xl">
                  <CloudOff className="h-4 w-4 text-slate-600 shrink-0" />
                  <span>BELUM DISET</span>
                </div>
              )}

              {/* Refresh / Pull Button */}
              {getGasUrl() && (
                <button
                  id="sync-pull-btn"
                  onClick={() => handlePullData(true)}
                  disabled={isPulling}
                  className={`flex items-center justify-center p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-teal-400 cursor-pointer transition-all shadow-md active:scale-95 ${
                    isPulling ? "opacity-60" : ""
                  }`}
                  title="Tarik Data Terbaru dari Google Sheets"
                >
                  <RefreshCw className={`h-4 w-4 ${isPulling ? "animate-spin" : ""}`} />
                </button>
              )}

              {/* Current Active Period Info (Using Custom DatePicker) */}
              <div className="flex items-center gap-2" id="header-custom-datepicker-wrapper">
                <DatePicker
                  selectedDay={selectedDay}
                  selectedMonth={selectedMonth}
                  selectedYear={selectedYear}
                  onChange={(d, m, y) => {
                    setSelectedDay(d);
                    setSelectedMonth(m);
                    setSelectedYear(y);
                  }}
                  theme={theme}
                />
              </div>

              {/* Theme Selector Toggle Button */}
              <button
                id="theme-toggle-btn"
                onClick={() => setTheme(theme === "light" ? "black" : "light")}
                className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl px-3.5 py-1.5 text-xs font-black tracking-wider uppercase transition-all cursor-pointer text-teal-400 shadow-lg font-mono"
                title={theme === "light" ? "Ganti ke Tema Black" : "Ganti ke Tema Light"}
              >
                {theme === "light" ? (
                  <>
                    <Moon className="h-4 w-4 text-teal-400 shrink-0" />
                    <span className="hidden sm:inline">BLACK</span>
                  </>
                ) : (
                  <>
                    <Sun className="h-4 w-4 text-teal-400 shrink-0" />
                    <span className="hidden sm:inline">LIGHT</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Tab Navigation */}
      <div className="bg-slate-950/40 border-b border-slate-900/60 shadow-2xl sticky top-20 z-30 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex overflow-x-auto gap-1.5 py-3.5 scrollbar-none">
            <button
              id="tab-daily-btn"
              onClick={() => setActiveTab("daily")}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black tracking-wider uppercase transition-all whitespace-nowrap cursor-pointer border ${
                activeTab === "daily"
                  ? "bg-gradient-to-br from-teal-500/15 to-emerald-500/10 text-teal-300 shadow-md border-teal-500/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/40 border-transparent"
              }`}
            >
              <LayoutDashboard className="h-4 w-4 text-teal-500 shrink-0" />
              DASHBOARD ABSENSI HARIAN (WDBOS)
            </button>

            <button
              id="tab-spreadsheet-btn"
              onClick={() => setActiveTab("spreadsheet")}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black tracking-wider uppercase transition-all whitespace-nowrap cursor-pointer border ${
                activeTab === "spreadsheet"
                  ? "bg-gradient-to-br from-teal-500/15 to-emerald-500/10 text-teal-300 shadow-md border-teal-500/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/40 border-transparent"
              }`}
            >
              <Grid className="h-4 w-4 text-teal-500 shrink-0" />
              TABEL SHIFT (SPREADSHEET)
            </button>

            <button
              id="tab-clockin-btn"
              onClick={() => setActiveTab("clockin")}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black tracking-wider uppercase transition-all whitespace-nowrap cursor-pointer border ${
                activeTab === "clockin"
                  ? "bg-gradient-to-br from-teal-500/15 to-emerald-500/10 text-teal-300 shadow-md border-teal-500/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/40 border-transparent"
              }`}
            >
              <Clock className="h-4 w-4 text-teal-500 shrink-0" />
              CLOCK-IN MANDIRI (SIMULASI)
            </button>

            <button
              id="tab-logs-btn"
              onClick={() => setActiveTab("logs")}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black tracking-wider uppercase transition-all whitespace-nowrap cursor-pointer border ${
                activeTab === "logs"
                  ? "bg-gradient-to-br from-teal-500/15 to-emerald-500/10 text-teal-300 shadow-md border-teal-500/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/40 border-transparent"
              }`}
            >
              <ListTodo className="h-4 w-4 text-teal-500 shrink-0" />
              LOG KEHADIRAN ({logs.filter(l => (l.month !== undefined ? l.month : 6) === selectedMonth && (l.year !== undefined ? l.year : 2026) === selectedYear).length})
            </button>

            <button
              id="tab-stats-btn"
              onClick={() => setActiveTab("stats")}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black tracking-wider uppercase transition-all whitespace-nowrap cursor-pointer border ${
                activeTab === "stats"
                  ? "bg-gradient-to-br from-teal-500/15 to-emerald-500/10 text-teal-300 shadow-md border-teal-500/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/40 border-transparent"
              }`}
            >
              <BarChart2 className="h-4 w-4 text-teal-500 shrink-0" />
              ANALISIS & STATISTIK
            </button>

            <button
              id="tab-backup-btn"
              onClick={() => setActiveTab("backup")}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black tracking-wider uppercase transition-all whitespace-nowrap cursor-pointer border ${
                activeTab === "backup"
                  ? "bg-gradient-to-br from-teal-500/15 to-emerald-500/10 text-teal-300 shadow-md border-teal-500/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/40 border-transparent"
              }`}
            >
              <Save className="h-4 w-4 text-teal-500 shrink-0" />
              EKSPOR / BACKUP
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        {(() => {
          const activeLogs = logs.filter((l) => {
            const logMonth = l.month !== undefined ? l.month : 6;
            const logYear = l.year !== undefined ? l.year : 2026;
            return logMonth === selectedMonth && logYear === selectedYear;
          });

          return (
            <>
              {activeTab === "daily" && (
                <div className="space-y-6">
                  <div className="border-l-4 border-teal-505 pl-4 py-1 bg-slate-900/30 rounded-r-2xl pr-4 border border-slate-900/50 backdrop-blur-sm">
                    <h2 className="text-lg sm:text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-100 to-teal-400 tracking-wider font-mono">DASHBOARD ABSENSI HARIAN (WDBOS)</h2>
                    <p className="text-[10px] text-slate-400 font-mono mt-1 font-bold">
                      VISUALISASI SPLIT SHIFT PAGI & MALAM SESUAI DENGAN TAMPILAN PRESENSI WDBOS. SILAKAN KLIK TOMBOL <strong className="text-teal-400">MASUK</strong> UNTUK MELAKUKAN ABSEN INSTAN.
                    </p>
                  </div>
                  <DailyDashboard
                    staffShifts={staffShifts}
                    logs={activeLogs}
                    onAddLog={handleAddLog}
                    onDeleteLog={handleDeleteLog}
                    selectedMonth={selectedMonth}
                    selectedYear={selectedYear}
                    selectedDay={selectedDay}
                    setSelectedDay={setSelectedDay}
                  />
                </div>
              )}
 
              {activeTab === "spreadsheet" && (
                <div className="space-y-6">
                  <div className="border-l-4 border-teal-505 pl-4 py-1 bg-slate-900/30 rounded-r-2xl pr-4 border border-slate-900/50 backdrop-blur-sm">
                    <h2 className="text-lg sm:text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-100 to-teal-400 tracking-wider font-mono">TABEL JADWAL SHIFT KERJA</h2>
                    <p className="text-[10px] text-slate-400 font-mono mt-1 font-bold">
                      REPRESENTASI SPREADSHEET SHIFT KERJA STAFF DIVISI CS LINE, CS LC, KAPTEN KASIR, DAN KASIR SEPANJANG BULAN {MONTHS_INDONESIAN[selectedMonth]} {selectedYear}.
                    </p>
                  </div>
                  <AttendanceTable
                    staffShifts={staffShifts}
                    onUpdateSchedule={handleUpdateSchedule}
                    onAddStaff={handleAddStaff}
                    onDeleteStaff={handleDeleteStaff}
                    onImportParsedShifts={handleImportParsedShifts}
                    selectedMonth={selectedMonth}
                    selectedYear={selectedYear}
                    selectedDay={selectedDay}
                    setSelectedDay={setSelectedDay}
                  />
                </div>
              )}
 
              {activeTab === "clockin" && (
                <div className="space-y-6">
                  <div className="border-l-4 border-teal-505 pl-4 py-1 bg-slate-900/30 rounded-r-2xl pr-4 border border-slate-900/50 backdrop-blur-sm">
                    <h2 className="text-lg sm:text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-100 to-teal-400 tracking-wider font-mono">PRESENSI KEHADIRAN STAFF</h2>
                    <p className="text-[10px] text-slate-400 font-mono mt-1 font-bold">
                      LAKUKAN PENCATATAN ABSEN KEDATANGAN SECARA MANDIRI DENGAN MENGECEK JADWAL ANDA HARI INI.
                    </p>
                  </div>
                  <ClockInPanel
                    staffShifts={staffShifts}
                    onAddLog={handleAddLog}
                    logs={activeLogs}
                    selectedMonth={selectedMonth}
                    selectedYear={selectedYear}
                    selectedDay={selectedDay}
                    setSelectedDay={setSelectedDay}
                  />
                </div>
              )}

              {activeTab === "logs" && (
                <div className="space-y-6">
                  <div className="border-l-4 border-teal-505 pl-4 py-1 bg-slate-900/30 rounded-r-2xl pr-4 border border-slate-900/50 backdrop-blur-sm">
                    <h2 className="text-lg sm:text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-100 to-teal-400 tracking-wider font-mono">LOG RIWAYAT KEDATANGAN</h2>
                    <p className="text-[10px] text-slate-400 font-mono mt-1 font-bold">
                      DATA REAL-TIME KEHADIRAN KARYAWAN LENGKAP DENGAN STATUS KETEPATAN WAKTU.
                    </p>
                  </div>
                  <ClockInLogs
                    logs={activeLogs}
                    onDeleteLog={handleDeleteLog}
                    onClearAllLogs={handleClearAllLogs}
                    selectedMonth={selectedMonth}
                    selectedYear={selectedYear}
                  />
                </div>
              )}

              {activeTab === "stats" && (
                <div className="space-y-6">
                  <div className="border-l-4 border-teal-505 pl-4 py-1 bg-slate-900/30 rounded-r-2xl pr-4 border border-slate-900/50 backdrop-blur-sm">
                    <h2 className="text-lg sm:text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-100 to-teal-400 tracking-wider font-mono">STATISTIK KEHADIRAN & SHIFT</h2>
                    <p className="text-[10px] text-slate-400 font-mono mt-1 font-bold">
                      VISUALISASI KETERLAMBATAN, DISTRIBUSI SHIFT, DAN PERSENTASE DISIPLIN STAFF KERJA SEBULAN.
                    </p>
                  </div>
                  <DashboardStats
                    staffShifts={staffShifts}
                    logs={activeLogs}
                    selectedMonth={selectedMonth}
                    selectedYear={selectedYear}
                  />
                </div>
              )}

              {activeTab === "backup" && (
                <div className="space-y-6">
                  <div className="border-l-4 border-teal-505 pl-4 py-1 bg-slate-900/30 rounded-r-2xl pr-4 border border-slate-900/50 backdrop-blur-sm">
                    <h2 className="text-lg sm:text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-100 to-teal-400 tracking-wider font-mono">INTEGRASI & BACKUP SPREADSHEET</h2>
                    <p className="text-[10px] text-slate-400 font-mono mt-1 font-bold">
                      SIMPAN, BACKUP, EKSPOR KE CSV, ATAU SALIN DATA ANDA UNTUK KEMUDAHAN PELAPORAN DI APLIKASI EKSTERNAL.
                    </p>
                  </div>
                  <ImportExport
                    staffShifts={staffShifts}
                    logs={activeLogs}
                    onResetToDefault={handleResetToDefault}
                    onImportState={handleImportState}
                    selectedMonth={selectedMonth}
                    selectedYear={selectedYear}
                    syncStatus={syncStatus}
                    setSyncStatus={setSyncStatus}
                  />
                </div>
              )}
            </>
          );
        })()}
      </main>

      {/* Footer */}
      <footer className="bg-slate-950/60 border-t border-slate-900 py-8 text-center text-xs text-slate-500 mt-auto backdrop-blur-sm relative z-10">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="font-mono tracking-wide">&copy; 2026 DASHBOARD ABSENSI STAFF. ALL RIGHTS RESERVED.</span>
          <span className="font-mono text-[10px] bg-slate-900 border border-slate-800/80 rounded-lg px-3 py-1.5 text-teal-400 shadow-md">
            PAGI: 07:45:00 - 19:45:00 | MALAM: 19:45:00 - 07:45:00
          </span>
        </div>
      </footer>
    </div>
  );
}
