import { Select, SelectItem, Input, Button } from '@heroui/react';
import { Icon } from '../shared/ui';

interface FilterBarProps {
  savedFilter: string;
  onSavedFilterChange: (value: string) => void;
  severityFilter: string[];
  onSeverityFilterChange: (value: string[]) => void;
  statusFilter: string[];
  onStatusFilterChange: (value: string[]) => void;
  assigneeFilter: string;
  onAssigneeFilterChange: (value: string) => void;
  assignees: string[];  // List of unique assignees
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onSubmit: () => void;
  onClearFilters: () => void;
}

export function FilterBar({
  savedFilter,
  onSavedFilterChange,
  severityFilter,
  onSeverityFilterChange,
  statusFilter,
  onStatusFilterChange,
  assigneeFilter,
  onAssigneeFilterChange,
  assignees,
  searchQuery,
  onSearchQueryChange,
  onSubmit,
  onClearFilters
}: FilterBarProps) {
  return (
    <div className="bg-content1 border border-white/5 rounded-lg p-4 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {/* Saved Filters */}
        <Select
          label="Saved Filters"
          placeholder="Select..."
          size="sm"
          selectedKeys={savedFilter ? [savedFilter] : []}
          onChange={(e) => onSavedFilterChange(e.target.value)}
          classNames={{
            label: "text-xs text-gray-400",
            trigger: "bg-content2"
          }}
        >
          <SelectItem key="my-cases">My Cases</SelectItem>
          <SelectItem key="unassigned">Unassigned</SelectItem>
          <SelectItem key="sla-risk">SLA at Risk</SelectItem>
          <SelectItem key="critical">Critical Only</SelectItem>
        </Select>

        {/* Severity */}
        <Select
          label="Severity"
          placeholder="All"
          size="sm"
          selectionMode="multiple"
          selectedKeys={severityFilter}
          onSelectionChange={(keys) => onSeverityFilterChange(Array.from(keys) as string[])}
          classNames={{
            label: "text-xs text-gray-400",
            trigger: "bg-content2"
          }}
        >
          <SelectItem key="critical">Critical</SelectItem>
          <SelectItem key="high">High</SelectItem>
          <SelectItem key="medium">Medium</SelectItem>
          <SelectItem key="low">Low</SelectItem>
          <SelectItem key="info">Info</SelectItem>
        </Select>

        {/* Status */}
        <Select
          label="Status"
          placeholder="All"
          size="sm"
          selectionMode="multiple"
          selectedKeys={statusFilter}
          onSelectionChange={(keys) => onStatusFilterChange(Array.from(keys) as string[])}
          classNames={{
            label: "text-xs text-gray-400",
            trigger: "bg-content2"
          }}
        >
          <SelectItem key="open">Open</SelectItem>
          <SelectItem key="investigating">Investigating</SelectItem>
          <SelectItem key="resolved">Resolved</SelectItem>
          <SelectItem key="closed">Closed</SelectItem>
        </Select>

        {/* Owner (Autocomplete) */}
        <Select
          label="Owner"
          placeholder="All"
          size="sm"
          selectedKeys={assigneeFilter ? [assigneeFilter] : []}
          onChange={(e) => onAssigneeFilterChange(e.target.value)}
          classNames={{
            label: "text-xs text-gray-400",
            trigger: "bg-content2"
          }}
        >
          {assignees.map((assignee) => (
            <SelectItem key={assignee}>
              {assignee}
            </SelectItem>
          ))}
        </Select>

        {/* Search */}
        <div className="md:col-span-2">
          <Input
            label="Search"
            placeholder="Search for something..."
            size="sm"
            value={searchQuery}
            onValueChange={onSearchQueryChange}
            startContent={<Icon.Search className="w-4 h-4 text-gray-400" />}
            classNames={{
              label: "text-xs text-gray-400",
              inputWrapper: "bg-content2"
            }}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 items-end">
          <Button
            size="sm"
            color="primary"
            onPress={onSubmit}
            className="flex-1"
          >
            Submit
          </Button>
          <Button
            size="sm"
            variant="flat"
            onPress={onClearFilters}
            isIconOnly
            aria-label="Clear filters"
          >
            <Icon.Close className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
