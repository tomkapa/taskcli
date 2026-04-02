import { useState, useCallback } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { TaskStatus, TaskType } from '../../types/enums.js';
import type { Task } from '../../types/task.js';
import { theme } from '../theme.js';
import { openInEditor } from '../editor.js';

const STATUS_VALUES = Object.values(TaskStatus);
const TYPE_VALUES = Object.values(TaskType);

interface Props {
  editingTask: Task | null;
  onSave: (data: {
    name: string;
    description: string;
    type: string;
    status: string;
    priority: number;
    technicalNotes: string;
    additionalRequirements: string;
  }) => void;
  onCancel: () => void;
}

type FieldType = 'inline' | 'select' | 'number' | 'editor';

interface Field {
  label: string;
  key: string;
  type: FieldType;
  options?: string[];
  min?: number;
  max?: number;
  editorFilename?: string;
}

const FIELDS: Field[] = [
  { label: 'Name', key: 'name', type: 'inline' },
  { label: 'Type', key: 'type', type: 'select', options: TYPE_VALUES },
  { label: 'Status', key: 'status', type: 'select', options: STATUS_VALUES },
  { label: 'Priority', key: 'priority', type: 'number', min: 1, max: 5 },
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

export function TaskForm({ editingTask, onSave, onCancel }: Props) {
  const { exit: _exit, ...appRest } = useApp();
  void appRest;
  const [focusIndex, setFocusIndex] = useState(0);
  const [values, setValues] = useState<Record<string, string | number>>({
    name: editingTask?.name ?? '',
    type: editingTask?.type ?? TaskType.Story,
    status: editingTask?.status ?? TaskStatus.Backlog,
    priority: editingTask?.priority ?? 3,
    description: editingTask?.description ?? '',
    technicalNotes: editingTask?.technicalNotes ?? '',
    additionalRequirements: editingTask?.additionalRequirements ?? '',
  });
  const [editorActive, setEditorActive] = useState(false);

  const currentField = FIELDS[focusIndex];

  const launchEditor = useCallback(
    (field: Field) => {
      setEditorActive(true);
      setTimeout(() => {
        const content = String(values[field.key] ?? '');
        const result = openInEditor(content, field.editorFilename ?? `${field.key}.md`);
        if (result !== null) {
          setValues((v) => ({ ...v, [field.key]: result }));
        }
        setEditorActive(false);
      }, 50);
    },
    [values],
  );

  useInput(
    (input, key) => {
      if (editorActive) return;

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
          onSave({
            name: nameVal,
            description: `${values['description'] ?? ''}`,
            type: `${values['type'] ?? TaskType.Story}`,
            status: `${values['status'] ?? TaskStatus.Backlog}`,
            priority: Number(values['priority'] ?? 3),
            technicalNotes: `${values['technicalNotes'] ?? ''}`,
            additionalRequirements: `${values['additionalRequirements'] ?? ''}`,
          });
        }
        return;
      }

      if (currentField.type === 'inline') {
        const currentValue = String(values[currentField.key] ?? '');
        if (key.backspace || key.delete) {
          setValues((v) => ({ ...v, [currentField.key]: currentValue.slice(0, -1) }));
        } else if (key.return) {
          setFocusIndex((i) => Math.min(FIELDS.length - 1, i + 1));
        } else if (input && !key.ctrl && !key.meta) {
          setValues((v) => ({ ...v, [currentField.key]: currentValue + input }));
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
        const currentValue = String(values[currentField.key] ?? '');
        const currentIndex = options.indexOf(currentValue);
        if (key.rightArrow || key.return || input === ' ') {
          const nextIndex = (currentIndex + 1) % options.length;
          setValues((v) => ({ ...v, [currentField.key]: options[nextIndex] ?? '' }));
        } else if (key.leftArrow) {
          const prevIndex = (currentIndex - 1 + options.length) % options.length;
          setValues((v) => ({ ...v, [currentField.key]: options[prevIndex] ?? '' }));
        }
      }

      if (currentField.type === 'number') {
        const currentValue = Number(values[currentField.key] ?? 3);
        const min = currentField.min ?? 1;
        const max = currentField.max ?? 5;
        if (key.rightArrow || key.upArrow) {
          setValues((v) => ({ ...v, [currentField.key]: Math.min(max, currentValue + 1) }));
        } else if (key.leftArrow || key.downArrow) {
          setValues((v) => ({ ...v, [currentField.key]: Math.max(min, currentValue - 1) }));
        } else if (input && /^[1-5]$/.test(input)) {
          setValues((v) => ({ ...v, [currentField.key]: parseInt(input, 10) }));
        }
      }
    },
    { isActive: !editorActive },
  );

  const isEdit = editingTask !== null;

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
          const value = values[field.key];
          const displayValue = String(value ?? '');

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

              {field.type === 'number' && (
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
