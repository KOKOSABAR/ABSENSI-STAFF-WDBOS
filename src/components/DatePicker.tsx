import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

interface DatePickerProps {
  selectedDay: number;
  selectedMonth: number; // 0-11
  selectedYear: number;
  onChange: (day: number, month: number, year: number) => void;
  theme?: "light" | "black";
}

export default function DatePicker({
  selectedDay,
  selectedMonth,
  selectedYear,
  onChange,
  theme = "black",
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [displayMonth, setDisplayMonth] = useState(selectedMonth);
  const [displayYear, setDisplayYear] = useState(selectedYear);
  const containerRef = useRef<HTMLDivElement>(null);

  // Synchronize internal display states with selected props when props change
  useEffect(() => {
    setDisplayMonth(selectedMonth);
    setDisplayYear(selectedYear);
  }, [selectedMonth, selectedYear]);

  // Handle outside clicks to close the popover
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handlePrevMonth = () => {
    if (displayMonth === 0) {
      setDisplayMonth(11);
      setDisplayYear((prev) => prev - 1);
    } else {
      setDisplayMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (displayMonth === 11) {
      setDisplayMonth(0);
      setDisplayYear((prev) => prev + 1);
    } else {
      setDisplayMonth((prev) => prev + 1);
    }
  };

  // Generate calendar days
  const daysInCurrentMonth = new Date(displayYear, displayMonth + 1, 0).getDate();
  const firstDayIndex = new Date(displayYear, displayMonth, 1).getDay(); // 0 = Sun, 1 = Mon, etc.
  const daysInPrevMonth = new Date(displayYear, displayMonth, 0).getDate();

  const prevMonthDaysToShow = firstDayIndex;
  const currentMonthDaysToShow = daysInCurrentMonth;
  // total cells in calendar grid is 42 (6 rows of 7 days)
  const totalCells = 42;
  const nextMonthDaysToShow = totalCells - (prevMonthDaysToShow + currentMonthDaysToShow);

  const daysGrid: { day: number; month: number; year: number; isCurrentMonth: boolean }[] = [];

  // Add prev month trailing days
  for (let i = prevMonthDaysToShow - 1; i >= 0; i--) {
    const prevMonth = displayMonth === 0 ? 11 : displayMonth - 1;
    const prevYear = displayMonth === 0 ? displayYear - 1 : displayYear;
    daysGrid.push({
      day: daysInPrevMonth - i,
      month: prevMonth,
      year: prevYear,
      isCurrentMonth: false,
    });
  }

  // Add current month days
  for (let i = 1; i <= currentMonthDaysToShow; i++) {
    daysGrid.push({
      day: i,
      month: displayMonth,
      year: displayYear,
      isCurrentMonth: true,
    });
  }

  // Add next month leading days
  for (let i = 1; i <= nextMonthDaysToShow; i++) {
    const nextMonth = displayMonth === 11 ? 0 : displayMonth + 1;
    const nextYear = displayMonth === 11 ? displayYear + 1 : displayYear;
    daysGrid.push({
      day: i,
      month: nextMonth,
      year: nextYear,
      isCurrentMonth: false,
    });
  }

  const selectDate = (day: number, month: number, year: number) => {
    onChange(day, month, year);
    setIsOpen(false);
  };

  const isSelected = (day: number, month: number, year: number) => {
    return day === selectedDay && month === selectedMonth && year === selectedYear;
  };

  const isDark = theme === "black";

  return (
    <div className="relative inline-block text-left font-mono" ref={containerRef} id="custom-datepicker-container">
      {/* Input box styled exactly like the screenshot with theme support */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between w-full min-w-[200px] border rounded-lg px-4 py-2.5 text-sm font-black tracking-wider text-left shadow-sm focus:outline-none cursor-pointer transition-colors duration-200 ${
          isDark
            ? "bg-[#090e1a] text-slate-100 border-slate-700 hover:border-slate-500 hover:bg-[#0d1527]"
            : "bg-white text-black border-slate-400 hover:border-slate-500"
        }`}
        id="datepicker-input-button"
      >
        <span className={isDark ? "text-slate-100 font-black" : "text-black font-black"}>
          {selectedYear}-{selectedMonth + 1}-{selectedDay}
        </span>
        <Calendar className={`h-4 w-4 shrink-0 ${isDark ? "text-slate-400" : "text-slate-500"}`} />
      </button>

      {/* Popover Calendar */}
      {isOpen && (
        <div
          className={`absolute z-50 mt-1 w-[260px] border-2 border-[#1e88e5] rounded-none shadow-2xl p-2 ${
            isDark ? "bg-[#090e1a] text-slate-100" : "bg-white text-black"
          }`}
          id="datepicker-popover"
        >
          {/* Header Row: Navigations and display Month/Year */}
          <div className={`flex items-center justify-between px-2 py-1.5 border-b mb-2 ${
            isDark ? "border-slate-800/85" : "border-slate-100"
          }`}>
            <button
              type="button"
              onClick={handlePrevMonth}
              className={`p-1 rounded font-black cursor-pointer ${
                isDark ? "text-slate-200 hover:bg-slate-800" : "hover:bg-slate-100 text-black"
              }`}
            >
              <ChevronLeft className="h-4 w-4 stroke-[3]" />
            </button>
            <div className={`text-sm font-black tracking-wider ${isDark ? "text-slate-100" : "text-slate-800"}`}>
              {displayYear} / {displayMonth + 1}
            </div>
            <button
              type="button"
              onClick={handleNextMonth}
              className={`p-1 rounded font-black cursor-pointer ${
                isDark ? "text-slate-200 hover:bg-slate-800" : "hover:bg-slate-100 text-black"
              }`}
            >
              <ChevronRight className="h-4 w-4 stroke-[3]" />
            </button>
          </div>

          {/* Days of the week header */}
          <div className={`grid grid-cols-7 text-center text-[10px] font-black mb-1.5 uppercase ${
            isDark ? "text-teal-450" : "text-[#1e88e5]"
          }`}>
            <span>SUN</span>
            <span>MON</span>
            <span>TUE</span>
            <span>WED</span>
            <span>THU</span>
            <span>FRI</span>
            <span>SAT</span>
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-y-1 text-center text-xs">
            {daysGrid.map((item, index) => {
              const active = isSelected(item.day, item.month, item.year);
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => selectDate(item.day, item.month, item.year)}
                  className={`py-1.5 font-black flex items-center justify-center cursor-pointer transition-all ${
                    active
                      ? "bg-[#1e88e5] text-white rounded-none font-black"
                      : item.isCurrentMonth
                      ? isDark
                        ? "text-slate-100 hover:bg-slate-800"
                        : "text-slate-800 hover:bg-slate-100"
                      : isDark
                      ? "text-slate-600 hover:bg-slate-800/40"
                      : "text-slate-300 hover:bg-slate-100"
                  }`}
                >
                  {item.day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
