/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { StaffShift, ClockInLog, MONTHS_INDONESIAN } from "../types";
import { FileDown, RotateCcw, Clipboard, Check, Upload, Download, Copy, AlertTriangle, Database, Link, RefreshCw, Eye, EyeOff, ShieldCheck, Cpu } from "lucide-react";
import { getGasUrl, saveGasUrl, testGasConnection, syncAllToGoogleSheets } from "../utils/googleSheets";

interface ImportExportProps {
  staffShifts: StaffShift[];
  logs: ClockInLog[];
  onResetToDefault: () => void;
  onImportState: (newState: { staffShifts: StaffShift[]; logs: ClockInLog[] }) => void;
  selectedMonth: number;
  selectedYear: number;
  syncStatus: "synced" | "syncing" | "error" | "unconfigured";
  setSyncStatus: (status: "synced" | "syncing" | "error" | "unconfigured") => void;
}

export default function ImportExport({
  staffShifts,
  logs,
  onResetToDefault,
  onImportState,
  selectedMonth,
  selectedYear,
  syncStatus,
  setSyncStatus,
}: ImportExportProps) {
  const [jsonInput, setJsonInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  // States untuk Google Sheets Sync
  const [gasUrl, setGasUrlInput] = useState(() => getGasUrl());
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testMessage, setTestMessage] = useState("");
  const [syncAllStatus, setSyncAllStatus] = useState<"idle" | "syncing" | "success" | "error">("idle");
  const [syncAllMessage, setSyncAllMessage] = useState("");
  const [showGasCode, setShowGasCode] = useState(false);
  const [gasCodeCopied, setGasCodeCopied] = useState(false);

  // Kode GAS untuk disalin user
  const GOOGLE_APPS_SCRIPT_CODE = `/**
 * GOOGLE APPS SCRIPT (GAS) UNTUK SINKRONISASI OTOMATIS ABSENSI WDBOS
 * ----------------------------------------------------------------
 * Kode ini mendeteksi perubahan jadwal shift dan absen masuk secara real-time.
 * Membuat Nama Sheet dan Nama Header secara otomatis dan terformat rapi!
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Membuat sheet otomatis jika belum ada
    var sheetShift = getOrCreateSheet(ss, "JADWAL_SHIFT");
    var sheetLogs = getOrCreateSheet(ss, "ABSENSI_LOGS");
    
    // Membuat header otomatis & format artistik
    initHeaders(sheetShift, "shift");
    initHeaders(sheetLogs, "logs");
    
    if (action === "test") {
      return jsonResponse({ status: "success", message: "KONEKSI SINKRONISASI AKTIF! SPREADSHEET SIAP DIGUNAKAN." });
    }
    
    if (action === "upsert_log") {
      var log = data.log;
      if (!log) {
        return jsonResponse({ status: "error", message: "DATA LOG TIDAK DITEMUKAN" });
      }
      upsertSingleLog(sheetLogs, log, data.selectedMonth, data.selectedYear);
      return jsonResponse({ status: "success", message: "LOG BERHASIL DISINKRONISASI" });
    }
    
    if (action === "delete_log") {
      var logId = data.logId;
      if (!logId) {
        return jsonResponse({ status: "error", message: "ID LOG TIDAK DITEMUKAN" });
      }
      deleteSingleLog(sheetLogs, logId);
      return jsonResponse({ status: "success", message: "LOG BERHASIL DIHAPUS DARI SPREADSHEET" });
    }
    
    if (action === "sync_all") {
      var staffShifts = data.staffShifts || [];
      var logs = data.logs || [];
      var selectedMonth = data.selectedMonth;
      var selectedYear = data.selectedYear;
      
      syncAllShifts(sheetShift, staffShifts, selectedMonth, selectedYear);
      syncAllLogs(sheetLogs, logs, selectedMonth, selectedYear);
      
      return jsonResponse({ 
        status: "success", 
        message: "SINKRONISASI PENUH BERHASIL! " + staffShifts.length + " STAF DAN " + logs.length + " LOG TELAH DISINKRONKAN." 
      });
    }
    
    if (action === "read_data") {
      var readResult = handleReadData(data.selectedMonth, data.selectedYear);
      return jsonResponse(readResult);
    }
    
    return jsonResponse({ status: "error", message: "AKSI TIDAK DIKENAL" });
    
  } catch (error) {
    return jsonResponse({ status: "error", message: error.toString() });
  }
}

function doGet(e) {
  return HtmlService.createHtmlOutput(
    "<h1 style='font-family:sans-serif;color:#0f172a;'>KONEKSI SPREADSHEET ABSENSI WDBOS AKTIF</h1>" +
    "<p style='font-family:sans-serif;color:#334155;'>Sistem Google Apps Script Web App Anda berjalan dengan baik dan lancar.</p>" +
    "<p style='font-family:sans-serif;color:#14b8a6;font-weight:bold;'>Silakan salin URL Web App ini dan tempel di dashboard Absensi Staff!</p>"
  );
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

function initHeaders(sheet, type) {
  if (sheet.getLastRow() > 0) return; // Headers sudah ada, lewati
  
  sheet.clear();
  var headers = [];
  if (type === "shift") {
    headers = ["ID STAFF", "NAMA STAFF", "DIVISI", "BULAN", "TAHUN"];
    for (var i = 1; i <= 31; i++) {
      headers.push("HARI " + i);
    }
  } else if (type === "logs") {
    headers = [
      "ID LOG", 
      "TANGGAL", 
      "HARI", 
      "BULAN", 
      "TAHUN", 
      "NAMA STAFF", 
      "DIVISI", 
      "SHIFT", 
      "BATAS JAM MASUK", 
      "JAM ABSEN", 
      "STATUS", 
      "WAKTU SINKRON"
    ];
  }
  
  sheet.appendRow(headers);
  
  // Mempercantik tampilan Header
  var range = sheet.getRange(1, 1, 1, headers.length);
  range.setFontWeight("bold");
  range.setBackground("#0f172a"); // Slate 900
  range.setFontColor("#14b8a6"); // Teal 400
  range.setFontFamily("Arial");
  range.setHorizontalAlignment("center");
  sheet.setFrozenRows(1);
}

function upsertSingleLog(sheet, log, selectedMonth, selectedYear) {
  var data = sheet.getDataRange().getValues();
  var logId = log.id;
  var rowIdx = -1;
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === logId) {
      rowIdx = i + 1;
      break;
    }
  }
  
  var monthsIndo = ["JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI", "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER"];
  var monthName = monthsIndo[selectedMonth] || "JULI";
  var formattedDate = selectedYear + "-" + String(selectedMonth + 1).padStart(2, '0') + "-" + String(log.day).padStart(2, '0');
  
  var rowValues = [
    logId,
    formattedDate,
    log.day,
    monthName,
    selectedYear,
    log.staffName,
    log.category,
    log.shift,
    log.shift === "1" ? "07:45:00" : "19:45:00",
    log.clockInTime,
    log.status,
    new Date().toISOString()
  ];
  
  if (rowIdx !== -1) {
    var range = sheet.getRange(rowIdx, 1, 1, rowValues.length);
    range.setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }
}

function deleteSingleLog(sheet, logId) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === logId) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
}

function syncAllShifts(sheet, staffShifts, selectedMonth, selectedYear) {
  sheet.clearContents();
  initHeaders(sheet, "shift");
  
  if (staffShifts.length === 0) return;
  
  var monthsIndo = ["JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI", "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER"];
  var monthName = monthsIndo[selectedMonth] || "JULI";
  
  var rows = [];
  for (var i = 0; i < staffShifts.length; i++) {
    var s = staffShifts[i];
    var row = [
      s.id,
      s.name,
      s.category,
      monthName,
      selectedYear
    ];
    for (var d = 0; d < 31; d++) {
      row.push(s.schedule[d] || "");
    }
    rows.push(row);
  }
  
  var range = sheet.getRange(2, 1, rows.length, rows[0].length);
  range.setValues(rows);
}

function syncAllLogs(sheet, logs, selectedMonth, selectedYear) {
  sheet.clearContents();
  initHeaders(sheet, "logs");
  
  if (logs.length === 0) return;
  
  var monthsIndo = ["JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI", "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER"];
  var monthName = monthsIndo[selectedMonth] || "JULI";
  
  var rows = [];
  for (var i = 0; i < logs.length; i++) {
    var log = logs[i];
    var formattedDate = selectedYear + "-" + String(selectedMonth + 1).padStart(2, '0') + "-" + String(log.day).padStart(2, '0');
    var row = [
      log.id,
      formattedDate,
      log.day,
      monthName,
      selectedYear,
      log.staffName,
      log.category,
      log.shift,
      log.shift === "1" ? "07:45:00" : "19:45:00",
      log.clockInTime,
      log.status,
      log.timestamp || new Date().toISOString()
    ];
    rows.push(row);
  }
  
  var range = sheet.getRange(2, 1, rows.length, rows[0].length);
  range.setValues(rows);
}

function handleReadData(selectedMonth, selectedYear) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var monthsIndo = ["JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI", "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER"];
  var monthName = monthsIndo[selectedMonth] || "JULI";
  
  var staffShifts = [];
  var sheetShift = ss.getSheetByName("JADWAL_SHIFT");
  if (sheetShift && sheetShift.getLastRow() > 1) {
    var data = sheetShift.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (row[0] && row[3] === monthName && Number(row[4]) === selectedYear) {
        var schedule = [];
        for (var d = 5; d < 36; d++) {
          schedule.push(row[d] !== undefined ? String(row[d]) : "1");
        }
        staffShifts.push({
          id: row[0],
          name: row[1],
          category: row[2],
          schedule: schedule
        });
      }
    }
  }
  
  var logs = [];
  var sheetLogs = ss.getSheetByName("ABSENSI_LOGS");
  if (sheetLogs && sheetLogs.getLastRow() > 1) {
    var data = sheetLogs.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (row[0] && row[3] === monthName && Number(row[4]) === selectedYear) {
        logs.push({
          id: row[0],
          staffId: row[0].split("-").slice(2).join("-"),
          staffName: row[5],
          category: row[6],
          day: Number(row[2]) || 1,
          shift: String(row[7]) || "1",
          clockInTime: row[9] || "",
          status: row[10] || "ON TIME",
          timestamp: row[11] || new Date().toISOString(),
          month: selectedMonth,
          year: selectedYear
        });
      }
    }
  }
  
  return {
    success: true,
    staffShifts: staffShifts,
    logs: logs
  };
}`;

  const handleSaveGasUrl = () => {
    saveGasUrl(gasUrl);
    setSyncStatus(gasUrl ? "synced" : "unconfigured");
    alert("URL GOOGLE APPS SCRIPT BERHASIL DISIMPAN!");
  };

  const handleTestConnection = async () => {
    if (!gasUrl.trim()) {
      alert("SILAKAN MASUKKAN URL GOOGLE APPS SCRIPT WEB APP TERLEBIH DAHULU!");
      return;
    }
    setTestStatus("testing");
    setTestMessage("Sedang menguji koneksi ke server Google Apps Script...");
    
    const result = await testGasConnection(gasUrl);
    if (result.success) {
      setTestStatus("success");
      setTestMessage(result.message);
      saveGasUrl(gasUrl);
      setSyncStatus("synced");
    } else {
      setTestStatus("error");
      setTestMessage(result.message);
      setSyncStatus("error");
    }
  };

  const handleFullSync = async () => {
    if (!getGasUrl()) {
      alert("SILAKAN ATUR DAN SIMPAN URL GOOGLE APPS SCRIPT WEB APP TERLEBIH DAHULU!");
      return;
    }
    setSyncAllStatus("syncing");
    setSyncAllMessage("Sedang mengirim semua data shift dan log kehadiran ke Google Sheets...");
    setSyncStatus("syncing");

    const result = await syncAllToGoogleSheets(staffShifts, logs, selectedMonth, selectedYear);
    if (result.success) {
      setSyncAllStatus("success");
      setSyncAllMessage(result.message);
      setSyncStatus("synced");
    } else {
      setSyncAllStatus("error");
      setSyncAllMessage(result.message);
      setSyncStatus("error");
    }
  };

  const handleCopyGasCode = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
    setGasCodeCopied(true);
    setTimeout(() => setGasCodeCopied(false), 2500);
  };

  const handleExportSpreadsheetCSV = () => {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    // Generate headers for Selected Month (1 to daysInMonth)
    const headers = ["Nama Staff", "Divisi", ...Array.from({ length: daysInMonth }, (_, i) => `Tgl ${i + 1}`)];
    
    // Rows
    const rows = staffShifts.map((staff) => [
      staff.name,
      staff.category,
      ...staff.schedule,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((row) => row.map((val) => `"${val}"`).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `jadwal_shift_staff_${MONTHS_INDONESIAN[selectedMonth].toLowerCase()}_${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportLogsCSV = () => {
    if (logs.length === 0) {
      alert("Belum ada log absensi untuk diexport!");
      return;
    }
    const headers = ["Nama Staff", "Divisi", `Tanggal (${MONTHS_INDONESIAN[selectedMonth]} ${selectedYear})`, "Shift", "Jam Masuk", "Status Kehadiran", "Waktu Sistem"];
    const rows = logs.map((log) => [
      log.staffName,
      log.category,
      `Hari ${log.day}`,
      log.shift,
      log.clockInTime,
      log.status,
      log.timestamp,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((row) => row.map((val) => `"${val}"`).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `log_absen_staff_${MONTHS_INDONESIAN[selectedMonth].toLowerCase()}_${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyJSON = () => {
    const fullState = { staffShifts, logs };
    navigator.clipboard.writeText(JSON.stringify(fullState, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleImportJSON = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      if (parsed.staffShifts && Array.isArray(parsed.staffShifts)) {
        onImportState(parsed);
        setJsonInput("");
        setSuccessMsg("Berhasil memulihkan semua data dari backup JSON!");
        setTimeout(() => setSuccessMsg(""), 4000);
      } else {
        alert("Format JSON tidak valid! Pastikan mengandung field 'staffShifts'.");
      }
    } catch (e) {
      alert("Format JSON salah! Silakan periksa kembali teks yang ditempel.");
    }
  };

  return (
    <div className="space-y-6" id="import-export-container">
      
      {/* ========================================================= */}
      {/* GOOGLE SPREADSHEETS AUTOMATIC SYNC CARD (LUXURIOUS DESIGN) */}
      {/* ========================================================= */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <Database className="h-40 w-40 text-teal-400" />
        </div>
        
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-teal-950/80 border border-teal-800/60 rounded-xl flex items-center justify-center text-teal-400">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-black text-slate-100 text-sm tracking-wide uppercase font-mono">INTEGRASI REAL-TIME GOOGLE SHEET</h3>
                <p className="text-[10px] text-slate-400 font-medium">SINKRONISASI OTOMATIS DATA ABSENSI DAN SHIFT KERJA</p>
              </div>
            </div>
            
            <div className="flex items-center gap-1.5 self-start md:self-auto">
              <span className="text-[9px] font-black text-slate-400 font-mono uppercase">STATUS:</span>
              {syncStatus === "synced" && (
                <span className="bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full font-mono uppercase">TERHUBUNG</span>
              )}
              {syncStatus === "syncing" && (
                <span className="bg-amber-950/60 border border-amber-500/40 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full font-mono uppercase animate-pulse">MENYINKRONKAN...</span>
              )}
              {syncStatus === "error" && (
                <span className="bg-rose-950/60 border border-rose-500/40 text-rose-400 text-[10px] font-bold px-2 py-0.5 rounded-full font-mono uppercase">ERROR</span>
              )}
              {syncStatus === "unconfigured" && (
                <span className="bg-slate-850 border border-slate-750 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full font-mono uppercase">BELUM DISET</span>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-xs text-slate-400 leading-relaxed font-mono">
              SISTEM SECARA OTOMATIS AKAN MENGIRIM DATA PRESENSI SETIAP ADA AKTIVITAS <span className="text-teal-400 font-bold">MASUK</span> ATAU <span className="text-rose-400 font-bold">BATAL</span> DI DASHBOARD HARIAN. UNTUK MENGGUNAKAN FITUR INI, DEPLOY KODE GOOGLE APPS SCRIPT DI BAWAH KE SPREADSHEET ANDA.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
              <div className="lg:col-span-8 space-y-1.5">
                <label className="text-[10px] font-black text-teal-400 font-mono tracking-wider flex items-center gap-1.5">
                  <Link className="h-3.5 w-3.5" /> URL GOOGLE APPS SCRIPT WEB APP
                </label>
                <input
                  type="text"
                  placeholder="https://script.google.com/macros/s/.../exec"
                  value={gasUrl}
                  onChange={(e) => setGasUrlInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-600 rounded-xl px-3 py-2.5 text-xs font-mono focus:outline-none focus:border-teal-500 transition-colors"
                />
              </div>

              <div className="lg:col-span-4 flex gap-2">
                <button
                  onClick={handleSaveGasUrl}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-black uppercase tracking-wider py-2.5 rounded-xl cursor-pointer border border-slate-700 font-mono transition-colors"
                >
                  SIMPAN URL
                </button>
                <button
                  onClick={handleTestConnection}
                  disabled={testStatus === "testing"}
                  className="flex-1 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-slate-950 text-[10px] font-black uppercase tracking-wider py-2.5 rounded-xl cursor-pointer font-mono transition-all flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className={`h-3 w-3 ${testStatus === "testing" ? "animate-spin" : ""}`} />
                  TEST KONEKSI
                </button>
              </div>
            </div>

            {testMessage && (
              <div className={`p-3 rounded-xl border text-xs font-mono ${
                testStatus === "success" 
                  ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-400" 
                  : "bg-rose-950/40 border-rose-500/30 text-rose-400"
              }`}>
                ⚡ {testMessage}
              </div>
            )}

            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleFullSync}
                disabled={syncAllStatus === "syncing"}
                className="flex-1 bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 text-xs font-black uppercase tracking-wider py-3 rounded-xl cursor-pointer font-mono hover:shadow-lg hover:shadow-teal-500/15 transition-all flex items-center justify-center gap-2 border border-teal-400/30"
              >
                <Database className="h-4 w-4" />
                SINKRONISASI PENUH SEKARANG (FORCE SYNC)
              </button>
              
              <button
                onClick={() => setShowGasCode(!showGasCode)}
                className="bg-slate-950 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 text-xs font-black uppercase tracking-wider px-5 py-3 rounded-xl cursor-pointer font-mono transition-colors flex items-center justify-center gap-2"
              >
                {showGasCode ? <EyeOff className="h-4 w-4 text-rose-400" /> : <Eye className="h-4 w-4 text-teal-400" />}
                {showGasCode ? "TUTUP KODE GAS" : "LIHAT KODE GAS (GAS SCRIPT)"}
              </button>
            </div>

            {syncAllMessage && (
              <div className={`p-3 rounded-xl border text-xs font-mono ${
                syncAllStatus === "success" 
                  ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-400" 
                  : "bg-rose-950/40 border-rose-500/30 text-rose-400"
              }`}>
                🤖 {syncAllMessage}
              </div>
            )}

            {/* EXPANDABLE GAS CODE PANEL */}
            {showGasCode && (
              <div className="border border-slate-800 rounded-2xl p-4 bg-slate-950 space-y-4 animate-fade-in">
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-900">
                  <div className="flex items-center gap-1.5 text-xs font-black text-slate-300 uppercase font-mono">
                    <Cpu className="h-4 w-4 text-teal-500" />
                    KODE GOOGLE APPS SCRIPT (COPY-PASTE)
                  </div>
                  <button
                    onClick={handleCopyGasCode}
                    className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-black uppercase px-3 py-1.5 rounded-lg transition-colors cursor-pointer font-mono"
                  >
                    {gasCodeCopied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    {gasCodeCopied ? "BERHASIL DISALIN!" : "SALIN KODE GAS"}
                  </button>
                </div>

                <div className="space-y-2 text-xs text-slate-400 leading-relaxed font-mono">
                  <p className="text-teal-400 font-bold uppercase">Langkah Setup Google Spreadsheet & Apps Script:</p>
                  <ol className="list-decimal pl-5 space-y-1 text-[11px]">
                    <li>Buka Google Spreadsheet baru atau yang sudah ada di akun Google Anda.</li>
                    <li>Di menu atas, klik <span className="font-bold text-slate-200">Ekstensi (Extensions)</span> &gt; <span className="font-bold text-slate-200">Apps Script</span>.</li>
                    <li>Hapus seluruh kode bawaan di dalam editor script, lalu tempelkan (paste) seluruh Kode GAS di bawah.</li>
                    <li>Klik ikon <span className="font-bold text-slate-200">Simpan (Save / Ctrl+S)</span>.</li>
                    <li>Klik tombol <span className="font-bold text-teal-400">Terapkan (Deploy)</span> di kanan atas &gt; <span className="font-bold text-slate-200">Terapkan Baru (New deployment)</span>.</li>
                    <li>Pilih jenis terapkan: <span className="font-bold text-slate-200">Aplikasi Web (Web app)</span>.</li>
                    <li>Atur Konfigurasi:
                      <ul className="list-disc pl-5 mt-0.5 space-y-0.5">
                        <li>Jalankan sebagai: <span className="font-bold text-teal-400">Saya (Me)</span>.</li>
                        <li>Siapa yang memiliki akses: <span className="font-bold text-teal-400">Siapa saja (Anyone)</span>.</li>
                      </ul>
                    </li>
                    <li>Klik <span className="font-bold text-slate-200">Terapkan (Deploy)</span>, setujui izin (jika diminta, izinkan akun Anda).</li>
                    <li>Salin <span className="font-bold text-teal-400">URL Aplikasi Web (Web App URL)</span> yang dihasilkan, lalu tempelkan ke kolom URL di atas dan klik <span className="font-bold text-slate-200">SIMPAN URL</span> atau <span className="font-bold text-slate-200">TEST KONEKSI</span>!</li>
                  </ol>
                </div>

                <div className="relative">
                  <pre className="text-[10px] bg-slate-900/50 text-slate-300 font-mono p-4 rounded-xl overflow-x-auto max-h-80 border border-slate-900 select-all leading-normal">
                    {GOOGLE_APPS_SCRIPT_CODE}
                  </pre>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* CSV Downloads */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="space-y-2">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <Download className="h-4.5 w-4.5 text-teal-600" />
              Download Spreadsheet (CSV)
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Export seluruh tabel jadwal shift staff ({new Date(selectedYear, selectedMonth + 1, 0).getDate()} hari di bulan {MONTHS_INDONESIAN[selectedMonth]} {selectedYear}) sebagai file CSV. File ini bisa langsung Anda buka di <strong>Google Sheets</strong>, <strong>Microsoft Excel</strong>, atau spreadsheet lainnya.
            </p>
          </div>
          <button
            id="download-spreadsheet-csv-btn"
            onClick={handleExportSpreadsheetCSV}
            className="mt-6 flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs py-3 rounded-xl transition-colors cursor-pointer w-full shadow-sm"
          >
            <FileDown className="h-4 w-4" />
            Unduh Jadwal Shift (.csv)
          </button>
        </div>


        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="space-y-2">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <Download className="h-4.5 w-4.5 text-blue-600" />
              Download Log Absensi (CSV)
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Unduh semua log kedatangan staff yang sudah diinput/clock-in sebagai file CSV. Sempurna untuk merekap keterlambatan, mencatat ketepatan waktu, dan menggaji karyawan di akhir bulan.
            </p>
          </div>
          <button
            id="download-logs-csv-btn"
            onClick={handleExportLogsCSV}
            className="mt-6 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs py-3 rounded-xl transition-colors cursor-pointer w-full shadow-sm"
          >
            <FileDown className="h-4 w-4" />
            Unduh Log Kedatangan (.csv)
          </button>
        </div>
      </div>

      {/* Backup and Restore via JSON */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
        <div>
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2 mb-2">
            <Upload className="h-4.5 w-4.5 text-purple-600" />
            Backup & Restore Data Lokal (JSON)
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Karena data disimpan di browser Anda (LocalStorage), data Anda aman dari penyegaran halaman. Namun, jika Anda membersihkan cache browser, data akan hilang. Gunakan fitur Backup ini untuk menyalin seluruh data Anda ke file teks aman, dan pulihkan kembali kapan saja!
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <div className="space-y-3">
            <span className="text-[11px] font-bold text-slate-500 block uppercase tracking-wider">Langkah 1: Backup / Salin Data Anda</span>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed">
                Klik tombol di bawah untuk menyalin seluruh data (Tabel Shift + Log Absensi) dalam format JSON ke papan klip Anda.
              </p>
              <button
                id="copy-json-btn"
                onClick={handleCopyJSON}
                className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition-colors cursor-pointer"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                {copied ? "Berhasil Disalin!" : "Salin Kode Backup JSON"}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <span className="text-[11px] font-bold text-slate-500 block uppercase tracking-wider">Langkah 2: Pulihkan / Restore Data</span>
            <div className="space-y-3">
              <textarea
                id="restore-json-textarea"
                placeholder="Tempel / Paste kode backup JSON Anda di sini..."
                rows={4}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all text-slate-700"
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
              />
              <button
                id="restore-json-btn"
                onClick={handleImportJSON}
                disabled={!jsonInput.trim()}
                className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white font-semibold text-xs py-2.5 rounded-lg transition-colors cursor-pointer shadow-sm"
              >
                <Upload className="h-4 w-4" />
                Pulihkan Data dari Teks JSON
              </button>
              {successMsg && (
                <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs rounded-xl font-medium animate-fade-in">
                  {successMsg}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-rose-50/50 border border-rose-100 rounded-2xl p-6 space-y-4">
        <h4 className="font-bold text-rose-800 text-sm flex items-center gap-2">
          <AlertTriangle className="h-4.5 w-4.5 text-rose-600" />
          Zona Bahaya (Danger Zone)
        </h4>
        <p className="text-xs text-rose-700 leading-relaxed">
          Menyetel ulang sistem akan menghapus semua perubahan jadwal shift yang Anda lakukan di spreadsheet, menghapus semua staff baru yang Anda tambahkan, dan membersihkan seluruh log kedatangan yang terekam. Sistem akan kembali ke kondisi awal (default {MONTHS_INDONESIAN[selectedMonth]} {selectedYear}).
        </p>
        <button
          id="reset-system-btn"
          onClick={() => {
            if (window.confirm("Apakah Anda yakin ingin menyetel ulang sistem? Semua perubahan dan log absensi akan terhapus selamanya.")) {
              onResetToDefault();
              alert(`Sistem berhasil disetel ulang ke kondisi bawaan ${MONTHS_INDONESIAN[selectedMonth]} ${selectedYear}!`);
            }
          }}
          className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm shadow-rose-100 cursor-pointer"
        >
          Reset Seluruh Sistem
        </button>
      </div>
    </div>
  );
}
