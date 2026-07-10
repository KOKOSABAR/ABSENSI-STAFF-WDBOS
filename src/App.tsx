/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { getInitialStaffShifts, getInitialAttendanceLogs } from "./data";
import { StaffShift, ClockInLog, MONTHS_INDONESIAN, PassportHandoverRecord, MasterPassport, CustomOfficer } from "./types";
import DailyDashboard from "./components/DailyDashboard";
import AttendanceTable from "./components/AttendanceTable";
import ClockInPanel from "./components/ClockInPanel";
import ClockInLogs from "./components/ClockInLogs";
import DashboardStats from "./components/DashboardStats";
import ImportExport from "./components/ImportExport";
import PassportHandover from "./components/PassportHandover";
import { Grid, Clock, ListTodo, BarChart2, Save, Calendar, RefreshCw, LayoutDashboard, Cloud, CloudOff, CloudLightning, Lock, ShieldAlert, Fingerprint } from "lucide-react";
import { getGasUrl, syncUpsertLog, syncDeleteLog, fetchDataFromGoogleSheets, syncAllToGoogleSheets, syncUpsertPassport, syncDeletePassport, syncScheduleToGoogleSheets, cleanTimeStr } from "./utils/googleSheets";
import DatePicker from "./components/DatePicker";

export default function App() {
  const VALID_TABS = ["daily", "spreadsheet", "clockin", "logs", "stats", "backup", "passport"] as const;
  type TabType = typeof VALID_TABS[number];

  const [activeTab, setActiveTabRaw] = useState<TabType>(() => {
    const saved = sessionStorage.getItem("absen_active_tab") as TabType | null;
    return saved && (VALID_TABS as readonly string[]).includes(saved) ? saved : "daily";
  });

  const setActiveTab = (tab: TabType) => {
    sessionStorage.setItem("absen_active_tab", tab);
    setActiveTabRaw(tab);
    // Saat buka tab passport, langsung pull data terbaru dari GAS agar selalu sinkron
    if (tab === "passport" && getGasUrl()) {
      setTimeout(() => handlePullData(false), 300);
    }
  };

  // Track whether the passport tab password has been entered this session
  const passportUnlocked = sessionStorage.getItem("absen_passport_unlocked") === "true";

  // Keep track of the timestamp of the last local write/mutation to prevent the background silent sync
  // from overwriting the React state with stale data from the spreadsheet before the write finishes.
  const lastWriteTimeRef = useRef<number>(0);

  const recordLocalWrite = useCallback(() => {
    lastWriteTimeRef.current = Date.now();
  }, []);

  // Timer ref for the post-write verification pull
  const pendingPullTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Timer ref for debouncing schedule sync to Google Sheets
  const scheduleSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (scheduleSyncTimeoutRef.current) {
        clearTimeout(scheduleSyncTimeoutRef.current);
      }
    };
  }, []);

  // Theme locked to black (dark mode)
  const theme = "black";

  // Custom luxury password modal state
  const [passwordModal, setPasswordModal] = useState<{
    isOpen: boolean;
    title: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    onConfirm: () => {},
  });
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // Store onConfirm in a ref so updating it never triggers a re-render of the modal
  const passwordOnConfirmRef = useRef<() => void>(() => {});

  const requestPassword = useCallback((title: string, onConfirm: () => void) => {
    passwordOnConfirmRef.current = onConfirm;
    setPasswordInput("");
    setPasswordError("");
    setPasswordModal({
      isOpen: true,
      title,
      onConfirm, // kept in state only for display; actual call uses ref
    });
  }, []);

  const handlePasswordSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === "wdbos88") {
      passwordOnConfirmRef.current();
      setPasswordModal((prev) => ({ ...prev, isOpen: false }));
    } else {
      setPasswordError("PASSWORD SALAH! AKSES DITOLAK.");
    }
  }, [passwordInput]);

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
      if (result.success) {
        if (result.staffShifts) {
          setStaffShifts(result.staffShifts);
        }
        if (result.logs) {
          setLogs(result.logs);
        }
        if (result.passports) {
          setPassportRecords(result.passports);
        }
        if (result.masterPassports) {
          setMasterPassports(result.masterPassports);
        }
        if (result.officers) {
          setCustomOfficers(result.officers);
        }
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
    const t = setTimeout(() => {
      localStorage.setItem("absen_selected_day", selectedDay.toString());
    }, 400);
    return () => clearTimeout(t);
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

  const [passportRecords, setPassportRecords] = useState<PassportHandoverRecord[]>(() => {
    const saved = localStorage.getItem("absen_passport_records");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse saved passport records", e);
      }
    }
    return [];
  });

  const [masterPassports, setMasterPassports] = useState<MasterPassport[]>([]);
  const [customOfficers, setCustomOfficers] = useState<CustomOfficer[]>([]);

  useEffect(() => {
    const t = setTimeout(() => {
      localStorage.setItem("absen_passport_records", JSON.stringify(passportRecords));
    }, 400);
    return () => clearTimeout(t);
  }, [passportRecords]);

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

  // Sync shifts to local storage (debounced 400ms to avoid blocking UI)
  useEffect(() => {
    const key = `absen_staff_shifts_${selectedYear}_${selectedMonth}`;
    const t = setTimeout(() => {
      localStorage.setItem(key, JSON.stringify(staffShifts));
      localStorage.setItem("absen_staff_shifts", JSON.stringify(staffShifts));
    }, 400);
    return () => clearTimeout(t);
  }, [staffShifts, selectedMonth, selectedYear]);

  // Periodic silent background sync (every 10 seconds) to sync other clients
  useEffect(() => {
    const url = getGasUrl();
    if (!url) return;

    const interval = setInterval(() => {
      // Skip silent sync if a local write occurred in the last 15 seconds
      if (Date.now() - lastWriteTimeRef.current < 15000) {
        console.log("Skipping silent sync: local write in progress or completed recently.");
        return;
      }

      fetchDataFromGoogleSheets(selectedMonth, selectedYear)
        .then((result) => {
          if (result.success) {
            // Also check if a local write occurred during the async fetch call
            if (Date.now() - lastWriteTimeRef.current < 15000) {
              console.log("Skipping applying silent sync: local write occurred during fetch.");
              return;
            }
            if (result.staffShifts) {
              setStaffShifts(result.staffShifts);
            }
            if (result.logs) {
              setLogs(result.logs);
            }
            if (result.passports) {
              setPassportRecords(result.passports);
            }
            if (result.masterPassports) {
              setMasterPassports(result.masterPassports);
            }
            if (result.officers) {
              setCustomOfficers(result.officers);
            }
            setSyncStatus("synced");
          }
        })
        .catch((err) => {
          console.error("Silent sync failed", err);
        });
    }, 30000); // 30 seconds — cukup sering tanpa bersaing dengan aksi user

    return () => clearInterval(interval);
  }, [selectedMonth, selectedYear]);

  // Sync logs to local storage (debounced 400ms)
  useEffect(() => {
    const t = setTimeout(() => {
      localStorage.setItem("absen_logs", JSON.stringify(logs));
    }, 400);
    return () => clearTimeout(t);
  }, [logs]);

  const handleAddPassport = (newRecordData: Omit<PassportHandoverRecord, "id">) => {
    recordLocalWrite();
    const newRecord: PassportHandoverRecord = {
      id: `ppt-${Date.now()}`,
      ...newRecordData,
    };
    setPassportRecords((prev) => [newRecord, ...prev]);

    // Kirim langsung ke Google Sheets (Sangat Cepat & Efisien karena single-row update)
    if (getGasUrl()) {
      setSyncStatus("syncing");
      syncUpsertPassport(newRecord)
        .then((ok) => setSyncStatus(ok ? "synced" : "error"))
        .catch(() => setSyncStatus("error"));
    }
  };

  const handleUpdatePassport = (updatedRecord: PassportHandoverRecord) => {
    recordLocalWrite();
    setPassportRecords((prev) =>
      prev.map((r) => (r.id === updatedRecord.id ? updatedRecord : r))
    );

    // Kirim langsung ke Google Sheets (Sangat Cepat & Efisien)
    if (getGasUrl()) {
      setSyncStatus("syncing");
      syncUpsertPassport(updatedRecord)
        .then((ok) => setSyncStatus(ok ? "synced" : "error"))
        .catch(() => setSyncStatus("error"));
    }
  };

  const handleDeletePassport = (id: string) => {
    requestPassword("MASUKKAN PASSWORD UNTUK MENGHAPUS DATA SERAH TERIMA PASPOR:", () => {
      recordLocalWrite();
      setPassportRecords((prev) => prev.filter((r) => r.id !== id));

      // Hapus langsung dari Google Sheets (Sangat Cepat & Efisien)
      if (getGasUrl()) {
        setSyncStatus("syncing");
        syncDeletePassport(id)
          .then((ok) => setSyncStatus(ok ? "synced" : "error"))
          .catch(() => setSyncStatus("error"));
      }
    });
  };

  const debouncedSyncSchedule = useCallback((shifts: StaffShift[], month: number, year: number) => {
    if (scheduleSyncTimeoutRef.current) {
      clearTimeout(scheduleSyncTimeoutRef.current);
    }
    setSyncStatus("syncing");
    scheduleSyncTimeoutRef.current = setTimeout(() => {
      syncScheduleToGoogleSheets(shifts, month, year)
        .then((ok) => setSyncStatus(ok ? "synced" : "error"))
        .catch(() => setSyncStatus("error"));
    }, 2000);
  }, []);

  const handleUpdateSchedule = (staffId: string, dayIndex: number, newValue: string) => {
    recordLocalWrite();
    const updated = staffShifts.map((staff) => {
      if (staff.id === staffId) {
        const updatedSchedule = [...staff.schedule];
        updatedSchedule[dayIndex] = newValue;
        return { ...staff, schedule: updatedSchedule };
      }
      return staff;
    });
    setStaffShifts(updated);

    // Kirim cepat khusus jadwal ke Google Sheets (menggunakan debounce agar responsif)
    if (getGasUrl()) {
      debouncedSyncSchedule(updated, selectedMonth, selectedYear);
    }
  };

  const handleAddStaff = (name: string, category: "CS LINE" | "CS LC" | "KAPTEN KASIR" | "KASIR") => {
    recordLocalWrite();
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

    // Kirim cepat khusus jadwal ke Google Sheets (menggunakan debounce)
    if (getGasUrl()) {
      debouncedSyncSchedule(updated, selectedMonth, selectedYear);
    }
  };

  const handleDeleteStaff = (staffId: string) => {
    requestPassword("MASUKKAN PASSWORD UNTUK MENGHAPUS STAFF:", () => {
      recordLocalWrite();
      const updatedShifts = staffShifts.filter((s) => s.id !== staffId);
      const updatedLogs = logs.filter((l) => l.staffId !== staffId);
      setStaffShifts(updatedShifts);
      setLogs(updatedLogs);

      // Kirim otomatis ke Google Sheets
      if (getGasUrl()) {
        setSyncStatus("syncing");
        syncAllToGoogleSheets(updatedShifts, updatedLogs, passportRecords, selectedMonth, selectedYear)
          .then((res) => setSyncStatus(res.success ? "synced" : "error"))
          .catch(() => setSyncStatus("error"));
      }
    });
  };

  const handleAddLog = (newLogData: Omit<ClockInLog, "id" | "timestamp">) => {
    recordLocalWrite();
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
    requestPassword("MASUKKAN PASSWORD UNTUK MENGHAPUS LOG ABSENSI:", () => {
      recordLocalWrite();
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
    });
  };

  const handleClearAllLogs = () => {
    requestPassword("MASUKKAN PASSWORD UNTUK MENGHAPUS SEMUA LOG ABSENSI:", () => {
      recordLocalWrite();
      setLogs([]);

      // Kirim otomatis ke Google Sheets
      if (getGasUrl()) {
        setSyncStatus("syncing");
        syncAllToGoogleSheets(staffShifts, [], passportRecords, selectedMonth, selectedYear)
          .then((res) => setSyncStatus(res.success ? "synced" : "error"))
          .catch(() => setSyncStatus("error"));
      }
    });
  };

  const handleResetToDefault = () => {
    requestPassword("MASUKKAN PASSWORD UNTUK MERESET SELURUH SISTEM:", () => {
      recordLocalWrite();
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
        syncAllToGoogleSheets(defaults, seeded, [], selectedMonth, selectedYear)
          .then((res) => setSyncStatus(res.success ? "synced" : "error"))
          .catch(() => setSyncStatus("error"));
      }
    });
  };

  const handleImportState = (newState: { staffShifts: StaffShift[]; logs: ClockInLog[] }) => {
    recordLocalWrite();
    setStaffShifts(newState.staffShifts);
    setLogs(newState.logs);

    // Kirim otomatis ke Google Sheets
    if (getGasUrl()) {
      setSyncStatus("syncing");
      syncAllToGoogleSheets(newState.staffShifts, newState.logs, passportRecords, selectedMonth, selectedYear)
        .then((res) => setSyncStatus(res.success ? "synced" : "error"))
        .catch(() => setSyncStatus("error"));
    }
  };

  const handleImportParsedShifts = (parsed: StaffShift[], mode: "merge" | "overwrite") => {
    const applyImport = (updatedShifts: StaffShift[]) => {
      setStaffShifts(updatedShifts);
      if (getGasUrl()) {
        setSyncStatus("syncing");
        syncAllToGoogleSheets(updatedShifts, logs, passportRecords, selectedMonth, selectedYear)
          .then((res) => setSyncStatus(res.success ? "synced" : "error"))
          .catch(() => setSyncStatus("error"));
      }
    };

    recordLocalWrite();
    if (mode === "overwrite") {
      requestPassword("MASUKKAN PASSWORD UNTUK MENGHAPUS & MENGGANTI SELURUH JADWAL SISTEM:", () => {
        applyImport(parsed);
      });
    } else {
      const updated = [...staffShifts];
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
      applyImport(updated);
    }
  };

  return (
    <div className="h-screen bg-[#070b13] text-slate-100 theme-black flex flex-col font-sans overflow-hidden" id="app-root">
      {/* Abstract luxury ambient glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>

      {/* Sticky Header & Navigation Panel */}
      <div className="sticky top-0 z-40 bg-[#070b13]/90 backdrop-blur-md border-b border-slate-900/60 shadow-2xl">
        {/* Top Banner / System Title */}
        <header className="bg-slate-950/40 border-b border-slate-900/40">
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

              </div>
            </div>
          </div>
        </header>

        {/* Main Tab Navigation */}
        <div className="bg-slate-950/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex overflow-x-auto gap-1.5 py-3.5 scrollbar-none">
              <button
                id="tab-daily-btn"
                onClick={() => setActiveTab("daily")}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black tracking-wider uppercase transition-all whitespace-nowrap cursor-pointer border ${
                  activeTab === "daily"
                    ? "bg-teal-550/15 text-teal-300 border-teal-500/30 shadow-md shadow-teal-500/5"
                    : "text-slate-400 hover:text-teal-200 hover:bg-teal-500/5 hover:border-teal-500/20 border-transparent"
                }`}
              >
                <LayoutDashboard className={`h-4 w-4 shrink-0 transition-colors ${activeTab === "daily" ? "text-teal-400" : "text-teal-650"}`} />
                DASHBOARD ABSENSI HARIAN (WDBOS)
              </button>

              <button
                id="tab-passport-btn"
                onClick={() => {
                  if (activeTab !== "passport") {
                    if (passportUnlocked) {
                      setActiveTab("passport");
                    } else {
                      requestPassword("AKSES HALAMAN SERAH TERIMA PASPOR", () => {
                        sessionStorage.setItem("absen_passport_unlocked", "true");
                        setActiveTab("passport");
                      });
                    }
                  }
                }}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black tracking-wider uppercase transition-all whitespace-nowrap cursor-pointer border ${
                  activeTab === "passport"
                    ? "bg-rose-550/15 text-rose-300 border-rose-500/30 shadow-md shadow-rose-500/5"
                    : "text-slate-400 hover:text-rose-200 hover:bg-rose-500/5 hover:border-rose-500/20 border-transparent"
                }`}
              >
                <Fingerprint className={`h-4 w-4 shrink-0 transition-colors ${activeTab === "passport" ? "text-rose-400" : "text-rose-650"}`} />
                SERAH TERIMA PASPOR
              </button>

              <button
                id="tab-spreadsheet-btn"
                onClick={() => setActiveTab("spreadsheet")}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black tracking-wider uppercase transition-all whitespace-nowrap cursor-pointer border ${
                  activeTab === "spreadsheet"
                    ? "bg-indigo-550/15 text-indigo-300 border-indigo-500/30 shadow-md shadow-indigo-500/5"
                    : "text-slate-400 hover:text-indigo-200 hover:bg-indigo-500/5 hover:border-indigo-500/20 border-transparent"
                }`}
              >
                <Grid className={`h-4 w-4 shrink-0 transition-colors ${activeTab === "spreadsheet" ? "text-indigo-400" : "text-indigo-650"}`} />
                TABEL SHIFT (SPREADSHEET)
              </button>

              <button
                id="tab-clockin-btn"
                onClick={() => setActiveTab("clockin")}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black tracking-wider uppercase transition-all whitespace-nowrap cursor-pointer border ${
                  activeTab === "clockin"
                    ? "bg-amber-550/15 text-amber-300 border-amber-500/30 shadow-md shadow-amber-500/5"
                    : "text-slate-400 hover:text-amber-200 hover:bg-amber-500/5 hover:border-amber-500/20 border-transparent"
                }`}
              >
                <Clock className={`h-4 w-4 shrink-0 transition-colors ${activeTab === "clockin" ? "text-amber-400" : "text-amber-655"}`} />
                CLOCK-IN MANDIRI (SIMULASI)
              </button>

              <button
                id="tab-logs-btn"
                onClick={() => setActiveTab("logs")}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black tracking-wider uppercase transition-all whitespace-nowrap cursor-pointer border ${
                  activeTab === "logs"
                    ? "bg-cyan-550/15 text-cyan-300 border-cyan-500/30 shadow-md shadow-cyan-500/5"
                    : "text-slate-400 hover:text-cyan-200 hover:bg-cyan-500/5 hover:border-cyan-500/20 border-transparent"
                }`}
              >
                <ListTodo className={`h-4 w-4 shrink-0 transition-colors ${activeTab === "logs" ? "text-cyan-400" : "text-cyan-650"}`} />
                LOG KEHADIRAN ({logs.filter(l => (l.month !== undefined ? l.month : 6) === selectedMonth && (l.year !== undefined ? l.year : 2026) === selectedYear).length})
              </button>

              <button
                id="tab-stats-btn"
                onClick={() => setActiveTab("stats")}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black tracking-wider uppercase transition-all whitespace-nowrap cursor-pointer border ${
                  activeTab === "stats"
                    ? "bg-fuchsia-550/15 text-fuchsia-300 border-fuchsia-500/30 shadow-md shadow-fuchsia-500/5"
                    : "text-slate-400 hover:text-fuchsia-200 hover:bg-fuchsia-500/5 hover:border-fuchsia-500/20 border-transparent"
                }`}
              >
                <BarChart2 className={`h-4 w-4 shrink-0 transition-colors ${activeTab === "stats" ? "text-fuchsia-400" : "text-fuchsia-650"}`} />
                ANALISIS & STATISTIK
              </button>

              <button
                id="tab-backup-btn"
                onClick={() => setActiveTab("backup")}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black tracking-wider uppercase transition-all whitespace-nowrap cursor-pointer border ${
                  activeTab === "backup"
                    ? "bg-red-550/15 text-red-300 border-red-500/30 shadow-md shadow-red-500/5"
                    : "text-slate-400 hover:text-red-200 hover:bg-red-500/5 hover:border-red-500/20 border-transparent"
                }`}
              >
                <Save className={`h-4 w-4 shrink-0 transition-colors ${activeTab === "backup" ? "text-red-400" : "text-red-650"}`} />
                EKSPOR / BACKUP
              </button>
            </div>
          </div>
        </div>
      </div>


      {/* Scrollable Body Container */}
      <div className="flex-1 overflow-y-auto w-full flex flex-col relative z-10 scrollbar-thin">
        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
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
                    passportRecords={passportRecords}
                    onResetToDefault={handleResetToDefault}
                    onImportState={handleImportState}
                    selectedMonth={selectedMonth}
                    selectedYear={selectedYear}
                    syncStatus={syncStatus}
                    setSyncStatus={setSyncStatus}
                  />
                </div>
              )}
              {activeTab === "passport" && (
                <div className="space-y-6">
                  <div className="border-l-4 border-teal-505 pl-4 py-1 bg-slate-900/30 rounded-r-2xl pr-4 border border-slate-900/50 backdrop-blur-sm">
                    <h2 className="text-lg sm:text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-100 to-teal-400 tracking-wider font-mono">SERAH TERIMA PASPOR STAFF</h2>
                    <p className="text-[10px] text-slate-400 font-mono mt-1 font-bold">
                      SISTEM PENDATAAN DAN TRACER SERAH TERIMA DOKUMEN PASPOR STAFF WDBOS.
                    </p>
                  </div>
                  <PassportHandover
                    records={passportRecords}
                    staffShifts={staffShifts}
                    selectedDay={selectedDay}
                    selectedMonth={selectedMonth}
                    selectedYear={selectedYear}
                    onAddRecord={handleAddPassport}
                    onUpdateRecord={handleUpdatePassport}
                    onDeleteRecord={handleDeletePassport}
                    masterPassports={masterPassports}
                    customOfficers={customOfficers}
                  />
                </div>
              )}
            </>
          );
        })()}
        </main>

        {/* Footer */}
        <footer className="bg-slate-950/60 border-t border-slate-900 py-8 text-center text-xs text-slate-500 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="font-mono tracking-wide">&copy; 2026 DASHBOARD ABSENSI STAFF. ALL RIGHTS RESERVED.</span>
            <span className="font-mono text-[10px] bg-slate-900 border border-slate-800/80 rounded-lg px-3 py-1.5 text-teal-400 shadow-md">
              PAGI: 07:45:00 - 19:45:00 | MALAM: 19:45:00 - 07:45:00
            </span>
          </div>
        </footer>
      </div>

      {/* Custom Luxury Password modal */}
      {passwordModal.isOpen && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in animate-duration-300">
          <form
            onSubmit={handlePasswordSubmit}
            className="bg-slate-900/95 border-2 border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative overflow-hidden flex flex-col gap-4 animate-zoom-in animate-duration-300"
          >
            {/* Top accent line */}
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-teal-500 to-emerald-500"></div>
            
            {/* Header info */}
            <div className="flex items-center gap-3.5 border-b border-slate-800/80 pb-3">
              <div className="p-2.5 bg-rose-950/30 rounded-2xl text-rose-400 border border-rose-900/40">
                <Lock className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-black text-slate-200 text-sm tracking-wide uppercase">AUTENTIKASI DIJAMIN</h3>
                <p className="text-[9px] text-slate-500 font-mono tracking-widest uppercase mt-0.5">Wajib memasukkan password admin untuk tindakan ini</p>
              </div>
            </div>

            {/* Prompt title */}
            <div className="text-xs font-black text-slate-300 uppercase tracking-wider leading-relaxed font-mono pt-1">
              {passwordModal.title}
            </div>

            {/* Input field */}
            <div className="space-y-1">
              <input
                type="password"
                autoFocus
                required
                placeholder="PASSWORD KUNCI"
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  if (passwordError) setPasswordError("");
                }}
                className={`w-full bg-slate-950 border ${
                  passwordError ? "border-rose-500/80 focus:ring-rose-500/40" : "border-slate-850 focus:ring-teal-500/40"
                } rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:ring-4 focus:outline-none tracking-widest text-center uppercase font-mono transition-all`}
              />
              
              {/* Error message */}
              {passwordError && (
                <div className="flex items-center gap-1.5 text-[9px] font-black text-rose-400 uppercase tracking-widest justify-center font-mono py-0.5">
                  <ShieldAlert className="h-3.5 w-3.5 text-rose-400 shrink-0 animate-bounce" />
                  <span>{passwordError}</span>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2.5 pt-2 border-t border-slate-800/80">
              <button
                type="submit"
                className="flex-1 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 text-xs font-black py-3 rounded-xl shadow-lg shadow-teal-500/10 active:scale-95 transition-all cursor-pointer uppercase tracking-wider text-center"
              >
                KONFIRMASI
              </button>
              <button
                type="button"
                onClick={() => setPasswordModal((prev) => ({ ...prev, isOpen: false }))}
                className="flex-1 bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-black py-3 rounded-xl transition-all cursor-pointer border border-slate-700/80 active:scale-95 uppercase tracking-wider text-center"
              >
                BATALKAN
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
