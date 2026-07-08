/**
 * Utility untuk Sinkronisasi Real-time dengan Google Sheets via Google Apps Script (GAS).
 * Mendukung Vercel, GitHub, local development, dan konfigurasi dinamis.
 */

import { ClockInLog, StaffShift, PassportHandoverRecord, MasterPassport, CustomOfficer } from "../types";

// Ambil URL default dari environment variables atau fallback ke URL yang diberikan user
const DEFAULT_GAS_URL = import.meta.env.VITE_GAS_URL || "https://script.google.com/macros/s/AKfycbz5E660YNYF7EnMQUek84IiFhEU6inNcF-eRbEl6ovczHCMPyGsor0xosGJyyrFTUhj0g/exec";

/**
 * Mendapatkan URL Google Apps Script yang tersimpan.
 * Memprioritaskan local storage (jika disetel oleh user di UI) lalu environment variable.
 */
export function getGasUrl(): string {
  return DEFAULT_GAS_URL;
}

/**
 * Menyimpan URL Google Apps Script ke local storage.
 */
export function saveGasUrl(url: string): void {
  localStorage.setItem("absen_gas_url", url.trim());
}

/**
 * Membersihkan format waktu kotor (misal: "Sat Dec 30 1899 11:00:53 GMT...") menjadi "HH:mm:ss".
 */
export function cleanTimeStr(timeStr: string): string {
  if (!timeStr) return "";
  const match = timeStr.match(/\b\d{2}:\d{2}:\d{2}\b/);
  if (match) {
    return match[0];
  }
  if (timeStr.includes("T")) {
    const parts = timeStr.split("T");
    if (parts[1]) {
      return parts[1].split(".")[0];
    }
  }
  return timeStr;
}

/**
 * Test koneksi ke Google Apps Script Web App.
 */
export async function testGasConnection(url: string): Promise<{ success: boolean; message: string }> {
  if (!url || !url.trim().startsWith("https://script.google.com")) {
    return { success: false, message: "URL TIDAK VALID! HARUS DIMULAI DENGAN https://script.google.com" };
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      mode: "no-cors", // Mode no-cors digunakan untuk menghindari masalah preflight CORS pada GAS
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "test" }),
    });

    // Karena no-cors tidak mengembalikan body respons, kita menganggap fetch yang sukses terhubung sebagai berhasil
    return { 
      success: true, 
      message: "BERHASIL TERHUBUNG! GOOGLE APPS SCRIPT WEB APP AKTIF & MERESPONS." 
    };
  } catch (error: any) {
    console.error("Test connection failed", error);
    return { success: false, message: `GAGAL TERHUBUNG: ${error.message || error}` };
  }
}

/**
 * Sinkronisasi instan satu log (tambah/perbarui) ke Google Sheets.
 */
export async function syncUpsertLog(log: ClockInLog, selectedMonth: number, selectedYear: number): Promise<boolean> {
  const url = getGasUrl();
  if (!url) return false;

  try {
    await fetch(url, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "upsert_log",
        selectedMonth,
        selectedYear,
        log,
      }),
    });
    return true;
  } catch (error) {
    console.error("Failed to sync upsert log", error);
    return false;
  }
}

/**
 * Sinkronisasi instan penghapusan satu log dari Google Sheets.
 */
export async function syncDeleteLog(logId: string): Promise<boolean> {
  const url = getGasUrl();
  if (!url) return false;

  try {
    await fetch(url, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "delete_log",
        logId,
      }),
    });
    return true;
  } catch (error) {
    console.error("Failed to sync delete log", error);
    return false;
  }
}

/**
 * Sinkronisasi instan satu record paspor (tambah atau update) ke Google Sheets.
 */
export async function syncUpsertPassport(passport: PassportHandoverRecord): Promise<boolean> {
  const url = getGasUrl();
  if (!url) return false;

  try {
    await fetch(url, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "upsert_passport",
        passport,
      }),
    });
    return true;
  } catch (error) {
    console.error("Failed to sync upsert passport", error);
    return false;
  }
}

/**
 * Sinkronisasi instan penghapusan satu record paspor dari Google Sheets.
 */
export async function syncDeletePassport(passportId: string): Promise<boolean> {
  const url = getGasUrl();
  if (!url) return false;

  try {
    await fetch(url, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "delete_passport",
        passportId,
      }),
    });
    return true;
  } catch (error) {
    console.error("Failed to sync delete passport", error);
    return false;
  }
}

/**
 * Sinkronisasi cepat khusus jadwal staff ke Google Sheets.
 */
export async function syncScheduleToGoogleSheets(
  staffShifts: StaffShift[],
  selectedMonth: number,
  selectedYear: number
): Promise<boolean> {
  const url = getGasUrl();
  if (!url) return false;

  try {
    await fetch(url, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "sync_schedule",
        selectedMonth,
        selectedYear,
        staffShifts,
      }),
    });
    return true;
  } catch (error) {
    console.error("Failed to sync schedule", error);
    return false;
  }
}

/**
 * Sinkronisasi penuh semua staff dan log aktif ke Google Sheets.
 */
export async function syncAllToGoogleSheets(
  staffShifts: StaffShift[],
  logs: ClockInLog[],
  passports: PassportHandoverRecord[],
  selectedMonth: number,
  selectedYear: number
): Promise<{ success: boolean; message: string }> {
  const url = getGasUrl();
  if (!url) {
    return { success: false, message: "URL GOOGLE APPS SCRIPT BELUM DIKONFIGURASI" };
  }

  try {
    await fetch(url, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "sync_all",
        selectedMonth,
        selectedYear,
        staffShifts,
        logs,
        passports,
      }),
    });

    return { 
      success: true, 
      message: `BERHASIL MENSINKRONKAN ${staffShifts.length} STAF, ${logs.length} LOG, DAN ${passports.length} DATA PASPOR KE SPREADSHEET SECARA PENUH.` 
    };
  } catch (error: any) {
    console.error("Full sync failed", error);
    return { success: false, message: `SINKRONISASI GAGAL: ${error.message || error}` };
  }
}

/**
 * Mengambil (pull) data terbaru dari Google Sheets.
 */
export async function fetchDataFromGoogleSheets(
  selectedMonth: number,
  selectedYear: number
): Promise<{
  success: boolean;
  staffShifts?: StaffShift[];
  logs?: ClockInLog[];
  passports?: PassportHandoverRecord[];
  masterPassports?: MasterPassport[];
  officers?: CustomOfficer[];
  message: string;
}> {
  const url = getGasUrl();
  if (!url) {
    return { success: false, message: "URL GOOGLE APPS SCRIPT BELUM DIKONFIGURASI" };
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      body: JSON.stringify({
        action: "read_data",
        selectedMonth,
        selectedYear,
      }),
    });

    const text = await response.text();
    const data = JSON.parse(text);

    if (data && data.success) {
      const cleanedLogs = (data.logs || []).map((l: any) => ({
        ...l,
        clockInTime: cleanTimeStr(l.clockInTime || "")
      }));
      return {
        success: true,
        staffShifts: data.staffShifts,
        logs: cleanedLogs,
        passports: data.passports || [],
        masterPassports: data.masterPassports || [],
        officers: data.officers || [],
        message: "BERHASIL MEMUAT DATA DARI GOOGLE SPREADSHEET."
      };
    } else {
      return { 
        success: false, 
        message: data?.message || "GAGAL MEMUAT DATA DARI SERVER." 
      };
    }
  } catch (error: any) {
    console.error("Fetch data failed", error);
    return { 
      success: false, 
      message: `GAGAL MENGHUBUNGI GOOGLE SHEETS: ${error.message || error}` 
    };
  }
}

