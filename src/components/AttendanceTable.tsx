/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { StaffShift, ShiftType, SHIFT_DETAILS, MONTHS_INDONESIAN } from "../types";
import {
  Calendar,
  Search,
  UserPlus,
  Trash2,
  Filter,
  Grid,
  Info,
  Clipboard,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  X
} from "lucide-react";

interface AttendanceTableProps {
  staffShifts: StaffShift[];
  onUpdateSchedule: (staffId: string, dayIndex: number, newValue: string) => void;
  onAddStaff: (name: string, category: "CS LINE" | "CS LC" | "KAPTEN KASIR" | "KASIR") => void;
  onDeleteStaff: (staffId: string) => void;
  onImportParsedShifts: (parsed: StaffShift[], mode: "merge" | "overwrite") => void;
  selectedMonth: number;
  selectedYear: number;
  selectedDay: number;
  setSelectedDay: React.Dispatch<React.SetStateAction<number>>;
}

export default function AttendanceTable({
  staffShifts,
  onUpdateSchedule,
  onAddStaff,
  onDeleteStaff,
  onImportParsedShifts,
  selectedMonth,
  selectedYear,
  selectedDay,
  setSelectedDay,
}: AttendanceTableProps) {
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();

  const weeks = [
    { label: "Minggu 1", range: "Tgl 1 - 7", start: 1, end: 7 },
    { label: "Minggu 2", range: "Tgl 8 - 14", start: 8, end: 14 },
    { label: "Minggu 3", range: "Tgl 15 - 21", start: 15, end: 21 },
    { label: "Minggu 4", range: "Tgl 22 - 28", start: 22, end: 28 },
    ...(daysInMonth > 28 ? [{ label: "Minggu 5", range: `Tgl 29 - ${daysInMonth}`, start: 29, end: daysInMonth }] : []),
  ];

  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffCategory, setNewStaffCategory] = useState<"CS LINE" | "CS LC" | "KAPTEN KASIR" | "KASIR">("CS LINE");
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  
  // Layout and navigation state
  const [viewMode, setViewMode] = useState<"date" | "week" | "all" | "paste">("date");
  const [selectedWeek, setSelectedWeek] = useState<number>(0); // Index of weeks array
  const [selectedCell, setSelectedCell] = useState<{ staffId: string; dayIndex: number } | null>(null);

  // Clamp selectedWeek if out of bounds
  useEffect(() => {
    if (selectedWeek >= weeks.length) {
      setSelectedWeek(Math.max(0, weeks.length - 1));
    }
  }, [weeks.length, selectedWeek]);

  // Text Paster state
  const [pastedText, setPastedText] = useState("");
  const [parsedShifts, setParsedShifts] = useState<StaffShift[]>([]);
  const [defaultImportCategory, setDefaultImportCategory] = useState<"CS LINE" | "CS LC" | "KAPTEN KASIR" | "KASIR">("CS LINE");
  const [importSuccessMsg, setImportSuccessMsg] = useState("");

  // Filter staff list
  const filteredStaff = staffShifts.filter((staff) => {
    const matchesSearch = staff.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "ALL" || staff.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleCellClick = (staffId: string, dayIndex: number) => {
    setSelectedCell({ staffId, dayIndex });
  };

  const handleUpdateShift = (value: string) => {
    if (selectedCell) {
      onUpdateSchedule(selectedCell.staffId, selectedCell.dayIndex, value);
      setSelectedCell(null);
    }
  };

  const handleAddStaffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newStaffName.trim()) {
      onAddStaff(newStaffName.trim(), newStaffCategory);
      setNewStaffName("");
      setIsAddingStaff(false);
    }
  };

  // Find currently selected cell details for the formula-like bar
  const selectedStaffObj = selectedCell ? staffShifts.find(s => s.id === selectedCell.staffId) : null;
  const selectedValue = selectedStaffObj && selectedCell ? selectedStaffObj.schedule[selectedCell.dayIndex] : "";

  // Shift counter helpers for row summaries
  const getRowStats = (schedule: string[]) => {
    const stats = { pagi: 0, malam: 0, half: 0, off: 0, cuti: 0 };
    schedule.forEach((v) => {
      if (v === "1") stats.pagi++;
      else if (v === "2") stats.malam++;
      else if (v === "1/2") stats.half++;
      else if (v === "OFF") stats.off++;
      else if (v === "CUTI") stats.cuti++;
    });
    return stats;
  };

  // Parsing pasted schedule text dynamically on input changes
  useEffect(() => {
    if (!pastedText.trim()) {
      setParsedShifts([]);
      return;
    }

    const lines = pastedText.split(/\r?\n/);
    const result: StaffShift[] = [];
    let currentCategory: "CS LINE" | "CS LC" | "KAPTEN KASIR" | "KASIR" = defaultImportCategory;

    // Shift types in system
    const shiftTypes = ["1", "2", "1/2", "OFF", "CUTI"];

    lines.forEach((line, idx) => {
      const lineUpper = line.toUpperCase().trim();
      
      // Auto-detect category lines
      if (lineUpper === "CS LINE" || lineUpper.includes("CS LINE")) {
        currentCategory = "CS LINE";
        return;
      }
      if (lineUpper === "CS LC" || lineUpper.includes("CS LC")) {
        currentCategory = "CS LC";
        return;
      }
      if (lineUpper === "KAPTEN KASIR" || lineUpper.includes("KAPTEN KASIR") || lineUpper.includes("KAPTEN")) {
        currentCategory = "KAPTEN KASIR";
        return;
      }
      if (lineUpper === "KASIR" || lineUpper.includes("KASIR")) {
        currentCategory = "KASIR";
        return;
      }

      // Check if line is a header like dates or months
      if (
        lineUpper.includes("TANGGAL") ||
        lineUpper.includes("JULI") ||
        lineUpper.includes("MINGGU") ||
        lineUpper === ""
      ) {
        return;
      }

      // Tokenize by whitespaces or tabs
      const tokens = line.trim().split(/\s+/);
      if (tokens.length < 2) return; // Need at least name and one shift code

      // Find where schedule starts
      const shiftStartIndex = tokens.findIndex((t) => shiftTypes.includes(t.toUpperCase()));
      if (shiftStartIndex === -1) {
        // No shift found on this line
        return;
      }

      const name = tokens.slice(0, shiftStartIndex).join(" ");
      const rawSchedule = tokens.slice(shiftStartIndex).map(t => t.toUpperCase());

      // Only accept if name is not empty
      if (!name) return;

      // Construct exactly daysInMonth-day schedule array
      const schedule: string[] = [];
      for (let i = 0; i < daysInMonth; i++) {
        if (i < rawSchedule.length && shiftTypes.includes(rawSchedule[i])) {
          schedule.push(rawSchedule[i]);
        } else {
          // default fallback if short/missing
          schedule.push("1");
        }
      }

      const tempId = `parsed-${idx}-${Date.now()}-${name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
      result.push({
        id: tempId,
        name: name.toUpperCase(),
        category: currentCategory,
        schedule,
      });
    });

    setParsedShifts(result);
  }, [pastedText, defaultImportCategory, daysInMonth]);

  const handleOverrideCategory = (index: number, newCategory: "CS LINE" | "CS LC" | "KAPTEN KASIR" | "KASIR") => {
    setParsedShifts((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], category: newCategory };
      return updated;
    });
  };

  const handleLoadExample = () => {
    setPastedText(`CS LINE
TANGGAL : 		1	2	3	4	5	6	7	8	9	10	11	12	13	14	15	16	17	18	19	20	21	22	23	24	25	26	27	28	29	30	31
		JULI																														
FADLAN PRATAMA 		2	2	2	2	2	2	1/2	OFF	1	1	1	1	1	1	1	1	1	1	1	1	1	1	1	OFF	2	2	2	2	2	2	2
NICO FEBRIAN		2	2	2	2	2	2	2	2	1/2	OFF	1	1	1	1	1	1	1	1	1	1	1	1	1	1	1	OFF	2	2	2	2	2
NICO ADRIANSYAH HUTAGAOL		1	1	1	1	1	1	OFF	2	2	2	2	2	2	2	2	2	2	2	2	2	2	2	2	2	2	1/2	OFF	1	1	1	1
ERIC SYAHPUTRA		CUTI	CUTI	1	1	1	1	1	1	1	1	OFF	2	2	2	2	2	2	2	2	2	2	2	2	1/2	OFF	1	1	1	1	1	1
																																
HENGKI		2	2	2	2	2	2	2	2	2	2	1/2	OFF	1	1	1	1	1	1	1	1	1	1	OFF	2	2	2	2	2	2	2	2
ARJUN		1	1	1	1	1	1	1	1	OFF	2	2	2	2	2	2	2	2	2	2	1/2	OFF	1	1	1	1	1	1	1	1	1	1`);
  };

  const handleApplyImport = (mode: "merge" | "overwrite") => {
    if (parsedShifts.length === 0) return;

    onImportParsedShifts(parsedShifts, mode);

    setPastedText("");
    setImportSuccessMsg(
      mode === "overwrite"
        ? `Berhasil mengimpor ${parsedShifts.length} staff. Semua jadwal lama digantikan!`
        : `Berhasil memperbarui / menggabungkan ${parsedShifts.length} staff ke dalam jadwal aktif!`
    );

    setTimeout(() => {
      setImportSuccessMsg("");
      // Automatically navigate to spreadsheet bulanan view to see updated data!
      setViewMode("all");
    }, 3500);
  };

  return (
    <div className="space-y-6" id="attendance-table-container">
      {/* Search and Action Bar (Hidden in paste mode to keep clean) */}
      {viewMode !== "paste" && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-950/60 p-4 rounded-2xl border border-slate-900 backdrop-blur-md shadow-2xl">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                id="staff-search-input"
                type="text"
                placeholder="Cari nama staff..."
                className="pl-9 pr-4 py-2 w-64 bg-slate-900/80 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all font-mono"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5">
              <Filter className="h-3.5 w-3.5 text-teal-400" />
              <select
                id="category-filter-select"
                className="bg-transparent border-none text-xs text-slate-300 font-bold focus:outline-none pr-1 uppercase cursor-pointer"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="ALL" className="bg-slate-950 text-slate-300">Semua Divisi</option>
                <option value="CS LINE" className="bg-slate-950 text-slate-300">CS LINE</option>
                <option value="CS LC" className="bg-slate-950 text-slate-300">CS LC</option>
                <option value="KAPTEN KASIR" className="bg-slate-950 text-slate-300">KAPTEN KASIR</option>
                <option value="KASIR" className="bg-slate-950 text-slate-300">KASIR</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              id="toggle-add-staff-btn"
              onClick={() => setIsAddingStaff(!isAddingStaff)}
              className="flex items-center gap-2 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 text-xs font-black uppercase tracking-wider px-5 py-2.5 rounded-xl shadow-lg shadow-teal-500/10 transition-all cursor-pointer transform active:scale-95"
            >
              <UserPlus className="h-4 w-4 stroke-[2.5]" />
              Tambah Staff Baru
            </button>
          </div>
        </div>
      )}

      {/* Add Staff Drawer / Panel */}
      {isAddingStaff && viewMode !== "paste" && (
        <form
          id="add-staff-form"
          onSubmit={handleAddStaffSubmit}
          className="bg-slate-950/80 border border-slate-800 p-5 rounded-2xl flex flex-wrap gap-4 items-end animate-fade-in relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-500 to-emerald-500"></div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-black text-slate-400 mb-1.5 uppercase tracking-wider font-mono">Nama Lengkap Staff</label>
            <input
              id="new-staff-name-input"
              type="text"
              required
              placeholder="CONTOH: BUDI PRATAMA"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 focus:outline-none uppercase font-mono"
              value={newStaffName}
              onChange={(e) => setNewStaffName(e.target.value)}
            />
          </div>

          <div className="w-56">
            <label className="block text-xs font-black text-slate-400 mb-1.5 uppercase tracking-wider font-mono">Divisi / Posisi</label>
            <select
              id="new-staff-category-select"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 focus:outline-none font-mono"
              value={newStaffCategory}
              onChange={(e) => setNewStaffCategory(e.target.value as any)}
            >
              <option value="CS LINE" className="bg-slate-950">CS LINE</option>
              <option value="CS LC" className="bg-slate-950">CS LC</option>
              <option value="KAPTEN KASIR" className="bg-slate-950">KAPTEN KASIR</option>
              <option value="KASIR" className="bg-slate-950">KASIR</option>
            </select>
          </div>

          <div className="flex gap-2">
            <button
              id="submit-add-staff-btn"
              type="submit"
              className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 text-xs font-black uppercase tracking-wider px-5 py-2.5 rounded-xl transition-all cursor-pointer transform active:scale-95"
            >
              Simpan
            </button>
            <button
              id="cancel-add-staff-btn"
              type="button"
              onClick={() => setIsAddingStaff(false)}
              className="bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-black uppercase tracking-wider px-5 py-2.5 rounded-xl transition-all cursor-pointer border border-slate-800"
            >
              Batal
            </button>
          </div>
        </form>
      )}

      {/* View Mode Switcher Section */}
      <div className="bg-slate-950/40 p-2 rounded-2xl border border-slate-900 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xl">
        <div className="flex flex-wrap items-center gap-1 bg-slate-950/80 p-1.5 rounded-xl border border-slate-900/60 w-full md:w-auto">
          <button
            type="button"
            onClick={() => { setViewMode("date"); setSelectedCell(null); }}
            className={`px-4 py-2.5 text-xs font-black rounded-lg uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer border ${
              viewMode === "date"
                ? "bg-slate-900 text-teal-400 border-slate-800 shadow"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50 border-transparent"
            }`}
          >
            <Calendar className="h-4 w-4 text-teal-500 shrink-0" />
            📅 Edit Per Tanggal
          </button>
          <button
            type="button"
            onClick={() => { setViewMode("week"); setSelectedCell(null); }}
            className={`px-4 py-2.5 text-xs font-black rounded-lg uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer border ${
              viewMode === "week"
                ? "bg-slate-900 text-teal-400 border-slate-800 shadow"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50 border-transparent"
            }`}
          >
            <Grid className="h-4 w-4 text-teal-500 shrink-0" />
            📆 per minggu
          </button>
          <button
            type="button"
            onClick={() => { setViewMode("all"); setSelectedCell(null); }}
            className={`px-4 py-2.5 text-xs font-black rounded-lg uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer border ${
              viewMode === "all"
                ? "bg-slate-900 text-teal-400 border-slate-800 shadow"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50 border-transparent"
            }`}
          >
            <Grid className="h-4 w-4 text-teal-500 shrink-0" />
            📊 spreadsheet bulanan
          </button>
          <button
            type="button"
            onClick={() => { setViewMode("paste"); setSelectedCell(null); }}
            className={`px-4 py-2.5 text-xs font-black rounded-lg uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer border ${
              viewMode === "paste"
                ? "bg-teal-950/25 text-teal-300 border-teal-500/35 shadow"
                : "text-teal-400 hover:text-teal-200 hover:bg-teal-955/20 border-transparent"
            }`}
          >
            <Clipboard className="h-4 w-4 text-teal-400 shrink-0" />
            📋 Tempel Jadwal Shift
          </button>
        </div>

        <div className="text-[10px] text-slate-500 font-bold px-2 italic font-mono uppercase tracking-wide">
          {viewMode === "date" && "Mode bebas scroll. Edit jadwal harian per staff secara instan."}
          {viewMode === "week" && "Menampilkan 7 hari kerja agar pas di layar tanpa scroll samping."}
          {viewMode === "all" && `Menampilkan semua ${daysInMonth} hari dalam satu spreadsheet penuh.`}
          {viewMode === "paste" && "Tempel salinan teks jadwal Excel/Word di sini untuk pengisian instan!"}
        </div>
      </div>

      {/* Success banner for paster imports */}
      {importSuccessMsg && (
        <div className="p-4 bg-emerald-950/50 text-emerald-400 border border-emerald-500/30 text-xs rounded-xl font-bold flex items-center gap-3 animate-fade-in shadow-xl">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 animate-bounce" />
          <span className="font-mono">{importSuccessMsg.toUpperCase()}</span>
        </div>
      )}

      {/* Mode Navigation Controls */}
      {viewMode === "date" && (
        <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-900 shadow-xl space-y-3">
          <div className="text-xs font-black text-slate-400 uppercase tracking-widest font-mono flex items-center gap-1.5">
            <span>PILIH TANGGAL:</span>
            <span className="bg-teal-950 text-teal-400 text-[10px] px-3 py-1 rounded-full font-black border border-teal-850">
              {MONTHS_INDONESIAN[selectedMonth].toUpperCase()} - TANGGAL {selectedDay}
            </span>
          </div>

          {/* Scrolling Day Selector Strip */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 pt-1 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const isSelected = selectedDay === day;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  className={`flex-shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center transition-all border cursor-pointer ${
                    isSelected
                      ? "bg-gradient-to-b from-teal-500 to-emerald-500 border-teal-400 text-slate-950 font-black shadow-lg scale-105"
                      : "bg-slate-900/60 border-slate-850 text-slate-400 hover:bg-slate-900 hover:border-slate-800 font-bold"
                  }`}
                >
                  <span className={`text-[8px] opacity-75 uppercase tracking-widest ${isSelected ? "text-slate-900" : "text-slate-500"}`}>TGL</span>
                  <span className="text-sm -mt-0.5 font-mono">{day}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {viewMode === "week" && (
        <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-900 shadow-xl space-y-3">
          <div className="text-xs font-black text-slate-400 uppercase tracking-widest font-mono">
            PILIH MINGGU:
          </div>

          {/* Week Selector Button Group */}
          <div className="flex flex-wrap gap-2">
            {weeks.map((wk, idx) => {
              const isSelected = selectedWeek === idx;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedWeek(idx)}
                  className={`px-4 py-2.5 rounded-xl border text-xs font-black uppercase tracking-wider flex flex-col items-center gap-0.5 transition-all cursor-pointer ${
                    isSelected
                      ? "bg-gradient-to-r from-teal-500 to-emerald-500 border-teal-400 text-slate-950 shadow-md"
                      : "bg-slate-900/60 border-slate-850 text-slate-400 hover:bg-slate-900 hover:border-slate-800"
                  }`}
                >
                  <span>{wk.label}</span>
                  <span className={`text-[10px] font-mono ${isSelected ? "text-slate-900" : "text-slate-500"}`}>
                    ({wk.range})
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Spreadsheet Formula / Interactive Bar (Only for Spreadsheet Modes) */}
      {viewMode !== "date" && viewMode !== "paste" && (
        <div className="bg-slate-950 border border-slate-900 text-slate-100 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-2xl">
          <div className="flex items-center gap-2.5">
            <div className="bg-slate-900 px-3 py-1.5 rounded-lg text-xs font-mono text-teal-400 flex items-center gap-1.5 border border-slate-800">
              <Grid className="h-3.5 w-3.5 text-teal-500" />
              {selectedCell
                ? `${selectedStaffObj?.name ? selectedStaffObj.name.split(" ")[0].toUpperCase() : ""}: HARI ${selectedCell.dayIndex + 1}`
                : "FORMULA BAR"}
            </div>
            <span className="text-xs text-slate-600 font-mono">fx =</span>
            <span className="text-xs font-semibold text-slate-300 font-mono tracking-wide">
              {selectedCell && selectedStaffObj
                ? `JADWAL SHIFT: [ ${selectedValue} ] - ${
                    (SHIFT_DETAILS[selectedValue as ShiftType]?.label || selectedValue || "BELUM DIATUR").toUpperCase()
                  }`
                : "KLIK SALAH SATU SEL JADWAL PADA TABEL UNTUK MENGUBAH SHIFT STAFF."}
            </span>
          </div>

          {selectedCell && (
            <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
              {(["1", "2", "1/2", "OFF", "CUTI"] as ShiftType[]).map((code) => {
                const details = SHIFT_DETAILS[code];
                return (
                  <button
                    key={code}
                    id={`quick-shift-set-${code}`}
                    onClick={() => handleUpdateShift(code)}
                    className={`h-8 min-w-8 px-2 text-xs font-black rounded-lg uppercase tracking-wider transition-all cursor-pointer border ${
                      selectedValue === code ? "ring-2 ring-teal-400" : ""
                    } ${
                      code === "1" ? "bg-teal-550/20 text-teal-400 border-teal-500/30 hover:bg-teal-500/30" :
                      code === "2" ? "bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/30" :
                      code === "1/2" ? "bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30" :
                      code === "OFF" ? "bg-rose-500/20 text-rose-400 border-rose-500/30 hover:bg-rose-500/30" :
                      "bg-purple-500/20 text-purple-400 border-purple-500/30 hover:bg-purple-500/30"
                    }`}
                    title={details.label}
                  >
                    {code}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Main Content Area based on Selected View Mode */}
      {viewMode === "date" ? (
        /* MODE 1: DATE EDITOR (NO SCROLLING INVOLVED) */
        <div className="bg-slate-950/60 rounded-2xl border border-slate-900 overflow-hidden shadow-2xl backdrop-blur-md">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-900/80 border-b border-slate-800 text-teal-400 text-xs font-black uppercase tracking-wider font-mono">
                  <th className="px-4 py-3.5 w-12 text-center">No</th>
                  <th className="px-4 py-3.5">Nama Staff (Divisi)</th>
                  <th className="px-4 py-3.5 w-40 text-center">Shift Kerja</th>
                  <th className="px-4 py-3.5 w-72 text-center">Ubah Cepat</th>
                  <th className="px-4 py-3.5 w-16 text-center">Hapus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900">
                {filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-sm text-slate-500 font-mono">
                      TIDAK ADA STAFF DITEMUKAN YANG COCOK DENGAN PENCARIAN ATAU FILTER.
                    </td>
                  </tr>
                ) : (
                  filteredStaff.map((staff, sIdx) => {
                    const currentShift = staff.schedule[selectedDay - 1] || "1";
                    return (
                      <tr key={staff.id} className="hover:bg-slate-900/40 transition-all duration-150">
                        {/* No */}
                        <td className="px-4 py-4 text-center text-xs font-mono text-slate-600 font-bold">
                          {sIdx + 1}
                        </td>

                        {/* Name and Category */}
                        <td className="px-4 py-4">
                          <div className="font-black text-sm text-slate-200 uppercase tracking-wide">
                            {staff.name}
                          </div>
                          <div className={`text-xs font-black font-mono tracking-wider mt-1 uppercase category-label-text category-label-${staff.category.toLowerCase().replace(/\s+/g, "-")}`}>
                            {staff.category}
                          </div>
                        </td>

                        {/* Shift Display */}
                        <td className="px-4 py-4 text-center">
                          <span className={`inline-block px-3 py-1 text-xs font-black rounded uppercase tracking-wider min-w-[90px] border ${
                            currentShift === "1" ? "bg-teal-500/10 text-teal-400 border-teal-500/20 shadow-sm" :
                            currentShift === "2" ? "bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-sm" :
                            currentShift === "1/2" ? "bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-sm" :
                            currentShift === "OFF" ? "bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-sm" :
                            "bg-purple-500/10 text-purple-400 border-purple-500/20 shadow-sm"
                          }`}>
                            {currentShift === "1" ? "PAGI (1)" :
                             currentShift === "2" ? "MALAM (2)" :
                             currentShift === "1/2" ? "HALF (1/2)" :
                             currentShift === "OFF" ? "OFF" : "CUTI"}
                          </span>
                        </td>

                        {/* Fast Shift Change Pills */}
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-center gap-1">
                            {(["1", "2", "1/2", "OFF", "CUTI"] as ShiftType[]).map((code) => {
                              const isSelected = currentShift === code;
                              return (
                                <button
                                  key={code}
                                  type="button"
                                  onClick={() => onUpdateSchedule(staff.id, selectedDay - 1, code)}
                                  className={`px-2.5 py-1 text-xs font-black rounded transition-all active:scale-95 cursor-pointer border ${
                                    isSelected
                                      ? code === "1" ? "bg-teal-500 text-slate-950 border-teal-400 shadow-lg shadow-teal-500/10" :
                                        code === "2" ? "bg-blue-500 text-slate-950 border-blue-400 shadow-lg shadow-blue-500/10" :
                                        code === "1/2" ? "bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/10" :
                                        code === "OFF" ? "bg-rose-500 text-slate-950 border-rose-400 shadow-lg shadow-rose-500/10" :
                                        "bg-purple-500 text-slate-950 border-purple-400 shadow-lg shadow-purple-500/10"
                                      : "bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-850 hover:text-slate-200"
                                  }`}
                                  title={SHIFT_DETAILS[code]?.label}
                                >
                                  {code}
                                </button>
                              );
                            })}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-4 text-center">
                          <button
                            id={`delete-staff-${staff.id}`}
                            onClick={() => {
                              if (window.confirm(`Hapus staff ${staff.name} dari sistem?`)) {
                                onDeleteStaff(staff.id);
                              }
                            }}
                            className="text-slate-600 hover:text-rose-400 p-2 rounded-lg hover:bg-rose-950/20 border border-transparent hover:border-rose-900/30 transition-all inline-block cursor-pointer active:scale-95"
                            title="Hapus Staff"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : viewMode === "paste" ? (
        /* MODE 4: COPAST TEXTAREA PARSER (NEW ADDITION) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="paste-scheduler-module">
          
          {/* Left Side: Paste Box */}
          <div className="lg:col-span-5 bg-slate-950/60 p-5 rounded-2xl border border-slate-900 shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-teal-950/40 rounded-xl text-teal-400 border border-teal-900/40">
                  <Clipboard className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-200 text-sm uppercase tracking-wide">Tempel Data Jadwal</h3>
                  <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest mt-0.5">Salin dari Excel / Word lalu tempel</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLoadExample}
                className="flex items-center gap-1.5 text-[10px] font-black text-teal-400 hover:text-teal-300 bg-teal-950/40 px-3 py-2 rounded-xl border border-teal-900/50 transition-colors cursor-pointer uppercase tracking-wider"
              >
                <Sparkles className="h-3.5 w-3.5 text-teal-400 shrink-0" />
                Gunakan Contoh
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest font-mono">Fallback Divisi</label>
              <select
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 cursor-pointer"
                value={defaultImportCategory}
                onChange={(e) => setDefaultImportCategory(e.target.value as any)}
              >
                <option value="CS LINE" className="bg-slate-950">CS LINE (Default)</option>
                <option value="CS LC" className="bg-slate-950">CS LC (Default)</option>
                <option value="KAPTEN KASIR" className="bg-slate-950">KAPTEN KASIR (Default)</option>
                <option value="KASIR" className="bg-slate-950">KASIR (Default)</option>
              </select>
              <p className="text-[10px] text-slate-500 italic leading-relaxed font-mono">
                *SISTEM AKAN OTOMATIS MENDETEKSI BARIS DIVISI JIKA ADA TEKS SEPERTI "CS LINE", "CS LC", DLL. JIKA TIDAK DITEMUKAN, STAFF DI BAWAHNYA AKAN MENGGUNAKAN DIVISI FALLBACK INI.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest font-mono">Tempat Copasan Teks</label>
              <div className="relative">
                <textarea
                  id="paste-schedule-textarea"
                  rows={14}
                  placeholder="Tempel baris data jadwal di sini...

Contoh format:
CS LINE
FADLAN PRATAMA  2  2  2  2  2  2  OFF  1  1  1...
HENGKI  2  2  2  2  2  OFF  1  1..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-xs font-mono text-slate-200 placeholder-slate-600 focus:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all shadow-inner leading-relaxed uppercase"
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                />
                {pastedText && (
                  <button
                    type="button"
                    onClick={() => setPastedText("")}
                    className="absolute top-3 right-3 p-1.5 bg-slate-800 hover:bg-slate-750 rounded-full text-slate-300 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                    title="Bersihkan Teks"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Instruction list */}
            <div className="bg-slate-900/40 p-4 rounded-2xl border border-slate-850 text-[10px] text-slate-400 leading-relaxed space-y-1.5 font-mono">
              <span className="font-black text-slate-200 block uppercase tracking-wider">💡 TIPS MEMASUKKAN DATA:</span>
              <ul className="list-disc list-inside space-y-1">
                <li>SATU BARIS MEWAKILI SATU STAFF (NAMA DIIKUTI KODE SHIFT).</li>
                <li>DUKUNGAN KODE SHIFT: <strong className="text-teal-400">1</strong> (PAGI), <strong className="text-blue-400">2</strong> (MALAM), <strong className="text-amber-400">1/2</strong> (HALF), <strong className="text-rose-400">OFF</strong>, <strong className="text-purple-400 font-bold">CUTI</strong>.</li>
                <li>PEMISAH ANTAR KODE SHIFT BISA MENGGUNAKAN TAB ATAU SPASI.</li>
                <li>JIKA BARIS SHIFT KURANG DARI 31 HARI, SISTEM AKAN MELENGKAPINYA OTOMATIS DENGAN SHIFT 1 (PAGI).</li>
              </ul>
            </div>
          </div>

          {/* Right Side: Parsed Live Preview List */}
          <div className="lg:col-span-7 flex flex-col justify-between bg-slate-950/60 p-5 rounded-2xl border border-slate-900 shadow-2xl space-y-4 min-h-[500px]">
            <div className="space-y-3 flex-1 font-mono">
              <div className="flex items-center justify-between border-b border-slate-900 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-teal-950/40 rounded-xl text-teal-400 border border-teal-900/40">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-200 text-sm uppercase tracking-wide">Hasil Live Preview ({parsedShifts.length} Staff)</h3>
                    <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest mt-0.5">Tinjau hasil deteksi data sebelum diimpor ke sistem</p>
                  </div>
                </div>

                {parsedShifts.length > 0 && (
                  <span className="bg-teal-950 text-teal-400 text-[9px] px-3 py-1 rounded-full font-black animate-pulse border border-teal-850 font-mono tracking-widest uppercase">
                    READY TO IMPORT
                  </span>
                )}
              </div>

              {parsedShifts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 font-mono">
                  <Clipboard className="h-12 w-12 text-slate-700 stroke-[1.5] animate-pulse" />
                  <div className="space-y-1.5 max-w-sm">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Belum Ada Data Terdeteksi</p>
                    <p className="text-[10px] text-slate-600 leading-relaxed uppercase">
                      SILAKAN KETIK ATAU TEMPEL DATA JADWAL SHIFT KERJA ANDA DI KOTAK TEXTAREA SEBELAH KIRI UNTUK MEMICU PROSES DETEKSI INSTAN.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1 divide-y divide-slate-900/60 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                  {parsedShifts.map((staff, idx) => {
                    const stats = getRowStats(staff.schedule);
                    return (
                      <div key={staff.id} className="pt-3 first:pt-0 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="space-y-0.5">
                            <span className="text-xs font-black text-slate-200 block uppercase tracking-wide">
                              {idx + 1}. {staff.name}
                            </span>
                            <div className="flex items-center gap-2 text-[9px] text-slate-550 font-mono uppercase font-black">
                              <span className="text-teal-400">Pagi: {stats.pagi}</span>
                              <span>•</span>
                              <span className="text-blue-400">Malam: {stats.malam}</span>
                              <span>•</span>
                              <span className="text-amber-400">Half: {stats.half}</span>
                              <span>•</span>
                              <span className="text-rose-450">OFF: {stats.off}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider font-mono">Divisi:</span>
                            <select
                              className="bg-transparent border-none text-[10px] font-black text-slate-350 focus:outline-none cursor-pointer pr-1 uppercase font-mono"
                              value={staff.category}
                              onChange={(e) => handleOverrideCategory(idx, e.target.value as any)}
                            >
                              <option value="CS LINE" className="bg-slate-950">CS LINE</option>
                              <option value="CS LC" className="bg-slate-950">CS LC</option>
                              <option value="KAPTEN KASIR" className="bg-slate-950">KAPTEN KASIR</option>
                              <option value="KASIR" className="bg-slate-950">KASIR</option>
                            </select>
                          </div>
                        </div>

                        {/* Visual mini-colored dots representing the schedule */}
                        <div className="flex flex-wrap gap-0.5 overflow-x-auto py-1 scrollbar-none">
                          {staff.schedule.map((val, dIdx) => (
                            <div
                              key={dIdx}
                              className={`w-4 h-4 rounded-sm flex items-center justify-center text-[8px] font-black shrink-0 ${
                                val === "1" ? "bg-teal-500 text-slate-950" :
                                val === "2" ? "bg-blue-500 text-slate-950" :
                                val === "1/2" ? "bg-amber-400 text-slate-950" :
                                val === "OFF" ? "bg-rose-500 text-slate-950" :
                                "bg-purple-500 text-slate-950"
                              }`}
                              title={`Tgl ${dIdx + 1}: ${val}`}
                            >
                              {val}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Final Import Action Buttons */}
            {parsedShifts.length > 0 && (
              <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 space-y-3 shadow-inner font-mono">
                <div className="text-xs font-bold text-slate-400 leading-relaxed flex items-start gap-2.5">
                  <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                  <span className="uppercase text-[10px] tracking-wide leading-normal">
                    DATA PRATINJAU SUDAH AKURAT. SILAKAN PILIH METODE INTEGRASI DATABASE JADWAL DI BAWAH INI UNTUK DISIMPAN KE SPREADSHEET:
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => handleApplyImport("merge")}
                    className="flex items-center justify-center gap-2 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 text-xs font-black py-3 px-4 rounded-xl shadow-lg shadow-teal-500/10 active:scale-95 transition-all cursor-pointer uppercase tracking-wider"
                  >
                    <RefreshCw className="h-4 w-4 stroke-[2.5]" />
                    Gabung & Update Data (Rekomendasi)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm("PERINGATAN KERAS: Opsi ini akan MENGHAPUS SEMUA staff dan jadwal lama, digantikan sepenuhnya dengan data di pratinjau! Lanjutkan?")) {
                        handleApplyImport("overwrite");
                      }
                    }}
                    className="flex items-center justify-center gap-2 bg-slate-950 hover:bg-black text-slate-300 text-xs font-black py-3 px-4 rounded-xl shadow-sm hover:shadow active:scale-95 transition-all cursor-pointer uppercase tracking-wider border border-slate-800"
                  >
                    <Trash2 className="h-4 w-4 text-rose-450" />
                    Ganti Seluruh Jadwal Sistem
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* MODE 2 & 3: GRID SPREADSHEETS */
        <div className="bg-slate-950/60 rounded-2xl border border-slate-900 overflow-hidden shadow-2xl backdrop-blur-md">
          <div className="overflow-x-auto max-w-full font-mono">
            <table className="w-full border-collapse text-left table-fixed">
              {/* Table Head */}
              <thead className="bg-slate-900/80 border-b border-slate-800 sticky top-0 z-10">
                <tr>
                  {/* Fixed Headers */}
                  <th className="w-10 px-3 py-4 text-center text-xs font-black text-slate-650 border-r border-slate-900 font-mono uppercase">
                    No
                  </th>
                  <th className="w-52 px-4 py-4 text-xs font-black text-teal-400 border-r border-slate-900 bg-slate-900 sticky left-0 z-20 font-mono uppercase">
                    Nama Staff (Divisi)
                  </th>
                  
                  {/* Grid Day Columns */}
                  {(viewMode === "week"
                    ? Array.from({ length: (weeks[selectedWeek] || weeks[0]).end - (weeks[selectedWeek] || weeks[0]).start + 1 }, (_, i) => (weeks[selectedWeek] || weeks[0]).start - 1 + i)
                    : Array.from({ length: daysInMonth }, (_, i) => i)
                  ).map((dIdx) => (
                    <th
                      key={dIdx}
                      className="w-12 text-center text-[11px] font-black text-slate-400 border-r border-slate-900 py-4 bg-slate-900/90 font-mono"
                    >
                      {dIdx + 1}
                    </th>
                  ))}

                  {/* Stat Summary Columns */}
                  <th className="w-14 text-center text-[9px] font-black text-teal-400 border-r border-slate-900 bg-teal-950/40 uppercase font-mono font-black">Pagi</th>
                  <th className="w-14 text-center text-[9px] font-black text-blue-400 border-r border-slate-900 bg-blue-950/40 uppercase font-mono font-black">Malam</th>
                  <th className="w-14 text-center text-[9px] font-black text-amber-400 border-r border-slate-900 bg-amber-950/40 uppercase font-mono font-black">1/2</th>
                  <th className="w-14 text-center text-[9px] font-black text-rose-450 border-r border-slate-900 bg-rose-950/40 uppercase font-mono font-black">OFF</th>
                  <th className="w-12 text-center text-[9px] font-black text-slate-400 bg-slate-900 uppercase font-mono font-black">Hapus</th>
                </tr>
              </thead>

              {/* Table Body */}
              <tbody className="divide-y divide-slate-900">
                {filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan={viewMode === "week" ? 15 : daysInMonth + 7} className="text-center py-12 text-sm text-slate-500 font-mono uppercase font-black">
                      Tidak ada staff ditemukan yang cocok dengan pencarian atau filter.
                    </td>
                  </tr>
                ) : (
                  filteredStaff.map((staff, sIdx) => {
                    const rowStats = getRowStats(staff.schedule);
                    const currentWk = weeks[selectedWeek] || weeks[0];
                    const activeDays = viewMode === "week"
                      ? Array.from({ length: currentWk.end - currentWk.start + 1 }, (_, i) => currentWk.start - 1 + i)
                      : Array.from({ length: daysInMonth }, (_, i) => i);

                    return (
                      <tr key={staff.id} className="hover:bg-slate-900/30 transition-colors group">
                        {/* Row number */}
                        <td className="px-3 py-2.5 text-center text-xs font-mono text-slate-750 border-r border-slate-900 font-bold">
                          {sIdx + 1}
                        </td>

                        {/* Staff Name Sticky Column */}
                        <td className="px-4 py-2.5 border-r border-slate-900 bg-slate-950 group-hover:bg-slate-900/60 sticky left-0 z-10 shadow-[4px_0_12px_rgba(0,0,0,0.6)] transition-all">
                          <div className="font-black text-xs text-slate-200 leading-tight uppercase truncate">
                            {staff.name}
                          </div>
                          <div className={`text-[9px] font-black font-mono tracking-wider mt-0.5 uppercase category-label-text category-label-${staff.category.toLowerCase().replace(/\s+/g, "-")}`}>
                            {staff.category}
                          </div>
                        </td>

                        {/* Schedule Cells */}
                        {activeDays.map((dIdx) => {
                          const val = staff.schedule[dIdx] || "1";
                          const isSelected = selectedCell?.staffId === staff.id && selectedCell?.dayIndex === dIdx;
                          let cellStyle = "bg-slate-900/50 text-slate-500 hover:bg-slate-800";
                          if (val === "1") cellStyle = "bg-teal-500/10 text-teal-450 font-black border-teal-900/30 hover:bg-teal-500/20";
                          if (val === "2") cellStyle = "bg-blue-500/10 text-blue-400 font-black border-blue-900/30 hover:bg-blue-500/20";
                          if (val === "1/2") cellStyle = "bg-amber-500/10 text-amber-400 font-black border-amber-900/30 hover:bg-amber-500/20";
                          if (val === "OFF") cellStyle = "bg-rose-500/10 text-rose-450 font-black border-rose-900/30 hover:bg-rose-500/20";
                          if (val === "CUTI") cellStyle = "bg-purple-500/10 text-purple-400 font-black border-purple-900/30 hover:bg-purple-500/20";

                          return (
                            <td
                              key={dIdx}
                              onClick={() => handleCellClick(staff.id, dIdx)}
                              className={`text-center text-xs py-3 border-r border-slate-900 cursor-pointer transition-all relative ${cellStyle} ${
                                isSelected ? "ring-2 ring-teal-400 ring-offset-1 ring-offset-slate-950 z-20" : ""
                              }`}
                            >
                              <span className="font-mono">{val}</span>
                            </td>
                          );
                        })}

                        {/* Shift Statistics Column */}
                        <td className="text-center text-xs font-black text-teal-400 border-r border-slate-900 bg-teal-950/20 font-mono">
                          {rowStats.pagi}
                        </td>
                        <td className="text-center text-xs font-black text-blue-400 border-r border-slate-900 bg-blue-950/20 font-mono">
                          {rowStats.malam}
                        </td>
                        <td className="text-center text-xs font-black text-amber-400 border-r border-slate-900 bg-amber-950/20 font-mono">
                          {rowStats.half}
                        </td>
                        <td className="text-center text-xs font-black text-rose-450 border-r border-slate-900 bg-rose-950/20 font-mono">
                          {rowStats.off}
                        </td>

                        {/* Action Cell */}
                        <td className="text-center py-2.5 bg-slate-950 group-hover:bg-slate-900/60 transition-all">
                          <button
                            id={`delete-staff-${staff.id}`}
                            onClick={() => {
                              if (window.confirm(`Hapus staff ${staff.name} dari sistem?`)) {
                                onDeleteStaff(staff.id);
                              }
                            }}
                            className="text-slate-600 hover:text-rose-450 p-1.5 rounded-lg hover:bg-rose-950/30 transition-colors inline-block cursor-pointer border border-transparent hover:border-rose-900/40"
                            title="Hapus Staff"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Guide Card */}
      <div className="bg-slate-950/60 border border-slate-900 rounded-2xl p-5 flex gap-4 text-slate-400 shadow-2xl relative overflow-hidden">
        <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-teal-500 to-emerald-500"></div>
        <Info className="h-5 w-5 text-teal-400 shrink-0 mt-0.5" />
        <div className="text-xs space-y-2">
          <p className="font-black text-slate-200 uppercase tracking-wide">PANDUAN PENGGUNAAN TABEL SCHEDULE:</p>
          <ul className="list-disc list-inside space-y-1 text-slate-400 leading-relaxed uppercase font-mono text-[10px]">
            {viewMode === "paste" ? (
              <>
                <li>ANDA BISA MENYALIN (COPY) KOLOM JADWAL DI EXCEL, NOTEPAD, ATAU WORD DAN LANGSUNG MENEMPELNYA KE KOTAK TEKS DI SEBELAH KIRI.</li>
                <li>BARIS DIVISI SEPERTI <strong className="text-teal-400">CS LINE</strong> SECARA OTOMATIS MENGUBAH PENGELOMPOKAN BARIS-BARIS NAMA DI BAWAHNYA.</li>
                <li>GUNAKAN DROPDOWN DIVISI DI SETIAP NAMA BARIS PRATINJAU UNTUK MEMINDAH ATAU MEMPERBAIKI POSISINYA SECARA CEPAT SEBELUM MELAKUKAN IMPOR.</li>
                <li>KLIK <strong className="text-teal-400">GABUNG & UPDATE</strong> JIKA ANDA HANYA INGIN MEMPERBARUI JADWAL ORANG-ORANG INI TANPA MENGHAPUS STAFF LAIN YANG SUDAH ADA DI SISTEM.</li>
              </>
            ) : (
              <>
                <li>GUNAKAN TAB <strong className="text-teal-400">📅 EDIT PER TANGGAL</strong> DI ATAS UNTUK PENGALAMAN PENUH TANPA SCROLL SAMPING. SANGAT NYAMAN DI HP/TABLET!</li>
                <li>TAB <strong className="text-teal-400">📋 TEMPEL JADWAL SHIFT</strong> MEMUNGKINKAN ANDA MEMASUKKAN JADWAL PULUHAN ORANG SEKALIGUS HANYA DENGAN MENYALIN TEKS.</li>
                <li>KLIK PADA SEL JADWAL MANA SAJA DI TABEL GRID UNTUK MELIHAT DETAIL SHIFT & MEMICU EDIT CEPAT DI FORMULA BAR.</li>
                <li>SEMUA PERUBAHAN DATA TERSIMPAN OTOMATIS DALAM SPREADSHEET GOOGLE SHEETS JIKA SINKRONISASI AKTIF!</li>
              </>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
