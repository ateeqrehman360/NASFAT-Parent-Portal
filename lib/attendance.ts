const DAY_MS = 24 * 60 * 60 * 1000

export type AttendanceSummary = {
  attended: number
  total: number
  percentage: number
}

function parseDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null

  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  return date.toISOString().slice(0, 10) === value ? date : null
}

function calendarDate(now: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)))
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS)
}

export function isSaturdayDate(value: string) {
  return parseDateOnly(value)?.getUTCDay() === 6
}

export function nextSaturdayDate(now = new Date()) {
  const today = calendarDate(now)
  const daysUntilSaturday = (6 - today.getUTCDay() + 7) % 7
  return addDays(today, daysUntilSaturday).toISOString().slice(0, 10)
}

export function attendanceRegisterDate(now = new Date()) {
  const today = calendarDate(now)
  const weekday = today.getUTCDay()
  const offset = weekday === 0 ? -1 : (6 - weekday + 7) % 7
  return addDays(today, offset).toISOString().slice(0, 10)
}

export function attendanceSummary(
  attendanceStartedOn: string | null,
  presentDates: string[],
  now = new Date(),
): AttendanceSummary {
  const trackingStart = attendanceStartedOn ? parseDateOnly(attendanceStartedOn) : null
  if (!trackingStart) return { attended: 0, total: 0, percentage: 100 }

  const daysUntilFirstSaturday = (6 - trackingStart.getUTCDay() + 7) % 7
  const firstSaturday = addDays(trackingStart, daysUntilFirstSaturday)

  const today = calendarDate(now)
  const todayWeekday = today.getUTCDay()
  // Saturday is only completed when Sunday arrives, so a Saturday view still
  // uses the previous week's class as the latest completed session.
  const daysSinceLatestCompletedSaturday = todayWeekday === 0 ? 1 : todayWeekday + 1
  const latestCompletedSaturday = addDays(today, -daysSinceLatestCompletedSaturday)

  if (latestCompletedSaturday < firstSaturday) {
    return { attended: 0, total: 0, percentage: 100 }
  }

  const total = Math.floor((latestCompletedSaturday.getTime() - firstSaturday.getTime()) / (7 * DAY_MS)) + 1
  const uniquePresentDates = new Set(presentDates.filter((value) => {
    const date = parseDateOnly(value)
    return date?.getUTCDay() === 6 && date >= firstSaturday && date <= latestCompletedSaturday
  }))
  const attended = Math.min(uniquePresentDates.size, total)

  return {
    attended,
    total,
    percentage: (attended / total) * 100,
  }
}

export function formatAttendancePercentage(value: number) {
  const rounded = Math.round(value * 10) / 10
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`
}
