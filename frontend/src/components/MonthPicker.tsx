import { useState } from 'react'
import { Button, Popover, PopoverTrigger, PopoverContent } from '@heroui/react'
import { Icon } from '../shared/ui'

interface MonthPickerProps {
  value: string // Format: 'YYYY-MM'
  onChange: (value: string) => void
}

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const monthNamesShort = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
]

export function MonthPicker({ value = "2025-01", onChange }: MonthPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  
  // Parse current value
  const safeValue = value || new Date().toISOString().slice(0, 7)
  const [currentYear, currentMonth] = safeValue.split('-').map(Number)
  const [viewingYear, setViewingYear] = useState(currentYear)

  const formatDisplay = (monthYear: string) => {
    const [year, month] = monthYear.split('-').map(Number)
    return `${monthNames[month - 1]} ${year}`
  }

  const handleMonthSelect = (month: number) => {
    const newValue = `${viewingYear}-${String(month).padStart(2, '0')}`
    onChange(newValue)
    setIsOpen(false)
  }

  const isSelected = (month: number) => {
    return viewingYear === currentYear && month === currentMonth
  }

  const isCurrentMonth = (month: number) => {
    const now = new Date()
    return viewingYear === now.getFullYear() && month === (now.getMonth() + 1)
  }

  // Quick presets
  const handlePreset = (preset: 'current' | 'previous' | 'quarter') => {
    const now = new Date()
    let year = now.getFullYear()
    let month = now.getMonth() + 1

    if (preset === 'previous') {
      month -= 1
      if (month < 1) {
        month = 12
        year -= 1
      }
    } else if (preset === 'quarter') {
      // Last Quarter start (3 months ago)
      month -= 3
      if (month < 1) {
        month += 12
        year -= 1
      }
    }

    const newValue = `${year}-${String(month).padStart(2, '0')}`
    onChange(newValue)
    setIsOpen(false)
  }

  return (
    <Popover isOpen={isOpen} onOpenChange={setIsOpen} placement="bottom-end">
      <PopoverTrigger>
        <Button
          size="sm"
          variant="flat"
          className="bg-content1 border border-white/5 hover:border-white/10 text-foreground min-w-44"
          startContent={<Icon.Calendar className="w-4 h-4 text-primary" />}
        >
          {formatDisplay(value)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="bg-content1 border border-white/5 p-0 w-auto shadow-lg">
        <div className="flex">
          {/* Quick Presets */}
          <div className="w-32 border-r border-white/5 p-3">
            <p className="text-xs text-foreground/60 mb-2 font-medium">Quick Select</p>
            <div className="space-y-1">
              <button
                onClick={() => handlePreset('current')}
                className="w-full text-left px-2 py-1.5 text-sm text-foreground hover:bg-content2 rounded-md transition-colors"
              >
                This Month
              </button>
              <button
                onClick={() => handlePreset('previous')}
                className="w-full text-left px-2 py-1.5 text-sm text-foreground hover:bg-content2 rounded-md transition-colors"
              >
                Last Month
              </button>
              <button
                onClick={() => handlePreset('quarter')}
                className="w-full text-left px-2 py-1.5 text-sm text-foreground hover:bg-content2 rounded-md transition-colors"
              >
                3 Months Ago
              </button>
            </div>
          </div>

          {/* Month Grid */}
          <div className="p-4">
            {/* Year Navigation */}
            <div className="flex items-center justify-between mb-4">
              <button 
                onClick={() => setViewingYear(y => y - 1)} 
                className="p-1 hover:bg-content2 rounded transition-colors"
              >
                <Icon.ChevronLeft className="w-4 h-4 text-foreground/60" />
              </button>
              <span className="text-sm font-medium text-foreground">
                {viewingYear}
              </span>
              <button 
                onClick={() => setViewingYear(y => y + 1)} 
                className="p-1 hover:bg-content2 rounded transition-colors"
              >
                <Icon.ChevronRight className="w-4 h-4 text-foreground/60" />
              </button>
            </div>

            {/* Months Grid */}
            <div className="grid grid-cols-3 gap-2">
              {monthNamesShort.map((name, index) => {
                const month = index + 1
                const selected = isSelected(month)
                const current = isCurrentMonth(month)
                
                return (
                  <button
                    key={name}
                    onClick={() => handleMonthSelect(month)}
                    className={`
                      px-3 py-2 text-sm rounded-md transition-colors
                      ${selected 
                        ? 'bg-primary text-background font-medium' 
                        : current 
                          ? 'bg-primary/20 text-primary font-medium hover:bg-primary/30'
                          : 'text-foreground hover:bg-content2'
                      }
                    `}
                  >
                    {name}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
