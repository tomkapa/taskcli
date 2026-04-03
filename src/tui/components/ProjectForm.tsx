import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { theme } from '../theme.js';

interface Props {
  onSave: (data: { name: string; key: string; description: string; isDefault: boolean }) => void;
  onCancel: () => void;
}

type FieldKey = 'name' | 'key' | 'description' | 'isDefault';

interface Field {
  label: string;
  key: FieldKey;
  type: 'inline' | 'toggle';
}

const FIELDS: Field[] = [
  { label: 'Name', key: 'name', type: 'inline' },
  { label: 'Key', key: 'key', type: 'inline' },
  { label: 'Description', key: 'description', type: 'inline' },
  { label: 'Default', key: 'isDefault', type: 'toggle' },
];

export function ProjectForm({ onSave, onCancel }: Props) {
  const [focusIndex, setFocusIndex] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({
    name: '',
    key: '',
    description: '',
    isDefault: 'no',
  });

  const currentField = FIELDS[focusIndex];

  useInput((input, key) => {
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
          key: values['key'] ?? '',
          description: values['description'] ?? '',
          isDefault: values['isDefault'] === 'yes',
        });
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

    if (currentField.type === 'toggle') {
      if (key.return || key.rightArrow || key.leftArrow || input === ' ') {
        setValues((v) => ({
          ...v,
          [currentField.key]: v[currentField.key] === 'yes' ? 'no' : 'yes',
        }));
      }
    }
  });

  return (
    <Box flexDirection="column" flexGrow={1} borderStyle="bold" borderColor={theme.borderFocus}>
      <Box gap={0}>
        <Text color={theme.title} bold>
          {' '}
          new project
        </Text>
      </Box>

      <Box flexDirection="column" paddingX={1} paddingY={0}>
        {FIELDS.map((field, i) => {
          const isFocused = i === focusIndex;
          const value = values[field.key] ?? '';

          return (
            <Box key={field.key} gap={1}>
              <Text color={isFocused ? theme.dialog.label : theme.yaml.key} bold={isFocused}>
                {isFocused ? '>' : ' '} {field.label.padEnd(14)}
              </Text>

              {field.type === 'inline' && (
                <Text color={isFocused ? theme.yaml.value : theme.table.fg}>
                  {value}
                  {isFocused ? <Text color={theme.titleHighlight}>_</Text> : ''}
                  {field.key === 'key' && !value && (
                    <Text dimColor>{isFocused ? ' (auto from name)' : ''}</Text>
                  )}
                </Text>
              )}

              {field.type === 'toggle' && (
                <Text color={isFocused ? theme.yaml.value : theme.table.fg}>
                  {isFocused ? '< ' : '  '}
                  {value}
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
    </Box>
  );
}
