"use client";

import { useEffect, useState, type ReactNode } from "react";

import { isoToday } from "@/lib/format-date";

const DEFAULT_START_TIME = "10:00";
const DEFAULT_DURATION_MINUTES = 3 * 60;
const MINIMUM_DURATION_MINUTES = 1;
const LATEST_START_TIME = "23:58";
const LATEST_END_TIME = "23:59";

type FutureRunWindowFieldsProps = {
  dateHelp?: ReactNode;
  fieldClassName: string;
};

export default function FutureRunWindowFields({
  dateHelp,
  fieldClassName,
}: FutureRunWindowFieldsProps) {
  const [now, setNow] = useState<Date | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => isoToday());
  const [selectedStartTime, setSelectedStartTime] = useState(DEFAULT_START_TIME);
  const [selectedEndTime, setSelectedEndTime] = useState(
    addMinutesToTime(DEFAULT_START_TIME, DEFAULT_DURATION_MINUTES),
  );
  const [endTimeEdited, setEndTimeEdited] = useState(false);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = window.setInterval(tick, 1_000);
    return () => window.clearInterval(id);
  }, []);

  const today = now ? localIsoDate(now) : isoToday();
  const minDate = now ? minimumSchedulableDate(now) : today;
  const date = selectedDate < minDate ? minDate : selectedDate;
  const minStartTime =
    now && date === today && minDate === today ? nextMinuteTime(now) : undefined;
  const startTime = clampStartTime(selectedStartTime, minStartTime);
  const minEndTime = addMinutesToTime(startTime, MINIMUM_DURATION_MINUTES);
  const defaultEndTime = addMinutesToTime(startTime, DEFAULT_DURATION_MINUTES);
  const endTime = normalizeEndTime(
    endTimeEdited ? selectedEndTime : defaultEndTime,
    minEndTime,
  );

  return (
    <>
      <Field label="Date">
        <input
          className={fieldClassName}
          type="date"
          name="date"
          value={date}
          min={minDate}
          onChange={(event) => {
            const nextDate = event.target.value;
            setSelectedDate(nextDate < minDate ? minDate : nextDate);
            setSelectedStartTime(DEFAULT_START_TIME);
            setEndTimeEdited(false);
          }}
          required
        />
      </Field>
      {dateHelp}

      <div className="grid grid-cols-2 gap-3">
        <Field label="From">
          <input
            className={fieldClassName}
            type="time"
            name="startTime"
            value={startTime}
            min={minStartTime}
            max={LATEST_START_TIME}
            onChange={(event) => {
              const nextStart = clampStartTime(event.target.value, minStartTime);
              setSelectedStartTime(nextStart);
              if (!endTimeEdited) {
                setSelectedEndTime(
                  addMinutesToTime(nextStart, DEFAULT_DURATION_MINUTES),
                );
              }
            }}
            required
          />
        </Field>
        <Field label="To">
          <input
            className={fieldClassName}
            type="time"
            name="endTime"
            value={endTime}
            min={minEndTime}
            max={LATEST_END_TIME}
            onChange={(event) => {
              setEndTimeEdited(true);
              setSelectedEndTime(
                normalizeEndTime(event.target.value, minEndTime),
              );
            }}
            required
          />
        </Field>
      </div>
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

function localIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function minimumSchedulableDate(now: Date): string {
  return nextMinuteTotal(now) <= timeToMinutes(LATEST_START_TIME)
    ? localIsoDate(now)
    : localIsoDateInDays(now, 1);
}

function localIsoDateInDays(date: Date, days: number): string {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return localIsoDate(nextDate);
}

function nextMinuteTime(now: Date): string {
  return minutesToTime(Math.min(nextMinuteTotal(now), timeToMinutes(LATEST_END_TIME)));
}

function nextMinuteTotal(now: Date): number {
  return now.getHours() * 60 + now.getMinutes() + 1;
}

function clampStartTime(time: string, minTime?: string): string {
  if (!time) return minTime ?? DEFAULT_START_TIME;
  if (minTime && time < minTime) return minTime;
  if (time > LATEST_START_TIME) return LATEST_START_TIME;
  return time;
}

function normalizeEndTime(time: string, minTime: string): string {
  const nextTime = time || minTime;
  if (nextTime < minTime) return minTime;
  if (nextTime > LATEST_END_TIME) return LATEST_END_TIME;
  return nextTime;
}

function addMinutesToTime(time: string, minutes: number): string {
  const nextTotal = Math.min(
    timeToMinutes(time) + minutes,
    timeToMinutes(LATEST_END_TIME),
  );
  return minutesToTime(nextTotal);
}

function timeToMinutes(time: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return 0;
  const [, hours, minutes] = match;
  return Number(hours) * 60 + Number(minutes);
}

function minutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
