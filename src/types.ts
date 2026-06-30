/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface StaffShift {
  id: string;
  name: string;
  category: "CS LINE" | "CS LC" | "KAPTEN KASIR" | "KASIR";
  schedule: string[]; // 31 days for July, values: "1" | "2" | "1/2" | "OFF" | "CUTI"
}

export interface ClockInLog {
  id: string;
  staffId: string;
  staffName: string;
  category: string;
  day: number; // 1 - 31
  shift: string; // "1", "2", "1/2", "OFF", "CUTI"
  clockInTime: string; // HH:mm:ss
  status: "ON TIME" | "TERLAMBAT" | "OFF DAY" | "CUTI";
  timestamp: string; // ISO string
  month?: number; // 0-11
  year?: number; // e.g., 2026
}

export type ShiftType = "1" | "2" | "1/2" | "OFF" | "CUTI";

export const MONTHS_INDONESIAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export const SHIFT_DETAILS = {
  "1": {
    label: "Masuk Pagi (1)",
    start: "07:45:00",
    limit: "07:45:59",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    badgeColor: "bg-emerald-100 text-emerald-800",
  },
  "2": {
    label: "Masuk Malam (2)",
    start: "19:45:00",
    limit: "19:45:59",
    color: "bg-blue-50 text-blue-700 border-blue-200",
    badgeColor: "bg-blue-100 text-blue-800",
  },
  "1/2": {
    label: "Off Setengah Hari (1/2)",
    start: "",
    limit: "",
    color: "bg-amber-50 text-amber-700 border-amber-200",
    badgeColor: "bg-amber-100 text-amber-800",
  },
  "OFF": {
    label: "Off Day Full (OFF)",
    start: "",
    limit: "",
    color: "bg-rose-50 text-rose-700 border-rose-200",
    badgeColor: "bg-rose-100 text-rose-800",
  },
  "CUTI": {
    label: "Cuti (CUTI)",
    start: "",
    limit: "",
    color: "bg-purple-50 text-purple-700 border-purple-200",
    badgeColor: "bg-purple-100 text-purple-800",
  },
};
