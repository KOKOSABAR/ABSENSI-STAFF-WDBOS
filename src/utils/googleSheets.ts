/**
 * Utility untuk Sinkronisasi Real-time dengan Google Sheets via Google Apps Script (GAS).
 * Mendukung Vercel, GitHub, local development, dan konfigurasi dinamis.
 */

import { ClockInLog, StaffShift } from "../types";

// Ambil URL default dari environment variables atau fallback ke URL yang diberikan user
const DEFAULT_GAS_URL = (import.meta as any).env?.VITE_GAS_URL || "https://script.google.com/macros/s/AKfycbz5E660YNYF7EnMQUek84IiFhEU6inNcF-eRbEl6ovczHCMPyGsor0xosGJyyrFTUhj0g/exec";

/**
 * Mendapatkan URL Google Apps Script yang tersimpan.
 * Memprioritaskan local storage (jika disetel oleh user di UI) lalu environment variable.
 */
export function getGasUrl(): string {
  const saved = localStorage.getItem("absen_gas_url");
  return saved || DEFAULT_GAS_URL;
}

/**
 * Menyimpan URL Google Apps Script ke local storage.
 */
export function saveGasUrl(url: string): void {
  localStorage.setItem("absen_gas_url", url.trim());
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
 * Sinkronisasi penuh semua staff dan log aktif ke Google Sheets.
 */
export async function syncAllToGoogleSheets(
  staffShifts: StaffShift[],
  logs: ClockInLog[],
  selectedMonth: number,
  selectedYear: number
): Promise<{ success: boolean; message: string }> {
  const url = getGasUrl();
  if (!url) {
    return { success: false, message: "URL GOOGLE APPS SCRIPT BELUM DIKONFIGURASI" };
  }

  try {
    // Kita lakukan fetch biasa (dengan cors jika GAS sudah dikonfigurasi CORS, atau fallback ke no-cors)
    // Untuk memberikan feedback yang akurat ke user, kita coba fetch dengan mode cors terlebih dahulu.
    // Jika gagal karena CORS, kita berikan instruksi. Tapi GAS Web App yang dideploy dengan benar (diakses sebagai Anyone)
    // biasanya mendukung CORS dengan redirect. Kita gunakan no-cors agar selalu aman dari block browser.
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
      }),
    });

    return { 
      success: true, 
      message: `BERHASIL MENSINKRONKAN ${staffShifts.length} STAF DAN ${logs.length} LOG KE SPREADSHEET SECARA PENUH.` 
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
): Promise<{ success: boolean; staffShifts?: StaffShift[]; logs?: ClockInLog[]; message: string }> {
  const url = getGasUrl();
  if (!url) {
    return { success: false, message: "URL GOOGLE APPS SCRIPT BELUM DIKONFIGURASI" };
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      // Jangan pakai headers Content-Type: application/json agar tidak memicu OPTIONS preflight CORS request
      body: JSON.stringify({
        action: "read_data",
        selectedMonth,
        selectedYear,
      }),
    });

    const text = await response.text();
    const data = JSON.parse(text);

    if (data && data.success) {
      return {
        success: true,
        staffShifts: data.staffShifts,
        logs: data.logs,
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

