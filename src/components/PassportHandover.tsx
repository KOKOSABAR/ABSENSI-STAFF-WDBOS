import React, { useState } from "react";
import { PassportHandoverRecord, StaffShift, MasterPassport, CustomOfficer } from "../types";
import { Search, Trash2, Edit2, Clock, CheckCircle2, Sun, Moon } from "lucide-react";

interface PassportHandoverProps {
  records: PassportHandoverRecord[];
  staffShifts: StaffShift[];
  selectedDay: number;
  selectedMonth: number;
  selectedYear: number;
  onAddRecord: (record: Omit<PassportHandoverRecord, "id">) => void;
  onUpdateRecord: (record: PassportHandoverRecord) => void;
  onDeleteRecord: (id: string) => void;
  masterPassports: MasterPassport[];
  customOfficers: CustomOfficer[];
}

export default function PassportHandover({
  records = [],
  staffShifts = [],
  selectedDay,
  selectedMonth,
  selectedYear,
  onAddRecord,
  onUpdateRecord,
  onDeleteRecord,
  masterPassports = [],
  customOfficers = [],
}: PassportHandoverProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeShiftTab, setActiveShiftTabRaw] = useState<"PAGI" | "MALAM">(() => {
    const saved = sessionStorage.getItem("absen_shift_tab");
    return saved === "MALAM" ? "MALAM" : "PAGI";
  });

  const setActiveShiftTab = (tab: "PAGI" | "MALAM") => {
    sessionStorage.setItem("absen_shift_tab", tab);
    setActiveShiftTabRaw(tab);
  };
  const [globalOfficer, setGlobalOfficerRaw] = useState<string>(
    () => sessionStorage.getItem("absen_global_officer") ?? ""
  );

  const setGlobalOfficer = (val: string) => {
    if (val) {
      sessionStorage.setItem("absen_global_officer", val);
    } else {
      sessionStorage.removeItem("absen_global_officer");
    }
    setGlobalOfficerRaw(val);
  };

  // Custom luxury input prompt modal state
  const [inputModal, setInputModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    placeholder: string;
    value: string;
    onConfirm: (val: string) => void;
  }>({
    isOpen: false,
    title: "",
    description: "",
    placeholder: "",
    value: "",
    onConfirm: () => {},
  });
  const [modalInputValue, setModalInputValue] = useState("");

  // Custom luxury notification/alert modal state
  const [notifyModal, setNotifyModal] = useState<{ isOpen: boolean; message: string; icon: "warn" | "info" | "success" }>({
    isOpen: false,
    message: "",
    icon: "warn",
  });

  const showNotify = (message: string, icon: "warn" | "info" | "success" = "warn") => {
    setNotifyModal({ isOpen: true, message, icon });
  };

  // Determine officers list: custom list from Google Sheets only
  const finalOfficers = customOfficers && customOfficers.length > 0
    ? customOfficers
    : [];

  const requestInput = (
    title: string,
    description: string,
    placeholder: string,
    defaultValue: string,
    onConfirm: (val: string) => void
  ) => {
    setModalInputValue(defaultValue);
    setInputModal({
      isOpen: true,
      title,
      description,
      placeholder,
      value: defaultValue,
      onConfirm,
    });
  };

  const handleModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    inputModal.onConfirm(modalInputValue);
    setInputModal((prev) => ({ ...prev, isOpen: false }));
  };

  const currentDateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`;

  // Determine active staff scheduled for today or who have passport records specifically on current date
  const pagiStaff = staffShifts.filter((s) => {
    const shiftCode = s.schedule[selectedDay - 1];
    const hasDayRecord = records.some(
      (r) => r.staffName === s.name && 
             (r.shift || "PAGI").toUpperCase() === "PAGI" && 
             r.dateIn === currentDateStr
    );
    return shiftCode === "1" || hasDayRecord;
  });

  const malamStaff = staffShifts.filter((s) => {
    const shiftCode = s.schedule[selectedDay - 1];
    const hasDayRecord = records.some(
      (r) => r.staffName === s.name && 
             (r.shift || "PAGI").toUpperCase() === "MALAM" && 
             r.dateIn === currentDateStr
    );
    return shiftCode === "2" || hasDayRecord;
  });

  // Filter lists based on search criteria
  const filterStaffList = (list: StaffShift[], shiftName: "PAGI" | "MALAM") => {
    return list.filter((s) => {
      const activeRecord = records.find(
        (r) => r.staffName === s.name && !r.dateOut && (r.shift || "PAGI").toUpperCase() === shiftName && r.dateIn === currentDateStr
      );
      const returnedRecord = [...records]
        .reverse()
        .find(
          (r) => r.staffName === s.name && r.dateOut && (r.shift || "PAGI").toUpperCase() === shiftName && r.dateIn === currentDateStr
        );
      const currentRecord = activeRecord || returnedRecord;
      const term = searchTerm.toLowerCase();
      return (
        s.name.toLowerCase().includes(term) ||
        s.category.toLowerCase().includes(term) ||
        (currentRecord?.passportNo || "").toLowerCase().includes(term) ||
        (currentRecord?.notes || "").toLowerCase().includes(term)
      );
    });
  };

  const filteredPagiStaff = filterStaffList(pagiStaff, "PAGI");
  const filteredMalamStaff = filterStaffList(malamStaff, "MALAM");

  // Sorting order definition: CS LINE -> CS LC -> KAPTEN KASIR -> KASIR -> Others
  const JABATAN_ORDER: Record<string, number> = {
    "CS LINE": 1,
    "CS LC": 2,
    "KAPTEN KASIR": 3,
    "KASIR": 4,
  };

  const sortStaff = (list: StaffShift[]) => {
    return [...list].sort((a, b) => {
      const orderA = JABATAN_ORDER[a.category.toUpperCase()] || 99;
      const orderB = JABATAN_ORDER[b.category.toUpperCase()] || 99;
      
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      
      // If same department, sort alphabetically by name
      return a.name.localeCompare(b.name);
    });
  };

  const sortedPagiStaff = sortStaff(filteredPagiStaff);
  const sortedMalamStaff = sortStaff(filteredMalamStaff);

  const totalHeld = records.filter((r) => !r.dateOut && r.dateIn).length;
  const totalReturned = records.filter((r) => r.dateOut && r.dateIn).length;

  const handleTerimaPassport = (staff: StaffShift, shiftName: "PAGI" | "MALAM") => {
    if (!globalOfficer.trim()) {
      showNotify("SILAKAN PILIH PETUGAS SERAH TERIMA DI ATAS TERLEBIH DAHULU!", "warn");
      return;
    }

    // Lookup master passport list from Google Sheets first, then history (case-insensitive & trimmed)
    const masterMatch = masterPassports.find(
      (m) => m.name.trim().toUpperCase() === staff.name.trim().toUpperCase() && m.passportNo !== "-"
    );
    const history = records.find(
      (r) => r.staffName.trim().toUpperCase() === staff.name.trim().toUpperCase() && r.passportNo !== "-"
    );
    const passportNo = masterMatch ? masterMatch.passportNo : (history ? history.passportNo : "-");

    const dateInStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`;

    // Check if an active record already exists to reuse it (e.g. notes-only record)
    const existingActive = records.find(
      (r) => r.staffName === staff.name && !r.dateOut && (r.shift || "PAGI").toUpperCase() === shiftName
    );

    if (existingActive) {
      onUpdateRecord({
        ...existingActive,
        passportNo: passportNo,
        dateIn: dateInStr,
        officerName: globalOfficer.trim(),
      });
    } else {
      onAddRecord({
        staffName: staff.name,
        passportNo: passportNo,
        position: staff.category,
        shift: shiftName,
        dateIn: dateInStr,
        dateOut: "",
        officerName: globalOfficer.trim(),
        notes: "",
      });
    }
  };

  const handleKembalikanPassport = (record: PassportHandoverRecord) => {
    let dateOutStr = "";
    if ((record.shift || "PAGI").toUpperCase() === "MALAM") {
      // Date Out is Day after Date In
      const parts = record.dateIn.split("-");
      const y = parseInt(parts[0]);
      const m = parseInt(parts[1]) - 1;
      const d = parseInt(parts[2]);
      
      const dateInObj = new Date(y, m, d);
      dateInObj.setDate(dateInObj.getDate() + 1);
      
      const outY = dateInObj.getFullYear();
      const outM = String(dateInObj.getMonth() + 1).padStart(2, "0");
      const outD = String(dateInObj.getDate()).padStart(2, "0");
      dateOutStr = `${outY}-${outM}-${outD}`;
    } else {
      // Date Out is same day as Date In for Pagi
      dateOutStr = record.dateIn;
    }

    onUpdateRecord({
      ...record,
      dateOut: dateOutStr,
    });
  };

  const handleEditNotes = (record: PassportHandoverRecord) => {
    requestInput(
      "EDIT CATATAN / KETERANGAN",
      `Masukkan Catatan Baru Untuk ${record.staffName.toUpperCase()}:`,
      "TULIS CATATAN DISINI...",
      record.notes,
      (newNotes) => {
        onUpdateRecord({
          ...record,
          notes: newNotes.trim(),
        });
      }
    );
  };

  const getCategoryBadgeClass = (category: string) => {
    const cat = category.toUpperCase();
    if (cat === "CS LINE") {
      return "bg-emerald-950/40 border-emerald-900/30 text-emerald-400";
    }
    if (cat === "CS LC") {
      return "bg-indigo-950/40 border-indigo-900/30 text-indigo-400";
    }
    if (cat === "KAPTEN KASIR") {
      return "bg-rose-950/40 border-rose-900/30 text-rose-400";
    }
    if (cat === "KASIR") {
      return "bg-amber-950/40 border-amber-900/30 text-amber-400";
    }
    return "bg-slate-950/30 border-slate-900/30 text-slate-400";
  };

  const renderTable = (staffList: StaffShift[], isPagi: boolean) => {
    const accentClass = isPagi ? "from-emerald-500 to-teal-500" : "from-blue-500 to-indigo-500";
    const textAccentClass = isPagi ? "text-emerald-400" : "text-blue-400";
    const bgAccentClass = isPagi ? "bg-emerald-950/20 border-emerald-900/30 text-emerald-400" : "bg-blue-950/20 border-blue-900/30 text-blue-400";
    const titleText = isPagi ? "SHIFT PAGI" : "SHIFT MALAM";
    const Icon = isPagi ? Sun : Moon;
    const currentShiftStr = isPagi ? "PAGI" : "MALAM";

    return (
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 shadow-xl overflow-hidden relative flex flex-col">
        <div className={`absolute top-0 left-0 h-1.5 w-full bg-gradient-to-r ${accentClass}`} />
        <div className="px-5 py-4 border-b border-slate-900 bg-slate-950/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className={`h-4.5 w-4.5 ${textAccentClass}`} />
            <h4 className={`text-xs font-black uppercase tracking-widest font-mono ${textAccentClass}`}>{titleText}</h4>
          </div>
          <span className={`text-[9px] font-black border px-2.5 py-1 rounded-lg font-mono ${bgAccentClass}`}>
            {staffList.length} STAFF
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-900">
                <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono border-r border-slate-900">Nama Staff</th>
                <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono border-r border-slate-900">No. Paspor</th>
                <th className="px-4 py-3 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono border-r border-slate-900">Jabatan</th>
                <th className="px-4 py-3 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono border-r border-slate-900">Masuk</th>
                <th className="px-4 py-3 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono border-r border-slate-900">Pulang</th>
                <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono border-r border-slate-900">Petugas</th>
                <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono border-r border-slate-900">Catatan / Keterangan</th>
                <th className="px-4 py-3 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {staffList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-xs text-slate-500 font-bold uppercase tracking-wider font-mono">
                    TIDAK ADA DATA SERAH TERIMA UNTUK {titleText}
                  </td>
                </tr>
              ) : (
                staffList.flatMap((staff, index) => {
                  const activeRecord = records.find(
                    (r) => r.staffName === staff.name && !r.dateOut && (r.shift || "PAGI").toUpperCase() === currentShiftStr && r.dateIn === currentDateStr
                  );
                  const returnedRecord = [...records]
                    .reverse()
                    .find(
                      (r) => r.staffName === staff.name && r.dateOut && (r.shift || "PAGI").toUpperCase() === currentShiftStr && r.dateIn === currentDateStr
                    );

                  const isHeld = activeRecord && !!activeRecord.dateIn;
                  const isReturned = !!returnedRecord;
                  const isReceived = isHeld || isReturned;

                  // Define status-based row background colors and hover glow
                  let rowBgClass = "";
                  let borderLeftStyle = "";

                  if (isHeld) {
                    rowBgClass = "bg-emerald-950/15 hover:bg-emerald-950/25 transition-colors border-b border-slate-900/50";
                    borderLeftStyle = "border-l-4 border-l-emerald-500";
                  } else if (isReturned) {
                    rowBgClass = "bg-blue-950/15 hover:bg-blue-950/25 transition-colors border-b border-slate-900/50";
                    borderLeftStyle = "border-l-4 border-l-blue-500";
                  } else {
                    rowBgClass = "bg-rose-950/5 hover:bg-rose-950/12 transition-colors border-b border-slate-900/50";
                    borderLeftStyle = "border-l-4 border-l-rose-500/25";
                  }

                  // Inject divider row when department changes
                  const isNewGroup = index > 0 && staff.category !== staffList[index - 1].category;
                  const dividerRow = isNewGroup ? (
                    <tr key={`divider-${staff.category}-${staff.id}`} className="bg-slate-950">
                      <td colSpan={8} className="p-0 border-b border-slate-900/80">
                        <div className="h-2.5 bg-gradient-to-r from-slate-955 via-slate-900/60 to-slate-955 border-y border-slate-900/60" />
                      </td>
                    </tr>
                  ) : null;

                  const staffRow = (
                    <tr key={staff.id} className={rowBgClass}>
                      {/* 1. Nama Staff */}
                      <td className={`px-4 py-3 text-xs text-slate-200 font-bold font-mono border-r border-slate-900/30 ${borderLeftStyle}`}>
                        {staff.name}
                      </td>

                      {/* 2. No. Paspor */}
                      <td className="px-4 py-3 text-xs font-bold font-mono border-r border-slate-900/30">
                        {isReceived ? (
                          <span className={isHeld ? textAccentClass : "text-slate-500"}>
                            {isHeld ? activeRecord.passportNo : (returnedRecord ? returnedRecord.passportNo : "-")}
                          </span>
                        ) : (
                          <div className="text-slate-550/60 font-bold">
                            {(() => {
                              const masterMatch = masterPassports.find(
                                (m) => m.name.trim().toUpperCase() === staff.name.trim().toUpperCase() && m.passportNo !== "-"
                              );
                              if (masterMatch) return masterMatch.passportNo;
                              const history = records.find(
                                (r) => r.staffName.trim().toUpperCase() === staff.name.trim().toUpperCase() && r.passportNo !== "-"
                              );
                              return history ? history.passportNo : "-";
                            })()}
                          </div>
                        )}
                      </td>


                      {/* 3. Jabatan */}
                      <td className="px-4 py-3 text-[10px] font-bold font-mono border-r border-slate-900/30 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded border text-[9px] font-black tracking-wider ${getCategoryBadgeClass(staff.category)}`}>
                          {staff.category}
                        </span>
                      </td>

                      {/* 4. Masuk (Tombol BELUM / SELESAI) */}
                      <td className="px-4 py-3 text-xs font-bold font-mono border-r border-slate-900/30 text-center">
                        {isReceived ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="bg-emerald-950/40 text-emerald-455 border border-emerald-900/30 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider block">
                              SELESAI
                            </span>
                            <span className="text-[9px] text-slate-500 font-bold block">
                              {isHeld ? activeRecord.dateIn : returnedRecord?.dateIn}
                            </span>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleTerimaPassport(staff, currentShiftStr)}
                            className="bg-rose-950/20 hover:bg-rose-950 border border-rose-900/45 hover:border-rose-700 text-rose-455 text-[9px] font-black px-2.5 py-1 rounded-lg transition-all cursor-pointer uppercase font-mono shadow-md shadow-rose-950/10 active:scale-95"
                            title="Klik untuk Terima Paspor"
                          >
                            BELUM
                          </button>
                        )}
                      </td>

                      {/* 5. Pulang (Tombol BELUM / SELESAI dengan verifikasi Masuk) */}
                      <td className="px-4 py-3 text-xs font-bold font-mono border-r border-slate-900/30 text-center">
                        {!isReceived ? (
                          <button
                            disabled
                            className="bg-slate-900 border border-slate-855 text-slate-600 text-[9px] font-black px-2.5 py-1 rounded-lg uppercase font-mono cursor-not-allowed opacity-40"
                            title="Wajib Terima Paspor terlebih dahulu"
                          >
                            BELUM
                          </button>
                        ) : isHeld ? (
                          <button
                            onClick={() => handleKembalikanPassport(activeRecord)}
                            className="bg-blue-950/20 hover:bg-blue-950 border border-blue-900 hover:border-blue-700 text-blue-400 text-[9px] font-black px-2.5 py-1 rounded-lg transition-all cursor-pointer uppercase font-mono shadow-md shadow-blue-950/10 active:scale-95 animate-pulse"
                            title="Klik untuk Kembalikan Paspor"
                          >
                            BELUM
                          </button>
                        ) : (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="bg-blue-950/40 text-blue-400 border border-blue-900/30 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider block">
                              SELESAI
                            </span>
                            <span className="text-[9px] text-slate-500 font-bold block">
                              {returnedRecord?.dateOut}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* 6. Petugas */}
                      <td className="px-4 py-3 text-xs text-slate-355 font-bold font-mono border-r border-slate-900/30">
                        {isHeld ? activeRecord.officerName : (returnedRecord ? returnedRecord.officerName : "-")}
                      </td>

                      {/* 7. Catatan / Keterangan (Pencil Edit Icon inside cell always) */}
                      <td className="px-4 py-3 text-[10px] text-slate-400 font-bold font-mono border-r border-slate-900/30">
                        <div className="flex items-center gap-2 justify-between">
                          <span className="truncate max-w-[155px]" title={activeRecord ? activeRecord.notes : (returnedRecord?.notes || "")}>
                            {activeRecord ? (activeRecord.notes || "-") : (returnedRecord ? (returnedRecord.notes || "-") : "-")}
                          </span>
                          <button
                            onClick={() => {
                              const recordToEdit = activeRecord || returnedRecord;
                              if (recordToEdit) {
                                handleEditNotes(recordToEdit);
                              } else {
                                requestInput(
                                  "TAMBAH CATATAN MANUAL",
                                  `MASUKKAN CATATAN / KETERANGAN UNTUK ${staff.name.toUpperCase()}:`,
                                  "TULIS CATATAN DISINI...",
                                  "",
                                  (notesInput) => {
                                    onAddRecord({
                                      staffName: staff.name,
                                      passportNo: "-",
                                      position: staff.category,
                                      shift: currentShiftStr,
                                      dateIn: "",
                                      dateOut: "",
                                      officerName: globalOfficer || "-",
                                      notes: notesInput.trim(),
                                    });
                                  }
                                );
                              }
                            }}
                            className="text-slate-500 hover:text-teal-455 p-1 rounded hover:bg-slate-950 transition-colors cursor-pointer border border-slate-850/50 shrink-0"
                            title="Isi/Edit Keterangan Secara Manual"
                          >
                            <Edit2 className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      </td>

                      {/* 8. Aksi (Hanya Hapus Pendataan) */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center">
                          {activeRecord ? (
                            <button
                              onClick={() => onDeleteRecord(activeRecord.id)}
                              className="text-slate-500 hover:text-rose-455 p-1.5 rounded hover:bg-slate-950 transition-colors cursor-pointer border border-transparent hover:border-slate-850"
                              title="Hapus Pendataan"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            returnedRecord && (
                              <button
                                onClick={() => onDeleteRecord(returnedRecord.id)}
                                className="text-slate-600 hover:text-rose-455 p-1.5 rounded hover:bg-slate-950 transition-colors cursor-pointer"
                                title="Hapus Riwayat Lama"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  );

                  return dividerRow ? [dividerRow, staffRow] : [staffRow];
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header Row with Active Officer Selection Selector */}
      <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest font-mono">
            Petugas Serah Terima
          </label>
          <div className="flex items-center gap-2.5">
            {/* Styled Select Box */}
            <div className="relative flex items-center bg-white border border-slate-200 rounded-xl px-3 py-2 w-72 text-slate-800 shadow-sm h-11">
              <span className="text-teal-500 mr-2 shrink-0">
                <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </span>
              <select
                value={globalOfficer}
                onChange={(e) => setGlobalOfficer(e.target.value)}
                className="w-full bg-transparent border-none text-xs font-black font-mono uppercase text-slate-800 focus:outline-none cursor-pointer pr-6 appearance-none"
              >
                <option value="" className="text-slate-500">— Tidak Ada Petugas —</option>
                {finalOfficers.map((o, idx) => (
                  <option key={`global-officer-${idx}`} value={o.name} className="text-slate-800">
                    {o.name} ({o.category})
                  </option>
                ))}
              </select>
              <span className="absolute right-3.5 pointer-events-none text-slate-400">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </div>

            {/* Back Button / Reset Button */}
            <button
              type="button"
              onClick={() => setGlobalOfficer("")}
              className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 h-11 w-11 rounded-xl flex items-center justify-center text-xs font-black shadow-sm active:scale-95 transition-all cursor-pointer font-mono"
              title="Reset Petugas"
            >
              &lt;
            </button>
          </div>
        </div>

        {/* Status block */}
        <div className="text-right hidden md:block">
          <span className="text-[10px] font-black text-slate-400 block font-mono">STATUS PETUGAS AKTIF</span>
          <span className={`text-xs font-black uppercase font-mono mt-1.5 block px-3 py-1.5 rounded-lg border w-fit ml-auto ${
            globalOfficer 
              ? "bg-emerald-950/20 text-emerald-400 border-emerald-900/30" 
              : "bg-amber-950/20 text-amber-400 border-amber-900/30"
          }`}>
            {globalOfficer ? `AKTIF: ${globalOfficer}` : "BELUM DIPILIH"}
          </span>
        </div>
      </div>

      {/* Mini Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 shadow-xl flex items-center justify-between relative overflow-hidden group">
          <div className="absolute top-0 left-0 h-[3px] w-full bg-gradient-to-r from-amber-500 to-orange-500" />
          <div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block font-mono">PASPOR DITAHAN (KANTOR)</span>
            <span className="text-xl font-black text-amber-400 tracking-tight block mt-1">{totalHeld} PASPOR</span>
          </div>
          <div className="h-10 w-10 bg-amber-950/30 text-amber-400 border border-amber-900/30 rounded-xl flex items-center justify-center">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 shadow-xl flex items-center justify-between relative overflow-hidden group">
          <div className="absolute top-0 left-0 h-[3px] w-full bg-gradient-to-r from-emerald-500 to-teal-500" />
          <div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block font-mono">DIKEMBALIKAN KE STAFF</span>
            <span className="text-xl font-black text-emerald-450 tracking-tight block mt-1">{totalReturned} PASPOR</span>
          </div>
          <div className="h-10 w-10 bg-emerald-950/30 text-emerald-450 border border-emerald-900/30 rounded-xl flex items-center justify-center">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 shadow-xl flex items-center justify-between relative overflow-hidden group">
          <div className="absolute top-0 left-0 h-[3px] w-full bg-gradient-to-r from-teal-500 to-blue-500" />
          <div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block font-mono">TOTAL PENDATAAN DOKUMEN</span>
            <span className="text-xl font-black text-teal-400 tracking-tight block mt-1">{records.length} RIWAYAT</span>
          </div>
          <div className="h-10 w-10 bg-teal-950/30 text-teal-400 border border-teal-900/30 rounded-xl flex items-center justify-center">
            <Search className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Action Bar (Search & Shift Toggle Buttons) */}
      <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="CARI STAFF, PASPOR, JABATAN..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-850 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-655 focus:ring-2 focus:ring-teal-500/40 focus:outline-none uppercase font-mono tracking-wider transition-all"
          />
        </div>

        {/* Shift Toggle Buttons */}
        <div className="flex items-center gap-2 p-1 bg-slate-950 border border-slate-850 rounded-2xl w-fit shrink-0 self-center sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveShiftTab("PAGI")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black tracking-wider uppercase transition-all cursor-pointer border ${
              activeShiftTab === "PAGI"
                ? "bg-gradient-to-br from-emerald-500/15 to-teal-500/10 text-emerald-400 shadow-md border-emerald-500/30"
                : "text-slate-400 hover:text-slate-200 border-transparent"
            }`}
          >
            <Sun className="h-4 w-4" />
            Shift Pagi
          </button>
          <button
            type="button"
            onClick={() => setActiveShiftTab("MALAM")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black tracking-wider uppercase transition-all cursor-pointer border ${
              activeShiftTab === "MALAM"
                ? "bg-gradient-to-br from-blue-500/15 to-indigo-500/10 text-blue-400 shadow-md border-blue-500/30"
                : "text-slate-400 hover:text-slate-200 border-transparent"
            }`}
          >
            <Moon className="h-4 w-4" />
            Shift Malam
          </button>
        </div>
      </div>

      {/* The Active Table */}
      <div className="space-y-6">
        {activeShiftTab === "PAGI" ? renderTable(sortedPagiStaff, true) : renderTable(sortedMalamStaff, false)}
      </div>

      {/* Custom Luxury Input Prompt Modal Overlay */}
      {inputModal.isOpen && (
        <div className="fixed inset-0 bg-slate-955/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in animate-duration-300">
          <form
            onSubmit={handleModalSubmit}
            className="bg-slate-900 border-2 border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative overflow-hidden flex flex-col gap-4 animate-zoom-in animate-duration-300"
          >
            {/* Top accent line */}
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-teal-500 to-emerald-500"></div>

            {/* Header Title */}
            <h4 className="text-sm font-black text-slate-100 uppercase tracking-widest font-mono border-b border-slate-800/80 pb-2.5">
              {inputModal.title}
            </h4>

            {/* Field Label / Description */}
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">
              {inputModal.description}
            </label>

            {/* Input field */}
            <input
              type="text"
              required={inputModal.title === "EDIT NOMOR PASPOR"}
              placeholder={inputModal.placeholder}
              value={modalInputValue}
              onChange={(e) => setModalInputValue(e.target.value)}
              className="w-full bg-slate-950 border border-slate-855 rounded-xl px-4 py-3 text-xs text-slate-200 placeholder-slate-655 focus:ring-2 focus:ring-teal-500/40 focus:outline-none uppercase font-mono tracking-wider transition-all"
              autoFocus
            />

            {/* Action buttons */}
            <div className="flex items-center gap-2.5 pt-2 border-t border-slate-800/80">
              <button
                type="submit"
                className="flex-1 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-955 text-xs font-black py-3 rounded-xl shadow-lg shadow-teal-500/10 active:scale-95 transition-all cursor-pointer uppercase tracking-wider text-center"
              >
                SIMPAN
              </button>
              <button
                type="button"
                onClick={() => setInputModal((prev) => ({ ...prev, isOpen: false }))}
                className="flex-1 bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-black py-3 rounded-xl transition-all cursor-pointer border border-slate-700/80 active:scale-95 uppercase tracking-wider text-center"
              >
                BATALKAN
              </button>
            </div>
          </form>
        </div>
      )}
      {/* Custom Luxury Notification / Alert Modal Overlay */}
      {notifyModal.isOpen && (
        <div className="fixed inset-0 bg-slate-955/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl p-7 w-full max-w-sm shadow-2xl relative overflow-hidden flex flex-col items-center gap-5">
            {/* Top accent bar */}
            <div className={`absolute top-0 left-0 w-full h-1.5 ${
              notifyModal.icon === "warn"
                ? "bg-gradient-to-r from-amber-500 to-orange-500"
                : notifyModal.icon === "success"
                ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                : "bg-gradient-to-r from-blue-500 to-indigo-500"
            }`} />

            {/* Icon circle */}
            <div className={`h-14 w-14 rounded-2xl flex items-center justify-center text-2xl border ${
              notifyModal.icon === "warn"
                ? "bg-amber-950/40 border-amber-900/40 text-amber-400"
                : notifyModal.icon === "success"
                ? "bg-emerald-950/40 border-emerald-900/40 text-emerald-400"
                : "bg-blue-950/40 border-blue-900/40 text-blue-400"
            }`}>
              {notifyModal.icon === "warn" ? "⚠" : notifyModal.icon === "success" ? "✓" : "ℹ"}
            </div>

            {/* Message */}
            <p className="text-xs font-black text-slate-100 uppercase tracking-wider font-mono text-center leading-relaxed">
              {notifyModal.message}
            </p>

            {/* OK button */}
            <button
              type="button"
              onClick={() => setNotifyModal((p) => ({ ...p, isOpen: false }))}
              className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer shadow-lg ${
                notifyModal.icon === "warn"
                  ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-amber-500/15"
                  : notifyModal.icon === "success"
                  ? "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-emerald-500/15"
                  : "bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 text-white shadow-blue-500/15"
              }`}
            >
              MENGERTI
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
