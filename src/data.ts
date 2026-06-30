/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { StaffShift } from "./types";

const rawCS = [
  "FADLAN PRATAMA 2 2 2 2 2 2 1/2 OFF 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 OFF 2 2 2 2 2 2 2",
  "NICO FEBRIAN 2 2 2 2 2 2 2 2 1/2 OFF 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 OFF 2 2 2 2 2",
  "NICO ADRIANSYAH HUTAGAOL 1 1 1 1 1 1 OFF 2 2 2 2 2 2 2 2 2 2 2 2 2 2 2 2 2 2 1/2 OFF 1 1 1 1",
  "ERIC SYAHPUTRA CUTI 1 1 1 1 1 1 1 1 OFF 2 2 2 2 2 2 2 2 2 2 2 2 1/2 OFF 1 1 1 1 1 1",
  "HENGKI 2 2 2 2 2 2 2 2 2 2 1/2 OFF 1 1 1 1 1 1 1 1 1 1 OFF 2 2 2 2 2 2 2 2",
  "ARJUN 1 1 1 1 1 1 1 1 OFF 2 2 2 2 2 2 2 2 2 2 1/2 OFF 1 1 1 1 1 1 1 1 1 1",
  "RINITA SOFIAN 2 2 2 2 1/2 OFF 1 1 1 1 1 1 1 1 1 1 1 1 OFF 2 2 2 2 2 2 2 2 2 2 2 2",
  "ZIKRI TRIANSYAH KAMAL 2 2 2 2 2 1/2 OFF 1 1 1 1 1 1 1 1 1 1 1 1 OFF 2 2 2 2 2 2 2 2 2 2 2",
  "ADITYA PANCA NUGRAHA 2 2 2 2 2 2 1/2 OFF 1 1 1 1 1 1 1 1 1 1 1 1 OFF 2 2 2 2 2 2 2 2 2 2",
  "VERRI AYANG 2 2 2 2 2 2 2 1/2 OFF 1 1 1 1 1 1 1 1 1 1 1 1 OFF 2 2 2 2 2 2 2 2 2",
  "RONNY 2 2 2 2 2 2 2 2 1/2 OFF 1 1 1 1 1 1 1 1 1 1 1 1 OFF 2 2 2 2 2 2 2 2",
  "FERI ADYANTO 2 2 2 2 2 2 2 2 2 1/2 OFF 1 1 1 1 1 1 1 1 1 1 1 1 OFF 2 2 2 2 2 2 2",
  "TAUFAN KHATULISTIWA 2 2 2 2 2 2 2 2 2 2 1/2 OFF 1 1 1 1 1 1 1 1 1 1 1 1 OFF 2 2 2 2 2 2",
  "ANDRE EVANDRO GINTING 2 2 2 2 2 2 2 2 2 2 2 1/2 OFF 1 1 1 1 1 1 1 1 1 1 1 1 OFF 2 2 2 2 2",
  "MUHAMMAD FACHRI 2 2 2 2 2 2 2 2 2 2 2 2 1/2 OFF 1 1 1 1 1 1 1 1 1 1 1 1 OFF 2 2 2 2",
  "SAZU SAHPUTRA 2 2 2 2 2 2 2 2 2 2 2 2 2 1/2 OFF 1 1 1 1 1 1 1 1 1 1 1 1 OFF 2 2 2",
  "DIEVA DAWWAS 2 2 2 2 2 2 2 2 2 2 2 2 2 2 1/2 OFF 1 1 1 1 1 1 1 1 1 1 1 1 OFF 2 2",
  "MUHAMMAD ANDRI AZMI 1 1 1 1 1 OFF 2 2 2 2 2 2 2 2 2 2 2 2 1/2 OFF 1 1 1 1 1 1 1 1 1 1 1",
  "S G KEVINDRA NAIDU 1 1 1 1 1 1 OFF 2 2 2 2 2 2 2 2 2 2 2 2 1/2 OFF 1 1 1 1 1 1 1 1 1 1",
  "ADITYA RIWANA 1 1 1 1 1 1 1 OFF 2 2 2 2 2 2 2 2 2 2 2 2 1/2 OFF 1 1 1 1 1 1 1 1 1",
  "SURAJ KUMAR 1 1 1 1 1 1 1 1 OFF 2 2 2 2 2 2 2 2 2 2 2 2 1/2 OFF 1 1 1 1 1 1 1 1",
  "DIAZ HERMAWAN 1 1 1 1 1 1 1 1 1 OFF 2 2 2 2 2 2 2 2 2 2 2 2 1/2 OFF 1 1 1 1 1 1 1",
  "JOESQUENSEND GAVEROND 1 1 1 1 1 1 1 1 1 1 OFF 2 2 2 2 2 2 2 2 2 2 2 2 1/2 OFF 1 1 1 1 1 1",
  "LEO JONATHAN LIM 1 1 1 1 1 1 1 1 1 1 1 OFF 2 2 2 2 2 2 2 2 2 2 2 2 1/2 OFF 1 1 1 1 1",
  "MORIS BILIEVE GINTING 1 1 1 1 1 1 1 1 1 1 1 1 OFF 2 2 2 2 2 2 2 2 2 2 2 2 1/2 OFF 1 1 1 1",
  "RENATAN 1 1 1 1 1 1 1 1 1 1 1 1 1 OFF 2 2 2 2 2 2 2 2 2 2 2 2 1/2 OFF 1 1 1",
  "AFIF RAIS 1 1 1 1 1 1 1 1 1 1 1 1 1 1 OFF 2 2 2 2 2 2 2 2 2 2 2 2 1/2 OFF 1 1",
];

const rawKapten = [
  "YOGI PERLIAN SYAHPUTRA OFF 1 1 1 1 1 1 1 1 1 1 1 1 OFF 2 2 2 2 2 2 2 2 1/2 OFF 1 1 1 1 1 1 1",
  "FAISAL SABARYANTO 1 1 1 1 1 1 1 1 OFF 2 2 2 2 2 2 2 2 1/2 OFF 1 1 1 1 1 1 1 1 1 2 2 2",
  "MAHESTA RAZ 2 2 2 2 2 2 2 2 2 1/2 OFF 1 1 1 1 1 1 1 1 1 1 OFF 2 2 2 2 2 2 2 2 2",
];

const rawKasir = [
  "ADE SAEPUDIN 1 1 1 1 1 1 1 1 1 1 OFF 2 2 2 2 2 2 2 2 2 1/2 OFF 1 1 1 1 1 1 1 1 1",
  "DONI SAPUTRA NAHAMPUN 1 1 1 1 1 1 1 1 1 1 OFF 2 2 2 2 2 2 2 2 2 1/2 OFF 1 1 1 1 1 1 1 1 1",
  "IMELDA LESTARI 1 1 1 1 1 1 1 1 1 1 1 OFF 2 2 2 2 2 2 2 2 2 1/2 OFF 1 1 1 1 1 1 1 1",
  "ARIEF FADLI WAHYU 1 1 1 1 1 1 1 1 1 1 1 OFF 2 2 2 2 2 2 2 2 2 1/2 OFF 1 1 1 1 1 1 1 1",
  "MUHLIS 1 1 1 1 1 1 1 1 1 1 1 1 OFF 2 2 2 2 2 2 2 2 2 1/2 OFF 1 1 1 1 1 1 1",
  "TANIA WIRANTI 1 1 1 1 1 1 1 1 1 1 1 1 OFF 2 2 2 2 2 2 2 2 2 1/2 OFF 1 1 1 1 1 1 1",
  "MUHAMMAD FAHRI KURNIAWAN 1 1 1 1 1 1 1 1 1 1 1 1 1 OFF 2 2 2 2 2 2 2 2 2 1/2 OFF 1 1 1 1 1 1",
  "JAMENDRA PERANGIN ANGIN 1 1 1 1 1 1 1 1 1 1 1 1 1 OFF 2 2 2 2 2 2 2 2 2 1/2 OFF 1 1 1 1 1 1",
  "CINDY SAPUTRI 1 1 1 1 1 1 1 1 1 1 1 1 1 1 OFF 2 2 2 2 2 2 2 2 2 1/2 OFF 1 1 1 1 1",
  "MUHAMMAD AZRI 1 1 1 1 1 1 1 1 1 1 1 1 1 1 OFF 2 2 2 2 2 2 2 2 2 1/2 OFF 1 1 1 1 1",
  "MOHD REZA PAHLEVI 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 OFF 2 2 2 2 2 2 2 2 2 1/2 OFF 1 1 1 1",
  "WINDA AGUSTIA 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 OFF 2 2 2 2 2 2 2 2 2 1/2 OFF 1 1 1 1",
  "ANTONI 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 OFF 2 2 2 2 2 2 2 2 2 1/2 OFF 1 1 1",
  "MARTIN LESMANA 2 2 2 2 2 2 2 2 2 1/2 OFF 1 1 1 1 1 1 1 1 1 1 OFF 2 2 2 2 2 2 2 2 2",
  "SAHARUDDIN 2 2 2 2 2 2 2 2 2 1/2 OFF 1 1 1 1 1 1 1 1 1 1 OFF 2 2 2 2 2 2 2 2 2",
  "TEDY 2 2 2 2 2 2 2 2 2 2 1/2 OFF 1 1 1 1 1 1 1 1 1 1 OFF 2 2 2 2 2 2 2 2",
  "FENDI CANDRA 2 2 2 2 2 2 2 2 2 2 1/2 OFF 1 1 1 1 1 1 1 1 1 1 OFF 2 2 2 2 2 2 2 2",
  "MUH MARWIANTO 2 2 2 2 2 2 2 2 2 2 2 1/2 OFF 1 1 1 1 1 1 1 1 1 1 OFF 2 2 2 2 2 2 2",
  "ENDY LIE 2 2 2 2 2 2 2 2 2 2 2 1/2 OFF 1 1 1 1 1 1 1 1 1 1 OFF 2 2 2 2 2 2 2",
  "YOLANDA LUBIS 2 2 2 2 2 2 2 2 2 2 2 2 1/2 OFF 1 1 1 1 1 1 1 1 1 1 OFF 2 2 2 2 2 2",
  "MOYNITA CHRISMA SEMBIRING 2 2 2 2 2 2 2 2 2 2 2 2 1/2 OFF 1 1 1 1 1 1 1 1 1 1 OFF 2 2 2 2 2 2",
  "MELANI 2 2 2 2 2 2 2 2 2 2 2 2 2 1/2 OFF 1 1 1 1 1 1 1 1 1 1 OFF 2 2 2 2 2",
  "COCO FRAN SISCO 2 2 2 2 2 2 2 2 2 2 2 2 2 1/2 OFF 1 1 1 1 1 1 1 1 1 1 OFF 2 2 2 2 2",
  "OKTOBERIUS HASRAT SETIAWAN GEA 2 2 2 2 2 2 2 2 2 2 2 2 2 2 1/2 OFF 1 1 1 1 1 1 1 1 1 1 OFF 2 2 2 2",
  "SADINA NST 2 2 2 2 2 2 2 2 2 2 2 2 2 2 1/2 OFF 1 1 1 1 1 1 1 1 1 1 OFF 2 2 2 2",
  "RIZKY PRADANA NAIBAHO 2 2 2 2 2 2 2 2 2 2 2 2 2 2 2 1/2 OFF 1 1 1 1 1 1 1 1 1 1 OFF 2 2 2",
];

const parseRow = (
  row: string,
  category: "CS LINE" | "CS LC" | "KAPTEN KASIR" | "KASIR",
  index: number
): StaffShift => {
  const parts = row.trim().split(/\s+/);
  const shiftTypes = ["1", "2", "1/2", "OFF", "CUTI"];
  
  // Find where the shift codes start (it will be the first token matching shiftTypes)
  let shiftStartIndex = parts.findIndex((p) => shiftTypes.includes(p));
  if (shiftStartIndex === -1) {
    shiftStartIndex = parts.length;
  }
  
  const name = parts.slice(0, shiftStartIndex).join(" ");
  const schedule = parts.slice(shiftStartIndex);
  
  // Create an array of exactly 31 items
  const fullSchedule: string[] = [];
  for (let d = 0; d < 31; d++) {
    if (d < schedule.length) {
      fullSchedule.push(schedule[d]);
    } else {
      // pad with "1" or "2" based on category if missing, or default to "1"
      fullSchedule.push("1");
    }
  }
  
  const cleanId = `${category.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${index + 1}-${name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
  
  return {
    id: cleanId,
    name,
    category,
    schedule: fullSchedule,
  };
};

export const getInitialStaffShifts = (): StaffShift[] => {
  const shifts: StaffShift[] = [];
  const lineNames = [
    "FADLAN PRATAMA", "NICO FEBRIAN", "NICO ADRIANSYAH HUTAGAOL", 
    "ERIC SYAHPUTRA", "HENGKI", "ARJUN"
  ];
  
  rawCS.forEach((row, i) => {
    const parts = row.trim().split(/\s+/);
    const shiftTypes = ["1", "2", "1/2", "OFF", "CUTI"];
    let shiftStartIndex = parts.findIndex((p) => shiftTypes.includes(p));
    if (shiftStartIndex === -1) shiftStartIndex = parts.length;
    const name = parts.slice(0, shiftStartIndex).join(" ");
    
    const isLine = lineNames.includes(name);
    const actualCategory = isLine ? "CS LINE" : "CS LC";
    
    shifts.push(parseRow(row, actualCategory, i));
  });
  
  rawKapten.forEach((row, i) => {
    shifts.push(parseRow(row, "KAPTEN KASIR", i));
  });
  
  rawKasir.forEach((row, i) => {
    shifts.push(parseRow(row, "KASIR", i));
  });
  
  return shifts;
};

// Generates some mock attendance logs for July up to day 15, to make the dashboard look beautiful from the start!
export const getInitialAttendanceLogs = (staffList: StaffShift[]) => {
  const logs: any[] = [];
  
  return logs;
};
