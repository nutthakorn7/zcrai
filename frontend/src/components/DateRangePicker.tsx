import { useState } from 'react'
import { Button, Popover, PopoverTrigger, PopoverContent } from '@heroui/react'
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'

interface DateRangePickerProps {
  startDate: Date
  endDate: Date
  onChange: (start: Date, end: Date) => void
}

// ฟังก์ชันสร้าง Calendar Days
const getDaysInMonth = (year: number, month: number) => {
  return new Date(year, month + 1, 0).getDate()
}

const getFirstDayOfMonth = (year: number, month: number) => {
  return new Date(year, month, 1).getDay()
}

// Quick Presets
const PRESETS = [
  { label: 'Today', days: 0 },
  { label: 'Yesterday', days: 1 },
  { label: 'Last 7 Days', days: 7 },
  { label: 'Last 30 Days', days: 30 },
  { label: 'Last 90 Days', days: 90 },
  { label: 'This Month', days: -1 },
  { label: 'Last Month', days: -2 },
]

export function DateRangePicker({ startDate, endDate, onChange }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [viewingMonth, setViewingMonth] = useState(new Date())
  const [selectingStart, setSelectingStart] = useState(true)
  const [tempStart, setTempStart] = useState(startDate)
  const [tempEnd, setTempEnd] = useState(endDate)

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    })
  }

  const handlePreset = (days: number) => {
    const end = new Date()
    let start: Date

    if (days === 0) {
      // Today
      start = new Date()
    } else if (days === 1) {
      // Yesterday
      start = new Date()
      start.setDate(start.getDate() - 1)
      end.setDate(end.getDate() - 1)
    } else if (days === -1) {
      // This Month
      start = new Date(end.getFullYear(), end.getMonth(), 1)
    } else if (days === -2) {
      // Last Month
      start = new Date(end.getFullYear(), end.getMonth() - 1, 1)
      end.setDate(0) // Last day of previous month
    } else {
      start = new Date()
      start.setDate(start.getDate() - days)
    }

    start.setHours(0, 0, 0, 0)
    end.setHours(23, 59, 59, 999)

    setTempStart(start)
    setTempEnd(end)
    onChange(start, end)
    setIsOpen(false)
  }

  const handleDayClick = (day: number) => {
    const clickedDate = new Date(viewingMonth.getFullYear(), viewingMonth.getMonth(), day)
    
    if (selectingStart) {
      setTempStart(clickedDate)
      setSelectingStart(false)
    } else {
      if (clickedDate < tempStart) {
        setTempStart(clickedDate)
        setTempEnd(tempStart)
      } else {
        setTempEnd(clickedDate)
      }
      setSelectingStart(true)
    }
  }

  const handleApply = () => {
    const start = new Date(tempStart)
    const end = new Date(tempEnd)
    start.setHours(0, 0, 0, 0)
    end.setHours(23, 59, 59, 999)
    onChange(start, end)
    setIsOpen(false)
  }

  const isInRange = (day: number) => {
    const date = new Date(viewingMonth.getFullYear(), viewingMonth.getMonth(), day)
    return date >= tempStart && date <= tempEnd
  }

  const isStartDate = (day: number) => {
    const date = new Date(viewingMonth.getFullYear(), viewingMonth.getMonth(), day)
    return date.toDateString() === tempStart.toDateString()
  }

  const isEndDate = (day: number) => {
    const date = new Date(viewingMonth.getFullYear(), viewingMonth.getMonth(), day)
    return date.toDateString() === tempEnd.toDateString()
  }

  const renderCalendar = () => {
    const year = viewingMonth.getFullYear()
    const month = viewingMonth.getMonth()
    const daysInMonth = getDaysInMonth(year, month)
    const firstDay = getFirstDayOfMonth(year, month)

    const days = []
    
    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="w-8 h-8" />)
    }
    
    // Days of month
    for (let day = 1; day <= daysInMonth; day++) {
      const inRange = isInRange(day)
      const isStart = isStartDate(day)
      const isEnd = isEndDate(day)
      
      days.push(
        <button
          key={day}
          onClick={() => handleDayClick(day)}
          className={`
            w-8 h-8 text-sm rounded-md transition-colors
            ${inRange ? 'bg-violet-500/20' : 'hover:bg-white/5'}
            ${(isStart || isEnd) ? 'bg-violet-500 text-white hover:bg-violet-600' : ''}
            ${!inRange && !isStart && !isEnd ? 'text-[#E4E6EB]' : ''}
          `}
        >
          {day}
        </button>
      )
    }

    return days
  }

  const prevMonth = () => {
    setViewingMonth(new Date(viewingMonth.getFullYear(), viewingMonth.getMonth() - 1))
  }

  const nextMonth = () => {
    setViewingMonth(new Date(viewingMonth.getFullYear(), viewingMonth.getMonth() + 1))
  }

  return (
    <Popover isOpen={isOpen} onOpenChange={setIsOpen} placement="bottom-end">
      <PopoverTrigger>
        <Button
          variant="flat"
          className="bg-[#1C1E28] border border-white/5 text-[#E4E6EB] hover:bg-[#232530]"
          startContent={<CalendarIcon className="w-4 h-4 text-[#FF6B9C]" />}
        >
          {formatDate(startDate)} - {formatDate(endDate)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="bg-[#1A1C24] border border-white/5 p-0 w-auto">
        <div className="flex">
          {/* Presets */}
          <div className="w-36 border-r border-white/5 p-3">
            <p className="text-xs text-[#8D93A1] mb-2 font-medium">Quick Select</p>
            <div className="space-y-1">
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => handlePreset(preset.days)}
                  className="w-full text-left px-2 py-1.5 text-sm text-[#E4E6EB] hover:bg-white/5 rounded-md transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Calendar */}
          <div className="p-4">
            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-4">
              <button onClick={prevMonth} className="p-1 hover:bg-white/5 rounded">
                <ChevronLeftIcon className="w-4 h-4 text-[#8D93A1]" />
              </button>
              <span className="text-sm font-medium text-[#E4E6EB]">
                {monthNames[viewingMonth.getMonth()]} {viewingMonth.getFullYear()}
              </span>
              <button onClick={nextMonth} className="p-1 hover:bg-white/5 rounded">
                <ChevronRightIcon className="w-4 h-4 text-[#8D93A1]" />
              </button>
            </div>

            {/* Day Headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {dayNames.map((day) => (
                <div key={day} className="w-8 h-6 text-xs text-[#6C6F75] text-center">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
              {renderCalendar()}
            </div>

            {/* Selected Range Display */}
            <div className="mt-4 pt-4 border-t border-white/5">
              <div className="flex items-center justify-between text-sm">
                <div>
                  <span className="text-[#6C6F75]">From: </span>
                  <span className="text-[#E4E6EB]">{formatDate(tempStart)}</span>
                </div>
                <div>
                  <span className="text-[#6C6F75]">To: </span>
                  <span className="text-[#E4E6EB]">{formatDate(tempEnd)}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-4">
              <Button 
                size="sm" 
                variant="flat" 
                className="flex-1"
                onPress={() => setIsOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                size="sm" 
                color="secondary" 
                className="flex-1 bg-violet-500"
                onPress={handleApply}
              >
                Apply
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
