/**
 * GOOGLE APPS SCRIPT (GAS) - JADWAL & ABSENSI HARIAN OTOMATIS
 * 
 * SCRIPT INI DIDONGKRAK UNTUK KECEPATAN SINKRONISASI TINGGI, AKURASI MAKSIMAL, 
 * DAN INTEGRASI SYSTEM CLOUD DEPLOYMENT SEPERTI VERCEL MAUPUN GITHUB.
 * 
 * CARA MEMASANG:
 * 1. Buka spreadsheet target Anda di Google Sheets.
 * 2. Klik menu 'Extensions' -> 'Apps Script'.
 * 3. Hapus semua kode default, lalu tempelkan seluruh kode di bawah ini.
 * 4. Klik ikon Simpan (Save).
 * 5. Klik 'Deploy' -> 'New deployment'.
 * 6. Pilih 'Web app'. Setel:
 *    - Description: "SINKRONISASI JADWAL ABSENSI"
 *    - Execute as: "Me" (Email Anda)
 *    - Who has access: "Anyone" (Agar Vercel & GitHub build aman mengakses API)
 * 7. Klik 'Deploy', setujui otorisasi akun Google Anda.
 * 8. Salin (Copy) URL Web App yang dihasilkan, lalu tempelkan ke kolom URL di aplikasi dashboard Anda!
 */

// SETTING & NAMA SHEET UTAMA
var SHEET_LOGS_NAME = "ABSENSI_LOGS";
var SHEET_STAFF_PREFIX = "JADWAL_"; // Akan dibuat otomatis JADWAL_JANUARI_2026, dst.

// DAFTAR NAMA BULAN UNTUK SHEET JADWAL OTOMATIS
var MONTH_NAMES = [
  "JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI",
  "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER"
];

/**
 * Handle HTTP POST Request (Akses utama dari Dashboard Web App Vercel/GitHub)
 */
function doPost(e) {
  var responseOutput = "";
  var success = false;
  var message = "";
  
  try {
    // Parse data JSON yang dikirim oleh dashboard
    var requestData = JSON.parse(e.postData.contents);
    var action = requestData.action;
    
    if (action === "test") {
      success = true;
      message = "KONEKSI BERHASIL! GOOGLE APPS SCRIPT AKTIF DAN SIAP MENERIMA SINKRONISASI.";
    } 
    else if (action === "upsert_log") {
      success = handleUpsertLog(requestData.log, requestData.selectedMonth, requestData.selectedYear);
      message = success ? "LOG BERHASIL DI-UPSERT!" : "GAGAL MENG-UPSERT LOG.";
    } 
    else if (action === "delete_log") {
      success = handleDeleteLog(requestData.logId);
      message = success ? "LOG BERHASIL DIHAPUS!" : "LOG TIDAK DITEMUKAN ATAU GAGAL DIHAPUS.";
    } 
    else if (action === "sync_all") {
      success = handleSyncAll(
        requestData.staffShifts, 
        requestData.logs, 
        requestData.selectedMonth, 
        requestData.selectedYear
      );
      message = success ? "SINKRONISASI JADWAL DAN ABSENSI PENUH BERHASIL!" : "GAGAL MENSINKRONKAN DATA PENUH.";
    } 
    else if (action === "read_data") {
      var readResult = handleReadData(requestData.selectedMonth, requestData.selectedYear);
      return ContentService.createTextOutput(JSON.stringify(readResult))
        .setMimeType(ContentService.MimeType.JSON);
    }
    else {
      message = "AKSI TIDAK DIKENAL: " + action;
    }
  } catch (error) {
    success = false;
    message = "TERJADI ERROR DI SCRIPT: " + error.toString();
  }
  
  // Return respons dalam format JSON JSONP/JSON compliant untuk CORS bypass
  var result = { success: success, message: message };
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handle HTTP GET Request (Untuk pengujian cepat di browser)
 */
function doGet() {
  var result = {
    success: true,
    message: "GOOGLE APPS SCRIPT WEB APP AKTIF DAN BERJALAN. GUNAKAN METODE HTTP POST UNTUK PENGIRIMAN DATA."
  };
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 1. MENDAPATKAN ATAU MEMBUAT SHEET SECARA OTOMATIS BESERTA HEADER-NYA
 */
function getOrCreateSheet(sheetName, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    // Buat format header otomatis
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
         .setBackground("#0F172A") // Elegant Dark Slate background
         .setFontColor("#F8FAFC") // Off-white text
         .setFontWeight("bold")
         .setHorizontalAlignment("center");
    
    // Auto-adjust column width
    sheet.autoResizeColumns(1, headers.length);
  }
  
  return sheet;
}

/**
 * 2. HANDLE SINGLE LOG UPSERT (LOG MASUK / PULANG ABSENSI)
 */
function handleUpsertLog(log, selectedMonth, selectedYear) {
  var headers = [
    "LOG_ID", "STAFF_ID", "NAMA_STAFF", "KATEGORI", "TANGGAL", "HARI_KE",
    "JAM_MASUK", "FOTO_MASUK", "LOKASI_MASUK", "STATUS_TERLAMBAT",
    "JAM_PULANG", "FOTO_PULANG", "LOKASI_PULANG", "SINKRON_PADA"
  ];
  
  var sheet = getOrCreateSheet(SHEET_LOGS_NAME, headers);
  var data = sheet.getDataRange().getValues();
  
  var logRowIndex = -1;
  // Cari apakah LOG_ID sudah pernah ada sebelumnya
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === log.id) {
      logRowIndex = i + 1; // 1-based index untuk row
      break;
    }
  }
  
  var formattedDate = selectedYear + "-" + String(selectedMonth + 1).padStart(2, '0') + "-" + String(log.day).padStart(2, '0');
  var rowValues = [
    log.id,
    log.staffId,
    log.staffName,
    log.category,
    formattedDate,
    log.day,
    log.clockInTime || "",
    "", // FOTO_MASUK
    "", // LOKASI_MASUK
    log.status === "TERLAMBAT" ? "TERLAMBAT" : "TEPAT WAKTU",
    "", // JAM_PULANG
    "", // FOTO_PULANG
    "", // LOKASI_PULANG
    new Date().toISOString()
  ];
  
  if (logRowIndex !== -1) {
    // Update baris lama
    sheet.getRange(logRowIndex, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    // Tambah baris baru di paling bawah
    sheet.appendRow(rowValues);
  }
  
  return true;
}

/**
 * 3. HANDLE DELETE LOG
 */
function handleDeleteLog(logId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_LOGS_NAME);
  if (!sheet) return false;
  
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === logId) {
      sheet.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

/**
 * 4. SINKRONISASI PENUH (ALL STAFF SHIFTS & ALL LOGS)
 * Dirancang dengan batch update agar hemat kuota eksekusi Google Sheets dan respons secepat kilat.
 */
function handleSyncAll(staffShifts, logs, selectedMonth, selectedYear) {
  var monthName = MONTH_NAMES[selectedMonth] || "BULAN_DI_LUAR_JANGKAUAN";
  var sheetJadwalName = SHEET_STAFF_PREFIX + monthName + "_" + selectedYear;
  
  // --- A. SYNC JADWAL SHIFT STAFF ---
  // Tentukan header jadwal: STAFF_ID, NAMA_STAFF, DIVISI, TGL_1, TGL_2, ..., TGL_31
  var jadwalHeaders = ["STAFF_ID", "NAMA_STAFF", "DIVISI"];
  for (var day = 1; day <= 31; day++) {
    jadwalHeaders.push("TGL_" + day);
  }
  
  var sheetJadwal = getOrCreateSheet(sheetJadwalName, jadwalHeaders);
  sheetJadwal.clearContents(); // Reset data lama tetapi pertahankan format layout
  
  // Setel ulang header agar selalu segar
  sheetJadwal.getRange(1, 1, 1, jadwalHeaders.length).setValues([jadwalHeaders]);
  sheetJadwal.getRange(1, 1, 1, jadwalHeaders.length)
             .setBackground("#0F172A")
             .setFontColor("#F8FAFC")
             .setFontWeight("bold")
             .setHorizontalAlignment("center");
  
  // Siapkan baris data jadwal baru
  var jadwalRows = [];
  if (staffShifts && staffShifts.length > 0) {
    staffShifts.forEach(function(staff) {
      var row = [staff.id, staff.name, staff.category];
      // Isi jadwal tanggal 1 sampai 31
      for (var d = 0; d < 31; d++) {
        row.push(staff.schedule[d] || "1"); // Default shift 1
      }
      jadwalRows.push(row);
    });
    
    // Tulis data batch sekaligus (super cepat)
    sheetJadwal.getRange(2, 1, jadwalRows.length, jadwalHeaders.length).setValues(jadwalRows);
  }
  
  // --- B. SYNC LOGS ABSENSI ---
  var logHeaders = [
    "LOG_ID", "STAFF_ID", "NAMA_STAFF", "KATEGORI", "TANGGAL", "HARI_KE",
    "JAM_MASUK", "FOTO_MASUK", "LOKASI_MASUK", "STATUS_TERLAMBAT",
    "JAM_PULANG", "FOTO_PULANG", "LOKASI_PULANG", "SINKRON_PADA"
  ];
  var sheetLogs = getOrCreateSheet(SHEET_LOGS_NAME, logHeaders);
  sheetLogs.clearContents();
  
  // Setel ulang header logs
  sheetLogs.getRange(1, 1, 1, logHeaders.length).setValues([logHeaders]);
  sheetLogs.getRange(1, 1, 1, logHeaders.length)
           .setBackground("#0F172A")
           .setFontColor("#F8FAFC")
           .setFontWeight("bold")
           .setHorizontalAlignment("center");
  
  var logRows = [];
  if (logs && logs.length > 0) {
    logs.forEach(function(log) {
      var logMonth = log.month !== undefined ? log.month : selectedMonth;
      var logYear = log.year !== undefined ? log.year : selectedYear;
      var formattedDate = logYear + "-" + String(logMonth + 1).padStart(2, '0') + "-" + String(log.day).padStart(2, '0');
      logRows.push([
        log.id,
        log.staffId,
        log.staffName,
        log.category,
        formattedDate,
        log.day,
        log.clockInTime || "",
        "", // FOTO_MASUK
        "", // LOKASI_MASUK
        log.status === "TERLAMBAT" ? "TERLAMBAT" : "TEPAT WAKTU",
        "", // JAM_PULANG
        "", // FOTO_PULANG
        "", // LOKASI_PULANG
        new Date().toISOString()
      ]);
    });
    
    // Tulis data batch logs sekaligus
    sheetLogs.getRange(2, 1, logRows.length, logHeaders.length).setValues(logRows);
  }
  
  // Auto-resize columns agar tidak terpotong
  sheetJadwal.autoResizeColumns(1, 5);
  sheetLogs.autoResizeColumns(1, 6);
  
  return true;
}

/**
 * 5. HANDLE READ ALL DATA (STAFF SHIFTS & LOGS)
 */
function handleReadData(selectedMonth, selectedYear) {
  var monthName = MONTH_NAMES[selectedMonth] || "BULAN_DI_LUAR_JANGKAUAN";
  var sheetJadwalName = SHEET_STAFF_PREFIX + monthName + "_" + selectedYear;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Baca Jadwal Staf
  var staffShifts = [];
  var sheetJadwal = ss.getSheetByName(sheetJadwalName);
  if (sheetJadwal && sheetJadwal.getLastRow() > 1) {
    var data = sheetJadwal.getDataRange().getValues();
    // Headers: STAFF_ID, NAMA_STAFF, DIVISI, TGL_1 ... TGL_31
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (row[0]) {
        var schedule = [];
        for (var d = 3; d < 34; d++) {
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
  
  // 2. Baca Log Kehadiran
  var logs = [];
  var sheetLogs = ss.getSheetByName(SHEET_LOGS_NAME);
  if (sheetLogs && sheetLogs.getLastRow() > 1) {
    var data = sheetLogs.getDataRange().getValues();
    // Headers: LOG_ID, STAFF_ID, NAMA_STAFF, KATEGORI, TANGGAL, HARI_KE, JAM_MASUK, FOTO_MASUK, LOKASI_MASUK, STATUS_TERLAMBAT, JAM_PULANG ...
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (row[0]) {
        var dateVal = row[4];
        var logMonth = selectedMonth;
        var logYear = selectedYear;
        if (dateVal) {
          var dObj = new Date(dateVal);
          if (!isNaN(dObj.getTime())) {
            logMonth = dObj.getMonth();
            logYear = dObj.getFullYear();
          }
        }
        
        if (logMonth === selectedMonth && logYear === selectedYear) {
          var clockInTime = row[6] || "";
          var shift = "1";
          if (clockInTime && clockInTime.indexOf("19:") !== -1) {
            shift = "2";
          }
          var statusVal = row[9] === "TERLAMBAT" ? "TERLAMBAT" : "ON TIME";
          logs.push({
            id: row[0],
            staffId: row[1],
            staffName: row[2],
            category: row[3],
            day: Number(row[5]) || 1,
            shift: shift,
            clockInTime: clockInTime,
            status: statusVal,
            timestamp: row[13] || new Date().toISOString(),
            month: logMonth,
            year: logYear
          });
        }
      }
    }
  }
  
  return {
    success: true,
    staffShifts: staffShifts,
    logs: logs
  };
}
