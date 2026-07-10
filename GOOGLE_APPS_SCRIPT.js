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
var SHEET_PASSPORTS_NAME = "SERAH_TERIMA_PASPOR";
var SHEET_MASTER_PASSPORTS_NAME = "MASTER_PASPOR";
var SHEET_PETUGAS_NAME = "PETUGAS_SERAH_TERIMA";
var SHEET_PASSPORT_HISTORY_PAGI = "PASPOR_HISTORY_PAGI";
var SHEET_PASSPORT_HISTORY_MALAM = "PASPOR_HISTORY_MALAM";

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
    else if (action === "sync_schedule") {
      success = handleSyncSchedule(
        requestData.staffShifts,
        requestData.selectedMonth,
        requestData.selectedYear
      );
      message = success ? "SINKRONISASI JADWAL BERHASIL!" : "GAGAL MENSINKRONKAN JADWAL.";
    }
    else if (action === "sync_all") {
      success = handleSyncAll(
        requestData.staffShifts, 
        requestData.logs, 
        requestData.passports || [],
        requestData.selectedMonth, 
        requestData.selectedYear
      );
      message = success ? "SINKRONISASI DATA PENUH BERHASIL!" : "GAGAL MENSINKRONKAN DATA PENUH.";
    } 
    else if (action === "upsert_passport") {
      success = handleUpsertPassport(requestData.passport);
      message = success ? "PASPOR BERHASIL DI-UPSERT!" : "GAGAL MENG-UPSERT DATA PASPOR.";
    }
    else if (action === "delete_passport") {
      success = handleDeletePassport(requestData.passportId);
      message = success ? "DATA PASPOR BERHASIL DIHAPUS!" : "DATA PASPOR TIDAK DITEMUKAN ATAU GAGAL DIHAPUS.";
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
  }
  
  // Jika sheet kosong (tidak ada baris data), buat format header otomatis
  if (sheet.getLastRow() === 0 && headers && headers.length > 0) {
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
 * 3b. SINKRONISASI JADWAL SHIFT STAFF (CEPAT & INDEPENDEN)
 */
function handleSyncSchedule(staffShifts, selectedMonth, selectedYear) {
  var monthName = MONTH_NAMES[selectedMonth] || "BULAN_DI_LUAR_JANGKAUAN";
  var sheetJadwalName = SHEET_STAFF_PREFIX + monthName + "_" + selectedYear;
  
  var jadwalHeaders = ["STAFF_ID", "NAMA_STAFF", "DIVISI"];
  for (var day = 1; day <= 31; day++) {
    jadwalHeaders.push("TGL_" + day);
  }
  
  var sheetJadwal = getOrCreateSheet(sheetJadwalName, jadwalHeaders);
  sheetJadwal.clearContents();
  
  sheetJadwal.getRange(1, 1, 1, jadwalHeaders.length).setValues([jadwalHeaders]);
  sheetJadwal.getRange(1, 1, 1, jadwalHeaders.length)
             .setBackground("#0F172A")
             .setFontColor("#F8FAFC")
             .setFontWeight("bold")
             .setHorizontalAlignment("center");
  
  var jadwalRows = [];
  if (staffShifts && staffShifts.length > 0) {
    staffShifts.forEach(function(staff) {
      var row = [staff.id, staff.name, staff.category];
      for (var d = 0; d < 31; d++) {
        row.push(staff.schedule[d] || "1");
      }
      jadwalRows.push(row);
    });
    sheetJadwal.getRange(2, 1, jadwalRows.length, jadwalHeaders.length).setValues(jadwalRows);
  }
  // sheetJadwal.autoResizeColumns(1, 5); // Dinonaktifkan karena memperlambat sinkronisasi rutin
  return true;
}

/**
 * 4. SINKRONISASI PENUH (ALL STAFF SHIFTS, ALL LOGS, & ALL PASSPORTS)
 * Dirancang dengan batch update agar hemat kuota eksekusi Google Sheets dan respons secepat kilat.
 */
function handleSyncAll(staffShifts, logs, passports, selectedMonth, selectedYear) {
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
  
  // --- C. SYNC & AUDIT LOGS SERAH TERIMA PASPOR ---
  var passportHeaders = ["ID", "NAMA_STAFF", "NO_PASPOR", "JABATAN", "SHIFT", "MASUK", "PULANG", "PETUGAS", "CATATAN_KETERANGAN", "SINKRON_PADA"];
  var sheetPassports = getOrCreateSheet(SHEET_PASSPORTS_NAME, passportHeaders);
  
  // 1. Ambil data paspor lama di Google Sheets sebelum di-overwrite, untuk dibandingkan demi history audit
  var oldPassports = [];
  if (sheetPassports.getLastRow() > 1) {
    var oldData = sheetPassports.getDataRange().getValues();
    for (var i = 1; i < oldData.length; i++) {
      var row = oldData[i];
      if (row[0]) {
        var dateInStr = "";
        if (row[5] instanceof Date) {
          dateInStr = Utilities.formatDate(row[5], Session.getScriptTimeZone(), "yyyy-MM-dd");
        } else {
          dateInStr = row[5] ? String(row[5]).split("T")[0] : "";
        }
        
        var dateOutStr = "";
        if (row[6] instanceof Date) {
          dateOutStr = Utilities.formatDate(row[6], Session.getScriptTimeZone(), "yyyy-MM-dd");
        } else {
          dateOutStr = row[6] ? String(row[6]).split("T")[0] : "";
        }

        oldPassports.push({
          id: String(row[0]),
          staffName: String(row[1]),
          passportNo: String(row[2]),
          position: String(row[3]),
          shift: String(row[4] || "PAGI"),
          dateIn: dateInStr,
          dateOut: dateOutStr,
          officerName: String(row[7] || ""),
          notes: String(row[8] || "")
        });
      }
    }
  }

  // 2. Buat/Dapatkan sheet HISTORY PAGI & MALAM dan sheets pembantu lainnya
  var historyHeaders = ["WAKTU", "NAMA_STAFF", "NO_PASPOR", "AKSI", "PETUGAS", "CATATAN_KETERANGAN"];
  var sheetHistoryPagi = getOrCreateSheet(SHEET_PASSPORT_HISTORY_PAGI, historyHeaders);
  var sheetHistoryMalam = getOrCreateSheet(SHEET_PASSPORT_HISTORY_MALAM, historyHeaders);
  
  var masterPassportHeaders = ["NAMA_STAFF", "NO_PASPOR", "JABATAN"];
  var sheetMaster = getOrCreateSheet(SHEET_MASTER_PASSPORTS_NAME, masterPassportHeaders);
  
  var petugasHeaders = ["NAMA_PETUGAS", "JABATAN"];
  var sheetPetugas = getOrCreateSheet(SHEET_PETUGAS_NAME, petugasHeaders);

  var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");

  // Tampungan data riwayat untuk batch write
  var historyPagiRows = [];
  var historyMalamRows = [];

  function queueHistoryLog(ppt, aksi, keterangan) {
    var shift = (ppt.shift || "PAGI").toUpperCase();
    var row = [
      timestamp,
      ppt.staffName,
      ppt.passportNo,
      aksi,
      ppt.officerName || "-",
      keterangan
    ];
    if (shift === "MALAM") {
      historyMalamRows.push(row);
    } else {
      historyPagiRows.push(row);
    }
  }

  // 3. Bandingkan data lama vs baru untuk mencatat riwayat perubahan (history)
  oldPassports.forEach(function(oldPpt) {
    var matchingNew = passports.find(function(n) { return n.id === oldPpt.id; });
    if (!matchingNew) {
      // Data dihapus
      queueHistoryLog(oldPpt, "HAPUS PENDATAAN", "HAPUS DARI DAFTAR");
    } else {
      if (!oldPpt.dateOut && matchingNew.dateOut) {
        // Baru pulang/checkout
        queueHistoryLog(matchingNew, "KEMBALIKAN PASPOR", matchingNew.notes || "SUDAH DIKEMBALIKAN");
      } else if (oldPpt.notes !== matchingNew.notes) {
        // Edit catatan
        queueHistoryLog(matchingNew, "EDIT CATATAN", "DARI: '" + oldPpt.notes + "' MENJADI: '" + matchingNew.notes + "'");
      } else if (oldPpt.passportNo !== matchingNew.passportNo) {
        // Edit nomor paspor
        queueHistoryLog(matchingNew, "EDIT NOMOR PASPOR", "DARI: '" + oldPpt.passportNo + "' MENJADI: '" + matchingNew.passportNo + "'");
      }
    }
  });

  passports.forEach(function(newPpt) {
    var matchingOld = oldPassports.find(function(o) { return o.id === newPpt.id; });
    if (!matchingOld && newPpt.dateIn) {
      // Check-in baru
      queueHistoryLog(newPpt, "TERIMA PASPOR", newPpt.notes || "PASPOR DITERIMA DI KANTOR");
    }
  });

  // Tulis data riwayat secara massal (batch write) agar super cepat
  if (historyPagiRows.length > 0) {
    sheetHistoryPagi.getRange(sheetHistoryPagi.getLastRow() + 1, 1, historyPagiRows.length, 6).setValues(historyPagiRows);
  }
  if (historyMalamRows.length > 0) {
    sheetHistoryMalam.getRange(sheetHistoryMalam.getLastRow() + 1, 1, historyMalamRows.length, 6).setValues(historyMalamRows);
  }

  // 4. Overwrite data paspor aktif ke Google Sheets
  sheetPassports.clearContents();
  sheetPassports.getRange(1, 1, 1, passportHeaders.length).setValues([passportHeaders]);
  sheetPassports.getRange(1, 1, 1, passportHeaders.length)
               .setBackground("#0F172A")
               .setFontColor("#F8FAFC")
               .setFontWeight("bold")
               .setHorizontalAlignment("center");
               
  var passportRows = [];
  if (passports && passports.length > 0) {
    passports.forEach(function(ppt) {
      passportRows.push([
        ppt.id,
        ppt.staffName,
        ppt.passportNo,
        ppt.position,
        ppt.shift || "PAGI",
        ppt.dateIn || "",
        ppt.dateOut || "",
        ppt.officerName || "",
        ppt.notes || "",
        new Date().toISOString()
      ]);
    });
    
    sheetPassports.getRange(2, 1, passportRows.length, passportHeaders.length).setValues(passportRows);
  }

  // 5. Inisialisasi/Pre-populasi MASTER_PASPOR secara cerdas (JANGAN HAPUS ATAU OVERWRITE DATA LAMA)
  var existingMasterNames = [];
  if (sheetMaster.getLastRow() > 1) {
    var masterData = sheetMaster.getDataRange().getValues();
    for (var mIdx = 1; mIdx < masterData.length; mIdx++) {
      if (masterData[mIdx][0]) {
        existingMasterNames.push(String(masterData[mIdx][0]).trim().toUpperCase());
      }
    }
  }

  if (staffShifts && staffShifts.length > 0) {
    var newMasterRows = [];
    staffShifts.forEach(function(s) {
      var staffNameUpper = s.name.trim().toUpperCase();
      if (existingMasterNames.indexOf(staffNameUpper) === -1) {
        newMasterRows.push([s.name, "-", s.category]);
      }
    });
    if (newMasterRows.length > 0) {
      sheetMaster.getRange(sheetMaster.getLastRow() + 1, 1, newMasterRows.length, 3).setValues(newMasterRows);
    }
  }

  // Auto-resize columns dinonaktifkan untuk mempercepat sinkronisasi rutin
  // sheetJadwal.autoResizeColumns(1, 5);
  // sheetLogs.autoResizeColumns(1, 6);
  // sheetPassports.autoResizeColumns(1, passportHeaders.length);
  // sheetMaster.autoResizeColumns(1, 3);
  // sheetPetugas.autoResizeColumns(1, 2);
  // sheetHistoryPagi.autoResizeColumns(1, 6);
  // sheetHistoryMalam.autoResizeColumns(1, 6);
  
  return true;
}

/**
 * 4b. HANDLE UPSERT SATU RECORD SERAH TERIMA PASPOR (INSERT ATAU UPDATE)
 */
function handleUpsertPassport(ppt) {
  if (!ppt || !ppt.id) return false;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var passportHeaders = ["ID", "NAMA_STAFF", "NO_PASPOR", "JABATAN", "SHIFT", "MASUK", "PULANG", "PETUGAS", "CATATAN_KETERANGAN", "SINKRON_PADA"];
  var sheetPassports = getOrCreateSheet(SHEET_PASSPORTS_NAME, passportHeaders);
  var historyHeaders = ["WAKTU", "NAMA_STAFF", "NO_PASPOR", "AKSI", "PETUGAS", "CATATAN_KETERANGAN"];
  var sheetHistoryPagi  = getOrCreateSheet(SHEET_PASSPORT_HISTORY_PAGI, historyHeaders);
  var sheetHistoryMalam = getOrCreateSheet(SHEET_PASSPORT_HISTORY_MALAM, historyHeaders);

  var shiftHistory = (String(ppt.shift || "PAGI").toUpperCase() === "MALAM") ? sheetHistoryMalam : sheetHistoryPagi;
  var now = new Date();
  var timestamp = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");

  // Cek apakah record sudah ada di sheet (cari berdasarkan ID di kolom 1)
  var lastRow = sheetPassports.getLastRow();
  var found = false;
  if (lastRow > 1) {
    var ids = sheetPassports.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === String(ppt.id)) {
        var rowIndex = i + 2;
        var oldRow = sheetPassports.getRange(rowIndex, 1, 1, passportHeaders.length).getValues()[0];
        sheetPassports.getRange(rowIndex, 1, 1, passportHeaders.length).setValues([[
          ppt.id,
          ppt.staffName,
          ppt.passportNo,
          ppt.position || "-",
          ppt.shift || "PAGI",
          ppt.dateIn || "",
          ppt.dateOut || "",
          ppt.officerName || "-",
          ppt.notes || "",
          timestamp
        ]]);
        found = true;

        // Catat ke history: TERIMA (dateIn baru pertama kali diisi)
        var oldDateIn  = String(oldRow[5] || "");
        var oldDateOut = String(oldRow[6] || "");
        if (!oldDateIn && ppt.dateIn) {
          shiftHistory.appendRow([timestamp, ppt.staffName, ppt.passportNo, "TERIMA PASPOR", ppt.officerName || "-", "MASUK: " + ppt.dateIn]);
        } else if (!oldDateOut && ppt.dateOut) {
          shiftHistory.appendRow([timestamp, ppt.staffName, ppt.passportNo, "KEMBALIKAN PASPOR", ppt.officerName || "-", "KEMBALI: " + ppt.dateOut]);
        } else if (String(oldRow[2]) !== String(ppt.passportNo)) {
          shiftHistory.appendRow([timestamp, ppt.staffName, ppt.passportNo, "EDIT NOMOR PASPOR", ppt.officerName || "-", "DARI: '" + oldRow[2] + "' -> '" + ppt.passportNo + "'"]);
        } else if (String(oldRow[8] || "") !== String(ppt.notes || "")) {
          shiftHistory.appendRow([timestamp, ppt.staffName, ppt.passportNo, "EDIT CATATAN", ppt.officerName || "-", "DARI: '" + (oldRow[8] || "-") + "' -> '" + (ppt.notes || "-") + "'"]);
        }
        break;
      }
    }
  }

  // Jika belum ada (record baru), append row baru
  if (!found) {
    sheetPassports.appendRow([
      ppt.id,
      ppt.staffName,
      ppt.passportNo,
      ppt.position || "-",
      ppt.shift || "PAGI",
      ppt.dateIn || "",
      ppt.dateOut || "",
      ppt.officerName || "-",
      ppt.notes || "",
      timestamp
    ]);
    // Catat ke history sebagai TERIMA PASPOR baru
    shiftHistory.appendRow([timestamp, ppt.staffName, ppt.passportNo, "TERIMA PASPOR", ppt.officerName || "-", "MASUK: " + (ppt.dateIn || "-")]);
  }

  return true;
}

/**
 * 4c. HANDLE HAPUS SATU RECORD SERAH TERIMA PASPOR BERDASARKAN ID
 */
function handleDeletePassport(passportId) {
  if (!passportId) return false;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetPassports = ss.getSheetByName(SHEET_PASSPORTS_NAME);
  if (!sheetPassports || sheetPassports.getLastRow() <= 1) return false;

  var ids = sheetPassports.getRange(2, 1, sheetPassports.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(passportId)) {
      var rowIndex = i + 2;
      var row = sheetPassports.getRange(rowIndex, 1, 1, 9).getValues()[0];
      
      // Log ke history sebelum dihapus
      var historyHeaders = ["WAKTU", "NAMA_STAFF", "NO_PASPOR", "AKSI", "PETUGAS", "CATATAN_KETERANGAN"];
      var sheetHistoryPagi = getOrCreateSheet(SHEET_PASSPORT_HISTORY_PAGI, historyHeaders);
      var sheetHistoryMalam = getOrCreateSheet(SHEET_PASSPORT_HISTORY_MALAM, historyHeaders);
      var shift = String(row[4] || "PAGI").toUpperCase();
      var targetSheet = shift === "MALAM" ? sheetHistoryMalam : sheetHistoryPagi;
      var now = new Date();
      var timestamp = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
      
      targetSheet.appendRow([
        timestamp,
        String(row[1]),
        String(row[2]),
        "HAPUS PENDATAAN",
        String(row[7] || "-"),
        "HAPUS DARI DAFTAR"
      ]);

      sheetPassports.deleteRow(rowIndex);
      return true;
    }
  }
  return false;
}

/**
 * 5. HANDLE READ ALL DATA (STAFF SHIFTS, LOGS, PASSPORTS, MASTER PASSPORTS, & OFFICERS)
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
          var clockInTime = "";
          if (row[6] instanceof Date) {
            clockInTime = Utilities.formatDate(row[6], Session.getScriptTimeZone(), "HH:mm:ss");
          } else {
            var rawStr = row[6] !== undefined && row[6] !== null ? String(row[6]) : "";
            var timeMatch = rawStr.match(/\b\d{2}:\d{2}:\d{2}\b/);
            clockInTime = timeMatch ? timeMatch[0] : rawStr;
          }
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
  
  // 3. Baca Serah Terima Paspor Aktif
  var passports = [];
  var sheetPassports = ss.getSheetByName(SHEET_PASSPORTS_NAME);
  if (sheetPassports && sheetPassports.getLastRow() > 1) {
    var dataPpts = sheetPassports.getDataRange().getValues();
    for (var i = 1; i < dataPpts.length; i++) {
      var row = dataPpts[i];
      if (row[0]) {
        var dateInStr = "";
        if (row[5] instanceof Date) {
          dateInStr = Utilities.formatDate(row[5], Session.getScriptTimeZone(), "yyyy-MM-dd");
        } else {
          dateInStr = row[5] ? String(row[5]).split("T")[0] : "";
        }
        
        var dateOutStr = "";
        if (row[6] instanceof Date) {
          dateOutStr = Utilities.formatDate(row[6], Session.getScriptTimeZone(), "yyyy-MM-dd");
        } else {
          dateOutStr = row[6] ? String(row[6]).split("T")[0] : "";
        }

        passports.push({
          id: row[0],
          staffName: row[1],
          passportNo: row[2],
          position: row[3],
          shift: row[4] || "PAGI",
          dateIn: dateInStr,
          dateOut: dateOutStr,
          officerName: row[7] || "",
          notes: row[8] || ""
        });
      }
    }
  }

  // 4. Baca Data MASTER_PASPOR (Dan buat otomatis beserta header jika belum ada)
  var masterPassportHeaders = ["NAMA_STAFF", "NO_PASPOR", "JABATAN"];
  var sheetMaster = getOrCreateSheet(SHEET_MASTER_PASSPORTS_NAME, masterPassportHeaders);
  var masterPassports = [];
  if (sheetMaster.getLastRow() > 1) {
    var dataMaster = sheetMaster.getDataRange().getValues();
    for (var i = 1; i < dataMaster.length; i++) {
      var row = dataMaster[i];
      if (row[0]) {
        masterPassports.push({
          name: String(row[0]),
          passportNo: String(row[1]),
          category: String(row[2] || "")
        });
      }
    }
  }

  // 5. Baca Data PETUGAS_SERAH_TERIMA (Dan buat otomatis beserta header jika belum ada)
  var petugasHeaders = ["NAMA_PETUGAS", "JABATAN"];
  var sheetPetugas = getOrCreateSheet(SHEET_PETUGAS_NAME, petugasHeaders);
  var officers = [];
  if (sheetPetugas.getLastRow() > 1) {
    var dataOfficers = sheetPetugas.getDataRange().getValues();
    for (var i = 1; i < dataOfficers.length; i++) {
      var row = dataOfficers[i];
      if (row[0]) {
        officers.push({
          name: String(row[0]),
          category: String(row[1] || "")
        });
      }
    }
  }

  // 6. Buat otomatis sheet HISTORY PAGI & MALAM jika belum ada saat load pertama
  var historyHeaders = ["WAKTU", "NAMA_STAFF", "NO_PASPOR", "AKSI", "PETUGAS", "CATATAN_KETERANGAN"];
  getOrCreateSheet(SHEET_PASSPORT_HISTORY_PAGI, historyHeaders);
  getOrCreateSheet(SHEET_PASSPORT_HISTORY_MALAM, historyHeaders);

  return {
    success: true,
    staffShifts: staffShifts,
    logs: logs,
    passports: passports,
    masterPassports: masterPassports,
    officers: officers
  };
}
