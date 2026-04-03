import { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { TaskStatus, TaskType } from '../../types/enums.js';
import type { Task } from '../../types/task.js';
import type { DependencyEntry } from '../../types/task.js';
import { theme } from '../theme.js';
import { STATUS_VALUES, TYPE_VALUES, DEP_TYPE_LABEL } from '../constants.js';
import { openInEditor } from '../editor.js';
import { TaskPicker } from './TaskPicker.js';
import type { PickedDependency } from './TaskPicker.js';

interface Props {
  editingTask: Task | null;
  /** All project tasks, used by the dependency picker */
  allTasks: Task[];
  onSave: (data: {
    name: string;
    description: string;
    type: string;
    status: string;
    technicalNotes: string;
    additionalRequirements: string;
    dependsOn?: DependencyEntry[];
  }) => void;
  onCancel: () => void;
}

type FieldType = 'inline' | 'select' | 'editor' | 'picker';

interface Field {
  label: string;
  key: string;
  type: FieldType;
  options?: string[];
  editorFilename?: string;
}

const FIELDS: Field[] = [
  { label: 'Name', key: 'name', type: 'inline' },
  { label: 'Type', key: 'type', type: 'select', options: TYPE_VALUES },
  { label: 'Status', key: 'status', type: 'select', options: STATUS_VALUES },
  { label: 'Depends On', key: 'dependsOn', type: 'picker' },
  { label: 'Description', key: 'description', type: 'editor', editorFilename: 'description.md' },
  {
    label: 'Tech Notes',
    key: 'technicalNotes',
    type: 'editor',
    editorFilename: 'technical-notes.md',
  },
  {
    label: 'Requirements',
    key: 'additionalRequirements',
    type: 'editor',
    editorFilename: 'requirements.md',
  },
];

export function TaskForm({ editingTask, allTasks, onSave, onCancel }: Props) {
  const [focusIndex, setFocusIndex] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({
    name: editingTask?.name ?? '',
    type: editingTask?.type ?? TaskType.Story,
    status: editingTask?.status ?? TaskStatus.Backlog,
    description: editingTask?.description ?? '',
    technicalNotes: editingTask?.technicalNotes ?? '',
    additionalRequirements: editingTask?.additionalRequirements ?? '',
  });
  const [editorActive, setEditorActive] = useState(false);
  const [pickerActive, setPickerActive] = useState(false);
  const [pickedDeps, setPickedDeps] = useState<PickedDependency[]>([]);

  const currentField = FIELDS[focusIndex];

  const launchEditor = useCallback(
    (field: Field) => {
      setEditorActive(true);
      setTimeout(() => {
        const content = values[field.key] ?? '';
        const result = openInEditor(content, field.editorFilename ?? `${field.key}.md`);
        if (result !== null) {
          setValues((v) => ({ ...v, [field.key]: result }));
        }
        setEditorActive(false);
      }, 50);
    },
    [values],
  );

  const handlePickerConfirm = useCallback((selected: PickedDependency[]) => {
    setPickedDeps(selected);
    setPickerActive(false);
  }, []);

  const handlePickerCancel = useCallback(() => {
    setPickerActive(false);
  }, []);

  useInput(
    (input, key) => {
      if (editorActive || pickerActive) return;

      if (key.escape) {
        onCancel();
        return;
      }

      if (!currentField) return;

      if (key.tab) {
        if (key.shift) {
          setFocusIndex((i) => Math.max(0, i - 1));
        } else {
          setFocusIndex((i) => Math.min(FIELDS.length - 1, i + 1));
        }
        return;
      }

      if (input === 's' && key.ctrl) {
        const nameVal = values['name'];
        if (typeof nameVal === 'string' && nameVal.trim()) {
          const baseData = {
            name: nameVal,
            description: values['description'] ?? '',
            type: values['type'] ?? TaskType.Story,
            status: values['status'] ?? TaskStatus.Backlog,
            technicalNotes: values['technicalNotes'] ?? '',
            additionalRequirements: values['additionalRequirements'] ?? '',
          };
          if (pickedDeps.length > 0) {
            onSave({ ...baseData, dependsOn: pickedDeps.map((d) => ({ id: d.id, type: d.type })) });
          } else {
            onSave(baseData);
          }
        }
        return;
      }

      if (currentField.type === 'inline') {
        const currentValue = values[currentField.key] ?? '';
        if (key.backspace || key.delete) {
          setValues((v) => ({ ...v, [currentField.key]: currentValue.slice(0, -1) }));
        } else if (key.return) {
          setFocusIndex((i) => Math.min(FIELDS.length - 1, i + 1));
        } else if (input && !key.ctrl && !key.meta) {
          setValues((v) => ({ ...v, [currentField.key]: currentValue + input }));
        }
      }

      if (currentField.type === 'picker') {
        if (key.return) {
          setPickerActive(true);
        } else if (key.downArrow) {
          setFocusIndex((i) => Math.min(FIELDS.length - 1, i + 1));
        } else if (key.upArrow) {
          setFocusIndex((i) => Math.max(0, i - 1));
        }
      }

      if (currentField.type === 'editor') {
        if (key.return) {
          launchEditor(currentField);
        } else if (key.downArrow) {
          setFocusIndex((i) => Math.min(FIELDS.length - 1, i + 1));
        } else if (key.upArrow) {
          setFocusIndex((i) => Math.max(0, i - 1));
        }
      }

      if (currentField.type === 'select') {
        const options = currentField.options ?? [];
        const currentValue = values[currentField.key] ?? '';
        const currentIndex = options.indexOf(currentValue);
        if (key.rightArrow || key.return || input === ' ') {
          const nextIndex = (currentIndex + 1) % options.length;
          setValues((v) => ({ ...v, [currentField.key]: options[nextIndex] ?? '' }));
        } else if (key.leftArrow) {
          const prevIndex = (currentIndex - 1 + options.length) % options.length;
          setValues((v) => ({ ...v, [currentField.key]: options[prevIndex] ?? '' }));
        }
      }
    },
    { isActive: !editorActive && !pickerActive },
  );

  // When picker is open, render it instead of the form
  if (pickerActive) {
    const pickerExclude: { excludeIds?: Set<string> } = editingTask
      ? { excludeIds: new Set([editingTask.id]) }
      : {};
    return (
      <TaskPicker
        tasks={allTasks}
        {...pickerExclude}
        initialSelection={pickedDeps}
        onConfirm={handlePickerConfirm}
        onCancel={handlePickerCancel}
      />
    );
  }

  const isEdit = editingTask !== null;

  // Build dependency display summary
  const depSummary =
    pickedDeps.length > 0
      ? pickedDeps.map((d) => `${d.id} (${DEP_TYPE_LABEL[d.type] ?? d.type})`).join(', ')
      : '';

  return (
    <Box flexDirection="column" flexGrow={1} borderStyle="bold" borderColor={theme.borderFocus}>
      <Box gap={0}>
        <Text color={theme.title} bold>
          {' '}
          {isEdit ? 'edit' : 'create'}
        </Text>
      </Box>

      <Box flexDirection="column" paddingX={1} paddingY={0}>
        {FIELDS.map((field, i) => {
          const isFocused = i === focusIndex;
          const value = field.key === 'dependsOn' ? depSummary : (values[field.key] ?? '');
          const displayValue = value;

          return (
            <Box key={field.key} gap={1}>
              <Text color={isFocused ? theme.dialog.label : theme.yaml.key} bold={isFocused}>
                {isFocused ? '>' : ' '} {field.label.padEnd(14)}
              </Text>

              {field.type === 'inline' && (
                <Text color={isFocused ? theme.yaml.value : theme.table.fg}>
                  {displayValue}
                  {isFocused ? <Text color={theme.titleHighlight}>_</Text> : ''}
                </Text>
              )}

              {field.type === 'picker' && (
                <Text>
                  {displayValue ? (
                    <Text color={theme.status.added}>
                      {displayValue.length > 60 ? displayValue.slice(0, 60) + '...' : displayValue}
                    </Text>
                  ) : (
                    <Text dimColor>{isFocused ? 'press enter to select' : 'none'}</Text>
                  )}
                  {isFocused && <Text color={theme.menu.key}> [enter: open picker]</Text>}
                </Text>
              )}

              {field.type === 'editor' && (
                <Text>
                  {displayValue ? (
                    <Text color={theme.status.added}>
                      {displayValue.split('\n')[0]?.slice(0, 50)}
                      {displayValue.length > 50 || displayValue.includes('\n') ? '...' : ''}
                    </Text>
                  ) : (
                    <Text dimColor>{isFocused ? 'press enter' : 'empty'}</Text>
                  )}
                  {isFocused && <Text color={theme.menu.key}> [enter: $EDITOR]</Text>}
                </Text>
              )}

              {field.type === 'select' && (
                <Text color={isFocused ? theme.yaml.value : theme.table.fg}>
                  {isFocused ? '< ' : '  '}
                  {displayValue}
                  {isFocused ? ' >' : ''}
                </Text>
              )}
            </Box>
          );
        })}
      </Box>

      <Box flexGrow={1} />

      <Box paddingX={1}>
        <Text dimColor>tab: next | shift+tab: prev | ctrl+s: save | esc: cancel</Text>
      </Box>
      {editorActive && (
        <Box paddingX={1}>
          <Text color={theme.flash.warn} bold>
            Editor open... save and close to return
          </Text>
        </Box>
      )}
    </Box>
  );
}
