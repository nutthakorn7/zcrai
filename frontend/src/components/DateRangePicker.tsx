import { useState, useEffect } from 'react'
import { Button, Popover, PopoverTrigger, PopoverContent } from '@heroui/react'
import { Icon } from '../shared/ui'

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
  const [tempEnd, setTempEnd] = useState(() => {
    const d = new Date(endDate)
    d.setDate(d.getDate() - 1)
    return d
  })

  // Sync tempStart and tempEnd when props change
  useEffect(() => {
    setTempStart(startDate)
    const d = new Date(endDate)
    d.setDate(d.getDate() - 1)
    setTempEnd(d)
  }, [startDate, endDate])

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
    let end = new Date()
    let start: Date

    if (days === 0) {
      // Today - include all of today's data
      start = new Date()
      end.setDate(end.getDate() + 1) // Set to tomorrow to include all of today
    } else if (days === 1) {
      // Yesterday
      start = new Date()
      start.setDate(start.getDate() - 1)
      end = new Date() // Today
    } else if (days === -1) {
      // This Month
      start = new Date(end.getFullYear(), end.getMonth(), 1)
      end.setDate(end.getDate() + 1) // Include all of today
    } else if (days === -2) {
      // Last Month
      start = new Date(end.getFullYear(), end.getMonth() - 1, 1)
      end = new Date(end.getFullYear(), end.getMonth(), 1) // First day of this month
    } else {
      // Last N Days
      start = new Date()
      start.setDate(start.getDate() - days)
      end.setDate(end.getDate() + 1) // Include all of today
    }

    start.setHours(0, 0, 0, 0)
    end.setHours(0, 0, 0, 0) // Backend will handle as < end date

    // Set temp states for display (subtract 1 from end for display)
    const displayEnd = new Date(end)
    displayEnd.setDate(displayEnd.getDate() - 1)
    setTempStart(start)
    setTempEnd(displayEnd)
    
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
    // Add 1 day to end to include all data of the selected end date
    end.setDate(end.getDate() + 1)
    end.setHours(0, 0, 0, 0)
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
            ${inRange ? 'bg-primary/20' : 'hover:bg-content2'}
            ${(isStart || isEnd) ? 'bg-primary text-background hover:bg-primary/90 font-medium' : ''}
            ${!inRange && !isStart && !isEnd ? 'text-foreground' : ''}
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
          size="sm"
          variant="flat"
          className="bg-content1 border border-white/5 hover:border-white/10 text-foreground"
          startContent={<Icon.Calendar className="w-4 h-4 text-primary" />}
        >
          {formatDate(startDate)} - {formatDate(tempEnd)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="bg-content1 border border-white/5 p-0 w-auto shadow-lg">
        <div className="flex">
          {/* Presets */}
          <div className="w-36 border-r border-white/5 p-3">
            <p className="text-xs text-foreground/60 mb-2 font-medium">Quick Select</p>
            <div className="space-y-1">
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => handlePreset(preset.days)}
                  className="w-full text-left px-2 py-1.5 text-sm text-foreground hover:bg-content2 rounded-md transition-colors"
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
              <button onClick={prevMonth} className="p-1 hover:bg-content2 rounded transition-colors">
                <Icon.ChevronLeft className="w-4 h-4 text-foreground/60" />
              </button>
              <span className="text-sm font-medium text-foreground">
                {monthNames[viewingMonth.getMonth()]} {viewingMonth.getFullYear()}
              </span>
              <button onClick={nextMonth} className="p-1 hover:bg-content2 rounded transition-colors">
                <Icon.ChevronRight className="w-4 h-4 text-foreground/60" />
              </button>
            </div>

            {/* Day Headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {dayNames.map((day) => (
                <div key={day} className="w-8 h-6 text-xs text-foreground/40 text-center">
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
                  <span className="text-foreground/60">From: </span>
                  <span className="text-foreground">{formatDate(tempStart)}</span>
                </div>
                <div>
                  <span className="text-foreground/60">To: </span>
                  <span className="text-foreground">{formatDate(tempEnd)}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-4">
              <Button 
                size="sm" 
                variant="flat" 
                className="flex-1 bg-content2 border border-white/5"
                onPress={() => setIsOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                size="sm" 
                className="flex-1 bg-primary hover:bg-primary/90 text-background"
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
